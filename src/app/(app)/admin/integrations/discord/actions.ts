"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { saveDiscordConfigSchema, validateServerIdSchema } from "./schema";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import { checkPermission } from "~/lib/permissions/helpers";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { getDiscordTokenForAdmin } from "~/lib/discord/config";

async function verifyIntegrationsAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const accessLevel = await getUserAccessLevel(user.id);
  if (!checkPermission("admin.integrations.manage", accessLevel)) {
    throw new Error(
      "Forbidden: You do not have permission to manage integrations"
    );
  }
  return { userId: user.id };
}

// ─── Validation primitives ─────────────────────────────────────────────

export type ValidateBotTokenResult =
  | { ok: true; botUsername: string }
  | {
      ok: false;
      reason: "not_configured" | "invalid_token" | "transient";
      status?: number;
    };

async function probeBotToken(token: string): Promise<ValidateBotTokenResult> {
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { username: string };
      return { ok: true, botUsername: body.username };
    }
    if (res.status === 401) {
      return { ok: false, reason: "invalid_token" };
    }
    return { ok: false, reason: "transient", status: res.status };
  } catch (error) {
    log.error(
      {
        action: "probeBotToken",
        err: error,
      },
      "Discord token validation failed"
    );
    return { ok: false, reason: "transient" };
  }
}

export type ValidateServerIdResult =
  | { ok: true; guildName?: string }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "not_member"
        | "invalid_token"
        | "invalid_input"
        | "transient";
      status?: number;
      message?: string;
    };

async function probeServerMembership(
  token: string,
  serverId: string
): Promise<ValidateServerIdResult> {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${serverId}`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { name?: string };
      return body.name ? { ok: true, guildName: body.name } : { ok: true };
    }
    if (res.status === 401) return { ok: false, reason: "invalid_token" };
    if (res.status === 404 || res.status === 403) {
      return { ok: false, reason: "not_member" };
    }
    return { ok: false, reason: "transient", status: res.status };
  } catch (error) {
    log.error(
      {
        action: "probeServerMembership",
        err: error,
      },
      "Discord server validation failed"
    );
    return { ok: false, reason: "transient" };
  }
}

/**
 * Resolve the bot token to validate against — typed value if present, else
 * the saved Vault token via getDiscordTokenForAdmin(). Returns null if
 * neither source has a token.
 *
 * Uses the admin-only accessor so a token remains available for validation
 * even when the notification server ID is not configured.
 */
async function resolveTokenForValidation(
  typed: string | undefined
): Promise<string | null> {
  if (typed && typed.length > 0) return typed;
  try {
    return await getDiscordTokenForAdmin();
  } catch (error) {
    log.error(
      {
        action: "resolveTokenForValidation",
        err: error,
      },
      "Failed to read saved Discord token from Vault"
    );
    return null;
  }
}

// ─── Public actions ────────────────────────────────────────────────────

/**
 * Validate-only: probe the bot token without writing anything.
 * Triggered by the inline "Validate" button on the bot-token field.
 */
export async function validateBotToken(
  formData: FormData
): Promise<ValidateBotTokenResult> {
  await verifyIntegrationsAdmin();

  const typedToken = formField(formData, "newToken").trim();
  const token = await resolveTokenForValidation(typedToken);
  if (!token) {
    return { ok: false, reason: "not_configured" };
  }

  return probeBotToken(token);
}

function formField(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/**
 * Validate-only: probe server membership without writing anything.
 * Triggered by the inline "Validate" button on the server-id field.
 */
export async function validateServerId(
  formData: FormData
): Promise<ValidateServerIdResult> {
  await verifyIntegrationsAdmin();

  const raw = {
    serverId: formField(formData, "guildId"),
    newToken: formField(formData, "newToken"),
  };
  const parsed = validateServerIdSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      reason: "invalid_input",
      message: firstIssue?.message ?? "Server ID is invalid.",
    };
  }

  const token = await resolveTokenForValidation(parsed.data.newToken);
  if (!token) {
    return { ok: false, reason: "not_configured" };
  }

  return probeServerMembership(token, parsed.data.serverId);
}

// ─── Save action ───────────────────────────────────────────────────────

export type SaveDiscordConfigResult =
  | { ok: true; botUsername?: string }
  | {
      ok: false;
      errors: {
        field: "newToken" | "guildId" | "inviteLink";
        message: string;
      }[];
    };

export async function saveDiscordConfigAction(
  _previousState: SaveDiscordConfigResult | undefined,
  formData: FormData
): Promise<SaveDiscordConfigResult> {
  return saveDiscordConfig(formData);
}

/**
 * Atomic save for the Discord admin form. Validates token and server
 * membership server-side before any DB write when a server ID is present.
 *
 * - `newToken`: empty/absent ⇒ no change. Non-empty ⇒ rotate to this value
 *   (validated against `/users/@me` first; rejected on 401).
 * - `guildId`: empty ⇒ turn off Discord notifications while retaining the
 *   shared token. Non-empty ⇒ validate against `/guilds/{id}`.
 * - `inviteLink`: optional, no Discord-side validation.
 */
export async function saveDiscordConfig(
  formData: FormData
): Promise<SaveDiscordConfigResult> {
  const { userId } = await verifyIntegrationsAdmin();

  const raw = {
    newToken: formField(formData, "newToken"),
    guildId: formField(formData, "guildId"),
    inviteLink: formField(formData, "inviteLink"),
  };
  const parsed = saveDiscordConfigSchema.safeParse(raw);
  if (!parsed.success) {
    type FieldName = "newToken" | "guildId" | "inviteLink";
    const isFieldName = (v: unknown): v is FieldName =>
      v === "newToken" || v === "guildId" || v === "inviteLink";
    const errors = parsed.error.issues.map((issue) => ({
      field: isFieldName(issue.path[0]) ? issue.path[0] : "guildId",
      message: issue.message,
    }));
    return { ok: false, errors };
  }

  const validated = parsed.data;
  const hasTypedNewToken =
    validated.newToken !== undefined && validated.newToken.length > 0;
  const hasGuildId = validated.guildId.length > 0;

  // Resolve the saved-or-typed token. With no token the saved server ID remains
  // partial configuration; with one, every save verifies that the chosen server
  // is reachable before the row can be treated as configured.
  const tokenForProbes = await resolveTokenForValidation(validated.newToken);
  if (hasTypedNewToken && !tokenForProbes) {
    return {
      ok: false,
      errors: [
        {
          field: "newToken",
          message:
            "Bot token is required. Paste one or seed via DISCORD_BOT_TOKEN.",
        },
      ],
    };
  }

  // A token-bearing save validates both the token and server membership before
  // it becomes usable as notification configuration.
  let probedBotUsername: string | undefined;
  if (tokenForProbes) {
    // Token rotation: probe the new typed value before committing to Vault.
    // When not rotating, the saved token's validity gets verified implicitly
    // by probeServerMembership (any 401 surfaces as `invalid_token`).
    if (hasTypedNewToken) {
      const tokenResult = await probeBotToken(tokenForProbes);
      if (!tokenResult.ok) {
        return {
          ok: false,
          errors: [
            {
              field: "newToken",
              message:
                tokenResult.reason === "invalid_token"
                  ? "Discord rejected this token. Generate a new one in the Developer Portal."
                  : "Discord didn't respond. Try again in a moment.",
            },
          ],
        };
      }
      probedBotUsername = tokenResult.botUsername;
    }

    const serverResult = hasGuildId
      ? await probeServerMembership(tokenForProbes, validated.guildId)
      : null;
    if (serverResult && !serverResult.ok) {
      // Field attribution matters because the form renders a per-field error.
      // - not_member / transient: about this guild → guildId.
      // - invalid_token: the token Discord rejected. Attach to newToken so
      //   the admin can fix it where the input lives. (Also handles the
      //   not-rotating path: the saved token is broken and they need to
      //   paste a fresh one.)
      if (serverResult.reason === "invalid_token") {
        return {
          ok: false,
          errors: [
            {
              field: "newToken",
              message:
                "Discord rejected the saved bot token while checking the server. Paste a fresh token from the Developer Portal.",
            },
          ],
        };
      }
      const message =
        serverResult.reason === "not_member"
          ? "Bot isn't a member of this server. Invite the bot first, then save again."
          : "Discord didn't respond while checking the server.";
      return {
        ok: false,
        errors: [{ field: "guildId", message }],
      };
    }
  }

  // Persist. Token rotation goes to Vault; everything else updates the
  // singleton row.
  //
  // CORE-ARCH-011: Supabase Vault mutations are an external,
  // non-transactional side effect — Vault lives in a separate schema with
  // its own SECURITY DEFINER scope, so vault.create_secret/update_secret do
  // NOT roll back with the Drizzle transaction on a client-side abort. We
  // therefore run the Vault RPCs (and the pre-read that decides create vs.
  // update) on the main connection BEFORE opening the transaction, and the
  // transaction itself does only Drizzle row writes.
  //
  // The catch block compensates the pre-transaction Vault write per path:
  //   - create: delete the freshly-created (now-orphaned) secret.
  //   - update (rotate in place): nothing to undo — see the note below.
  //
  // The pre-transaction read, both Vault RPCs, AND the transaction all run
  // inside ONE try, so the single catch (log + Sentry + structured
  // {ok:false} + create-path orphan cleanup) handles every failure: a Vault
  // RPC rejection (Vault down / permission / network), a malformed
  // create_secret result, the race-guard throw, or the pre-read failing.
  // Putting these outside the try would let those failures escape uncaught
  // to Next.js's generic error boundary — losing the Sentry signal and the
  // structured field error the form renders. A try is not a transaction, so
  // CORE-ARCH-011 still holds: the Vault RPCs stay OUTSIDE db.transaction.
  //
  // (The `orphanGuard` object holds the create-path vault id in a field so
  // TypeScript flow analysis preserves the `string | null` type across the
  // awaited transaction rather than narrowing it to a stale value.)
  const orphanGuard: { vaultId: string | null } = { vaultId: null };

  try {
    // Read the existing vault pointer up front (plain read) so we can decide
    // create-vs-update before opening the transaction. `newVaultId` is only
    // set on the create path; on the update path the row keeps the same id.
    const existing = await db.query.discordIntegrationConfig.findFirst({
      where: eq(discordIntegrationConfig.id, "singleton"),
      columns: { botTokenVaultId: true },
    });
    let newVaultId: string | null = null;

    if (hasTypedNewToken) {
      const newToken = validated.newToken ?? "";
      if (existing?.botTokenVaultId) {
        // Update path: rotate the secret in place on the main connection.
        // db.execute (raw SQL), not tx.execute — Vault must not live inside
        // the Drizzle transaction.
        await db.execute(
          sql`SELECT vault.update_secret(${existing.botTokenVaultId}::uuid, ${newToken}, 'discord_bot_token', 'Discord bot token (rotated via UI)')`
        );
      } else {
        const rows = (await db.execute(
          sql`SELECT vault.create_secret(${newToken}, 'discord_bot_token', 'Discord bot token (saved via UI)') AS id`
        )) as { id: string }[];
        const createdId = rows[0]?.id;
        if (!createdId) {
          // Residual we cannot compensate: if create_secret succeeded
          // server-side but this result read rejected/returned no id, we
          // have no id to delete — the orphan (if any) is
          // unrecoverable here. Throwing still routes through the catch for
          // the Sentry signal + structured error; orphanGuard.vaultId stays
          // null because there's nothing actionable to clean up.
          throw new Error("Vault create_secret returned no id");
        }
        newVaultId = createdId;
        orphanGuard.vaultId = createdId;
      }
    }

    await db.transaction(async (tx) => {
      // Drizzle row writes only — no external side effects in here.
      if (newVaultId) {
        // Create path: point the singleton at the freshly-created secret.
        // The WHERE clause guards against an admin race writing the
        // singleton's bot_token_vault_id between our pre-transaction read
        // and this UPDATE. If 0 rows are affected, the freshly-created
        // vault secret has no DB reference — throw so the catch block fires
        // and deletes the orphan.
        const updated = await tx
          .update(discordIntegrationConfig)
          .set({
            botTokenVaultId: newVaultId,
            updatedAt: new Date(),
            updatedBy: userId,
          })
          .where(
            and(
              eq(discordIntegrationConfig.id, "singleton"),
              isNull(discordIntegrationConfig.botTokenVaultId)
            )
          )
          .returning({ id: discordIntegrationConfig.id });
        if (updated.length === 0) {
          throw new Error(
            "Race: singleton row already has a bot_token_vault_id"
          );
        }
      }

      await tx
        .update(discordIntegrationConfig)
        .set({
          guildId: hasGuildId ? validated.guildId : null,
          inviteLink: validated.inviteLink === "" ? null : validated.inviteLink,
          // Expand/contract compatibility only. The current runtime uses
          // configuration presence; the previous deployment still reads this
          // column until the contract migration lands.
          enabled:
            Boolean(existing?.botTokenVaultId ?? newVaultId) && hasGuildId,
          ...(!hasGuildId && {
            botHealthStatus: "unknown" as const,
            lastBotCheckAt: null,
          }),
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(discordIntegrationConfig.id, "singleton"));
    });
  } catch (error) {
    log.error(
      {
        action: "saveDiscordConfig",
        userId,
        err: error,
      },
      "Failed to save Discord config"
    );
    // Surface to Sentry — admin save failures are user-facing incidents
    // (the action returns errors and the user sees a generic "try again",
    // so without Sentry we'd have no signal that anything broke).
    reportError(error, {
      action: "saveDiscordConfig",
      bestEffort: false,
      userId,
    });

    // Compensation is create-path-only by design:
    //   - Create path: a fresh vault secret was created pre-transaction but
    //     the row update rolled back, so the secret is orphaned (nothing in
    //     the DB references it). Delete it below.
    //   - Update path (rotate in place): there is NO deletable orphan. The
    //     singleton row keeps the same botTokenVaultId, so it still points
    //     at the (now-rotated) secret, and the previous plaintext is gone —
    //     vault.update_secret overwrites it irreversibly. Even if the config
    //     update rolls back, the rotation is intentional and self-consistent
    //     (the row → vault pointer is unchanged). Do NOT try to "undo" it.
    //     Hence orphanGuard.vaultId is only ever set on the create path.
    if (orphanGuard.vaultId) {
      try {
        // supabase_vault (0.3.1, the version running locally and in prod)
        // exposes exactly two public functions — create_secret and
        // update_secret. There is NO delete_secret at any version we run, so
        // deletion is a plain row DELETE against vault.secrets, the same form
        // migration 0059 uses. Scoped to the single id we just created: the
        // singleton's own (referenced) secret must never be touched.
        // Best-effort — a failure here just leaves a stray encrypted secret
        // in vault.secrets; the singleton row already isn't pointing at it.
        await db.execute(
          sql`DELETE FROM vault.secrets WHERE id = ${orphanGuard.vaultId}::uuid`
        );
      } catch (cleanupErr) {
        log.error(
          {
            action: "saveDiscordConfig.vaultCleanup",
            vaultId: orphanGuard.vaultId,
            err: cleanupErr,
          },
          "Failed to clean up orphaned vault secret"
        );
        // Orphaned vault secret is a separate-and-worse incident than the
        // original save failure — flag it explicitly so it doesn't get
        // lost in the noise.
        reportError(cleanupErr, {
          action: "saveDiscordConfig.vaultCleanup",
          bestEffort: true,
          vaultId: orphanGuard.vaultId,
        });
      }
    }

    return {
      ok: false,
      errors: [
        {
          field: "guildId",
          message: "Failed to save. Please try again.",
        },
      ],
    };
  }

  revalidatePath("/admin/integrations/discord");
  return probedBotUsername
    ? { ok: true, botUsername: probedBotUsername }
    : { ok: true };
}

export type ClearDiscordBotTokenResult =
  { ok: true } | { ok: false; message: string };

/**
 * Unlink the saved bot token before deleting its exact Vault secret.
 *
 * The unlink is the authoritative off switch and is guarded by the current
 * Vault id so a concurrent rotation cannot make us delete a newly-referenced
 * credential. Vault cleanup is best-effort after the integration is safely
 * unconfigured; a cleanup failure is reported without pretending the unlink
 * failed.
 */
export async function clearDiscordBotTokenAction(): Promise<ClearDiscordBotTokenResult> {
  const { userId } = await verifyIntegrationsAdmin();
  let existing: { botTokenVaultId: string | null } | undefined;
  try {
    existing = await db.query.discordIntegrationConfig.findFirst({
      where: eq(discordIntegrationConfig.id, "singleton"),
      columns: { botTokenVaultId: true },
    });
  } catch (error) {
    log.error(
      { action: "clearDiscordBotToken.read", userId, err: error },
      "Failed to read Discord bot token pointer"
    );
    reportError(error, {
      action: "clearDiscordBotToken.read",
      bestEffort: false,
      userId,
    });
    return { ok: false, message: "Failed to remove the token. Try again." };
  }
  const vaultId = existing?.botTokenVaultId;

  if (!vaultId) {
    await db
      .update(discordIntegrationConfig)
      .set({
        enabled: false,
        botHealthStatus: "unknown",
        lastBotCheckAt: null,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(discordIntegrationConfig.id, "singleton"));
    revalidatePath("/admin/integrations/discord");
    return { ok: true };
  }

  try {
    const unlinked = await db
      .update(discordIntegrationConfig)
      .set({
        botTokenVaultId: null,
        enabled: false,
        botHealthStatus: "unknown",
        lastBotCheckAt: null,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(discordIntegrationConfig.id, "singleton"),
          eq(discordIntegrationConfig.botTokenVaultId, vaultId)
        )
      )
      .returning({ id: discordIntegrationConfig.id });

    if (unlinked.length === 0) {
      return {
        ok: false,
        message: "The saved token changed. Refresh and try again.",
      };
    }
  } catch (error) {
    log.error(
      { action: "clearDiscordBotToken", userId, err: error },
      "Failed to unlink Discord bot token"
    );
    reportError(error, {
      action: "clearDiscordBotToken",
      bestEffort: false,
      userId,
    });
    return { ok: false, message: "Failed to remove the token. Try again." };
  }

  try {
    await db.execute(
      sql`DELETE FROM vault.secrets WHERE id = ${vaultId}::uuid`
    );
  } catch (error) {
    log.error(
      { action: "clearDiscordBotToken.vaultCleanup", vaultId, err: error },
      "Discord bot token was unlinked but Vault cleanup failed"
    );
    reportError(error, {
      action: "clearDiscordBotToken.vaultCleanup",
      bestEffort: true,
      vaultId,
    });
  }

  revalidatePath("/admin/integrations/discord");
  return { ok: true };
}
