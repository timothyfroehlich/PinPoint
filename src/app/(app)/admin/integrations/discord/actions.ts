"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { discordIntegrationConfig, userProfiles } from "~/server/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { saveDiscordConfigSchema, validateServerIdSchema } from "./schema";
import { log } from "~/lib/logger";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getDiscordConfig } from "~/lib/discord/config";

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
  | { ok: true }
  | {
      ok: false;
      reason: "not_configured" | "not_member" | "invalid_token" | "transient";
      status?: number;
    };

async function probeServerMembership(
  token: string,
  serverId: string
): Promise<ValidateServerIdResult> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${serverId}/members/@me`,
      { headers: { Authorization: `Bot ${token}` } }
    );
    if (res.ok) return { ok: true };
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
 * the saved Vault token via getDiscordConfig(). Returns null if neither
 * source has a token.
 */
async function resolveTokenForValidation(
  typed: string | undefined
): Promise<string | null> {
  if (typed && typed.length > 0) return typed;
  const config = await getDiscordConfig();
  return config?.botToken ?? null;
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
    return { ok: false, reason: "transient" };
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
 * - `guildId`: required and validated against `/guilds/{id}/members/@me`.
 *   Hard-required to pass — saves are rejected if the bot isn't in the
 *   server.
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

  // Resolve which token to validate against. If a new value was typed, that
  // takes precedence; otherwise re-validate the existing Vault token.
  const tokenForCheck = await resolveTokenForValidation(validated.newToken);
  if (!tokenForCheck) {
    return {
      ok: false,
      errors: [
        {
          field: "newToken",
          message:
            "Bot token is required. Paste a token to set up the integration.",
        },
      ],
    };
  }

  // Cannot enable without a token in either form or DB. (The client UI
  // already gates the switch; this is the server-side mirror.)
  if (validated.enabled && !tokenForCheck) {
    return {
      ok: false,
      errors: [
        {
          field: "newToken",
          message: "Cannot enable the integration without a bot token.",
        },
      ],
    };
  }

  // 1) Token check
  const tokenResult = await probeBotToken(tokenForCheck);
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

  // 2) Server membership check (hard-required)
  const serverResult = await probeServerMembership(
    tokenForCheck,
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

  // 3) Persist. Token rotation goes to Vault; everything else updates the
  //    singleton row in one transaction.
  try {
    await db.transaction(async (tx) => {
      const existing = await tx.query.discordIntegrationConfig.findFirst({
        where: eq(discordIntegrationConfig.id, "singleton"),
        columns: { botTokenVaultId: true },
      });

      // Rotate Vault if a new token was provided.
      if (validated.newToken && validated.newToken.length > 0) {
        if (existing?.botTokenVaultId) {
          await tx.execute(
            sql`SELECT vault.update_secret(${existing.botTokenVaultId}::uuid, ${validated.newToken}, 'discord_bot_token', 'Discord bot token (rotated via UI)')`
          );
        } else {
          const rows = (await tx.execute(
            sql`SELECT vault.create_secret(${validated.newToken}, 'discord_bot_token', 'Discord bot token (saved via UI)') AS id`
          )) as { id: string }[];
          const newVaultId = rows[0]?.id;
          if (!newVaultId) {
            throw new Error("Vault create_secret returned no id");
          }
          await tx
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
            );
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
  return { ok: true, botUsername: tokenResult.botUsername };
}
