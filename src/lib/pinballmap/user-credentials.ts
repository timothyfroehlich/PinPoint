import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { reportError } from "~/lib/observability/report-error";
import { createAdminClient } from "~/lib/supabase/admin";
import { db } from "~/server/db";
import { pinballmapUserCredentials } from "~/server/db/schema";
import { assertNotInTransaction } from "~/server/db/transaction-context";
import { getPinballMapClient } from "./client";
import type { PbmAuthFailureReason, PbmCredentials } from "./types";

/**
 * A member's linked Pinball Map account (pinballmap spec 8.4–8.5, PP-o355.6).
 *
 * The member signs in once with their Pinball Map login and password. PinPoint
 * exchanges them for the account's token (`auth_details`), stores the token in
 * Supabase Vault, and discards the password: it is never written anywhere,
 * never logged, and never returned. The `pinballmap_user_credentials` row holds
 * only the Vault reference.
 *
 * Vault writes are external, non-transactional effects (CORE-ARCH-011): they run
 * before or after the row transaction, never inside it, and a secret orphaned
 * by a failed swap is deleted best-effort, the same shape as the Discord bot
 * token save.
 */

/** What the settings page and the listing control need; no secret material. */
export type PinballMapLinkStatus =
  | { status: "not_linked" }
  | { status: "linked"; username: string }
  | { status: "needs_relink"; username: string };

/** Read the viewer's link state off the row. Never decrypts the token. */
export async function getPinballMapLinkStatus(
  userId: string
): Promise<PinballMapLinkStatus> {
  const row = await db.query.pinballmapUserCredentials.findFirst({
    where: eq(pinballmapUserCredentials.userId, userId),
    columns: { pbmUsername: true, needsRelinkAt: true },
  });
  if (!row) return { status: "not_linked" };
  return row.needsRelinkAt === null
    ? { status: "linked", username: row.pbmUsername }
    : { status: "needs_relink", username: row.pbmUsername };
}

/** Shape returned by `get_pinballmap_user_credentials()` (drizzle/0088). */
interface UserCredentialsRow {
  pbm_email: string | null;
  token: string | null;
  token_vault_id: string | null;
  needs_relink: boolean | null;
}

/**
 * The credential a push runs with: the member's email and decrypted token,
 * plus the Vault id they came from so a rejection marks exactly this link.
 */
export interface LinkedPinballMapCredentials {
  credentials: PbmCredentials;
  tokenVaultId: string;
}

/**
 * Decrypt the member's write credential for a push (8.2).
 *
 * Returns null when the member has not linked an account or the link is marked
 * Needs relink: a token Pinball Map has already rejected is not sent again
 * (8.5). A row whose Vault secret is missing is treated as not linked.
 *
 * SECURITY: server-only; returns secret material. Uses the service-role client
 * because the decrypt RPC is gated to service_role.
 */
export async function getLinkedPinballMapCredentials(
  userId: string
): Promise<LinkedPinballMapCredentials | null> {
  // CORE-ARCH-011: the Vault decrypt RPC is an external round-trip.
  assertNotInTransaction("getLinkedPinballMapCredentials");

  const supabase = createAdminClient();
  const response = (await supabase.rpc("get_pinballmap_user_credentials", {
    p_user_id: userId,
  })) as {
    data: UserCredentialsRow[] | null;
    error: { message: string } | null;
  };
  if (response.error) {
    throw new Error(
      `Failed to load Pinball Map credentials: ${response.error.message}`
    );
  }

  const row = response.data?.[0];
  if (!row?.pbm_email || !row.token || !row.token_vault_id) return null;
  if (row.needs_relink === true) return null;
  return {
    credentials: { email: row.pbm_email, token: row.token },
    tokenVaultId: row.token_vault_id,
  };
}

/**
 * Mark the link Needs relink after Pinball Map rejected a write as unauthorized
 * (8.5). Scoped to the Vault id the write used, so a relink that landed while
 * the write was in flight is not marked.
 */
export async function markPinballMapLinkNeedsRelink(
  userId: string,
  tokenVaultId: string
): Promise<void> {
  await db
    .update(pinballmapUserCredentials)
    .set({ needsRelinkAt: new Date() })
    .where(
      and(
        eq(pinballmapUserCredentials.userId, userId),
        eq(pinballmapUserCredentials.tokenVaultId, tokenVaultId)
      )
    );
}

export type LinkPinballMapResult =
  | { ok: true; username: string }
  | { ok: false; reason: PbmAuthFailureReason | "server"; message?: string };

/**
 * Exchange a Pinball Map login and password for the account's token and store
 * it as this member's link, replacing any earlier link (8.4).
 *
 * The password exists only in this call's arguments and the one request to
 * Pinball Map. Callers must not log it or keep it.
 */
export async function linkPinballMapAccount(
  userId: string,
  login: string,
  password: string
): Promise<LinkPinballMapResult> {
  assertNotInTransaction("linkPinballMapAccount");

  const client = await getPinballMapClient();
  const auth = await client.authDetails(login, password);
  if (!auth.ok) {
    return auth.message === undefined
      ? { ok: false, reason: auth.reason }
      : { ok: false, reason: auth.reason, message: auth.message };
  }

  // Held in an object field so flow analysis keeps `string | null` across the
  // awaited transaction (same idiom as the Discord token save).
  const orphan: { vaultId: string | null } = { vaultId: null };
  let replacedVaultId: string | null;

  try {
    const createdRows = (await db.execute(
      sql`SELECT vault.create_secret(${auth.token}, ${`pinballmap_user_token_${randomUUID()}`}, 'Pinball Map account token (linked by a member)') AS id`
    )) as { id: string }[];
    const createdId = createdRows[0]?.id;
    if (!createdId) throw new Error("Vault create_secret returned no id");
    orphan.vaultId = createdId;

    replacedVaultId = await db.transaction(async (tx) => {
      // Serialize concurrent links for one member, so each reads the pointer
      // the other committed and no replaced secret is left unreferenced.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`pinballmap_link:${userId}`}))`
      );
      const existing = await tx.query.pinballmapUserCredentials.findFirst({
        where: eq(pinballmapUserCredentials.userId, userId),
        columns: { tokenVaultId: true },
      });
      await tx
        .insert(pinballmapUserCredentials)
        .values({
          userId,
          pbmUsername: auth.username,
          pbmEmail: auth.email,
          tokenVaultId: createdId,
        })
        .onConflictDoUpdate({
          target: pinballmapUserCredentials.userId,
          set: {
            pbmUsername: auth.username,
            pbmEmail: auth.email,
            tokenVaultId: createdId,
            linkedAt: new Date(),
            needsRelinkAt: null,
          },
        });
      return existing?.tokenVaultId ?? null;
    });
    orphan.vaultId = null;
  } catch (error) {
    reportError(error, { action: "pinballmap.linkAccount", userId });
    if (orphan.vaultId !== null) {
      await deleteVaultSecret(orphan.vaultId, "pinballmap.linkAccount.cleanup");
    }
    return { ok: false, reason: "server" };
  }

  // The replaced secret is unreferenced once the swap commits.
  if (replacedVaultId !== null) {
    await deleteVaultSecret(replacedVaultId, "pinballmap.linkAccount.replaced");
  }
  return { ok: true, username: auth.username };
}

/**
 * Delete this member's link and its Vault secret (8.4). Pinball Map has no way
 * to revoke a token, so this removes PinPoint's copy only. Idempotent.
 */
export async function unlinkPinballMapAccount(userId: string): Promise<void> {
  assertNotInTransaction("unlinkPinballMapAccount");
  const deleted = await db
    .delete(pinballmapUserCredentials)
    .where(eq(pinballmapUserCredentials.userId, userId))
    .returning({ tokenVaultId: pinballmapUserCredentials.tokenVaultId });
  const vaultId = deleted[0]?.tokenVaultId;
  if (vaultId) await deleteVaultSecret(vaultId, "pinballmap.unlinkAccount");
}

/**
 * Best-effort delete of one Vault secret. supabase_vault 0.3.1 has no delete
 * helper, so this is a plain row DELETE, the same form drizzle/0059 and the
 * Discord token save use. A failure leaves a stray encrypted secret that no row
 * references; it is reported, not thrown.
 */
async function deleteVaultSecret(
  vaultId: string,
  action: string
): Promise<void> {
  try {
    await db.execute(
      sql`DELETE FROM vault.secrets WHERE id = ${vaultId}::uuid`
    );
  } catch (error) {
    reportError(error, { action, bestEffort: true, vaultId });
  }
}
