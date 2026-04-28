"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { discordIntegrationConfig, userProfiles } from "~/server/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { saveDiscordConfigSchema, validateServerIdSchema } from "./schema";
import { log } from "~/lib/logger";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getDiscordTokenForAdmin } from "~/lib/discord/config";

async function verifyIntegrationsAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);
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
        error: error instanceof Error ? error.message : "Unknown",
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
        error: error instanceof Error ? error.message : "Unknown",
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
 * Uses the admin-only accessor so a saved-but-disabled integration's token
 * is still surfaced for validation. (Validating before enabling is the whole
 * point of the chicken-and-egg flow: env-seeded → admin validates → enables.)
 */
async function resolveTokenForValidation(
  typed: string | undefined
): Promise<string | null> {
  if (typed && typed.length > 0) return typed;
  return getDiscordTokenForAdmin();
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

/**
 * Atomic save for the Discord admin form. Validates token and server
 * membership server-side before any DB write. Both must pass.
 *
 * - `newToken`: empty/absent ⇒ no change. Non-empty ⇒ rotate to this value
 *   (validated against `/users/@me` first; rejected on 401).
 * - `guildId`: required and validated against `/guilds/{id}` (Bot-token
 *   endpoint). Hard-required to pass — saves are rejected if the bot
 *   isn't in the server.
 * - `inviteLink`: optional, no Discord-side validation.
 * - `enabled`: written through; the form-level disable rule (no token →
 *   switch greyed out) is enforced on the client and re-checked here.
 */
export async function saveDiscordConfig(
  formData: FormData
): Promise<SaveDiscordConfigResult> {
  const { userId } = await verifyIntegrationsAdmin();

  const raw = {
    enabled: formData.get("enabled") === "true",
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

  // Resolve the saved-or-typed token. Only required if we're enabling (the
  // server can save a disabled config without any token at all) or if the
  // admin typed a new token to rotate.
  let tokenForProbes: string | null = null;
  if (validated.enabled || hasTypedNewToken) {
    tokenForProbes = await resolveTokenForValidation(validated.newToken);
    if (validated.enabled && !tokenForProbes) {
      return {
        ok: false,
        errors: [
          {
            field: "newToken",
            message:
              "Bot token is required to enable the integration. Paste one or seed via DISCORD_BOT_TOKEN.",
          },
        ],
      };
    }
  }

  // Discord-side probes only run when enabling. Saving as disabled never
  // calls Discord — admins can fix a broken config without needing the bot
  // online or in the right server.
  let probedBotUsername: string | undefined;
  if (validated.enabled && tokenForProbes) {
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

    const serverResult = await probeServerMembership(
      tokenForProbes,
      validated.guildId
    );
    if (!serverResult.ok) {
      let message: string;
      switch (serverResult.reason) {
        case "not_member":
          message =
            "Bot isn't a member of this server. Invite the bot first, then save again.";
          break;
        case "invalid_token":
          message = "Discord rejected the token while checking the server.";
          break;
        default:
          message = "Discord didn't respond while checking the server.";
      }
      return {
        ok: false,
        errors: [{ field: "guildId", message }],
      };
    }
  }

  // Persist. Token rotation goes to Vault; everything else updates the
  // singleton row.
  //
  // Atomicity note: vault.create_secret + the Drizzle row update are not
  // guaranteed to roll back together (Vault lives in a separate schema
  // with its own SECURITY DEFINER scope). On a partial failure we
  // explicitly delete the freshly-created vault secret in the catch block
  // to avoid orphans. (The closure mutates `orphanGuard.vaultId` so
  // TypeScript flow analysis preserves the `string | null` type after
  // the awaited transaction.)
  const orphanGuard: { vaultId: string | null } = { vaultId: null };
  try {
    await db.transaction(async (tx) => {
      const existing = await tx.query.discordIntegrationConfig.findFirst({
        where: eq(discordIntegrationConfig.id, "singleton"),
        columns: { botTokenVaultId: true },
      });

      if (hasTypedNewToken) {
        const newToken = validated.newToken ?? "";
        if (existing?.botTokenVaultId) {
          await tx.execute(
            sql`SELECT vault.update_secret(${existing.botTokenVaultId}::uuid, ${newToken}, 'discord_bot_token', 'Discord bot token (rotated via UI)')`
          );
        } else {
          const rows = (await tx.execute(
            sql`SELECT vault.create_secret(${newToken}, 'discord_bot_token', 'Discord bot token (saved via UI)') AS id`
          )) as { id: string }[];
          const newVaultId = rows[0]?.id;
          if (!newVaultId) {
            throw new Error("Vault create_secret returned no id");
          }
          orphanGuard.vaultId = newVaultId;

          // The WHERE clause guards against an admin race writing the
          // singleton's bot_token_vault_id between our SELECT and this
          // UPDATE. If 0 rows are affected, the freshly-created vault
          // secret has no DB reference — throw so the catch block fires
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
      }

      await tx
        .update(discordIntegrationConfig)
        .set({
          enabled: validated.enabled,
          guildId: validated.guildId,
          inviteLink: validated.inviteLink === "" ? null : validated.inviteLink,
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
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Failed to save Discord config"
    );

    if (orphanGuard.vaultId) {
      try {
        await db.execute(
          sql`SELECT vault.delete_secret(${orphanGuard.vaultId}::uuid)`
        );
      } catch (cleanupErr) {
        log.error(
          {
            action: "saveDiscordConfig.vaultCleanup",
            vaultId: orphanGuard.vaultId,
            error: cleanupErr instanceof Error ? cleanupErr.message : "Unknown",
          },
          "Failed to clean up orphaned vault secret"
        );
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
