import "server-only";
import { sql } from "drizzle-orm";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import { db } from "~/server/db";

/**
 * Store a secret in Supabase Vault and return its id.
 *
 * Callers must not run this inside a transaction (CORE-ARCH-011): Vault writes
 * do not roll back with it.
 *
 * SECURITY: a failed query must not carry the secret into Sentry or the logs.
 * Drizzle wraps driver errors in a DrizzleQueryError whose message embeds every
 * bound parameter, and here the first parameter is the plaintext secret. So the
 * error is replaced with one that keeps only the driver's own message, which
 * names the failure but never echoes parameter values.
 */
export async function createVaultSecret(
  secret: string,
  name: string,
  description: string
): Promise<string> {
  let rows: unknown;
  try {
    rows = await db.execute(
      sql`SELECT vault.create_secret(${secret}, ${name}, ${description}) AS id`
    );
  } catch (error) {
    // eslint-disable-next-line preserve-caught-error -- the caught error's message holds the plaintext secret; dropping it is the point.
    throw new Error(`Vault create_secret failed: ${driverMessage(error)}`);
  }
  const first: unknown = Array.isArray(rows) ? rows[0] : undefined;
  const id =
    typeof first === "object" && first !== null && "id" in first
      ? first.id
      : undefined;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Vault create_secret returned no id");
  }
  return id;
}

/**
 * Best-effort delete of one Vault secret, for a secret nothing references any
 * more (replaced, unlinked, or orphaned by a failed save).
 *
 * supabase_vault 0.3.1 (local and prod) has no delete_secret, so this is a
 * plain row DELETE, the same form migration 0059 uses. A failure leaves a stray
 * encrypted secret that no row points at: it is logged and reported, never
 * thrown, so the caller's own outcome stands. `action` names the call site in
 * both.
 */
export async function deleteVaultSecret(
  vaultId: string,
  action: string
): Promise<void> {
  try {
    await db.execute(
      sql`DELETE FROM vault.secrets WHERE id = ${vaultId}::uuid`
    );
  } catch (error) {
    log.error(
      { action, vaultId, err: error },
      "Vault secret cleanup failed; an unreferenced secret is left behind"
    );
    reportError(error, { action, bestEffort: true, vaultId });
  }
}

/** The driver error under Drizzle's wrapper, whose own message has no params. */
function driverMessage(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error) return cause.message;
  return "query failed";
}
