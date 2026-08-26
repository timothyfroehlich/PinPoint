import "server-only";
import { createAdminClient } from "~/lib/supabase/admin";
import { assertNotInTransaction } from "~/server/db/transaction-context";

/**
 * Discord integration configuration, as loaded by `getDiscordConfig()`.
 *
 * Returned only when the integration has both required configuration values.
 * Otherwise callers receive `null` and should treat the integration as
 * unavailable (skip channel registration, disable admin UI sections, etc.).
 */
export interface DiscordConfig {
  guildId: string;
  inviteLink: string | null;
  botToken: string;
  botHealthStatus: "unknown" | "healthy" | "degraded";
  lastBotCheckAt: Date | null;
  updatedAt: Date;
}

/**
 * Fetches Discord integration config, including the decrypted bot token
 * from Supabase Vault.
 *
 * Returns null when:
 * - No config row exists (shouldn't happen — migration seeds one)
 * - Bot token or server ID is not yet set
 *
 * SECURITY: This accessor MUST be called only from server code. It uses
 * the service-role Supabase client and exposes secret material. The
 * "server-only" import above guards against accidental client imports.
 *
 * Source of truth is the database. Env vars (DISCORD_BOT_TOKEN, etc.) are
 * consumed by the seed pipeline (supabase/seed-discord.mjs) on first install
 * and are never read at runtime.
 */
interface DiscordConfigRow {
  guild_id: string | null;
  invite_link: string | null;
  bot_token: string | null;
  bot_health_status: "unknown" | "healthy" | "degraded";
  last_bot_check_at: string | null;
  updated_at: string;
}

async function fetchDiscordConfigRow(): Promise<DiscordConfigRow | null> {
  // CORE-ARCH-011 tripwire: the Vault decrypt RPC is an external round-trip and
  // must run before opening a transaction, never inside one (the Doodle Bug,
  // PP-2053). The issue services already fetch channels pre-transaction.
  assertNotInTransaction("getDiscordConfig");

  const supabase = createAdminClient();
  // The `get_discord_config` RPC is defined in 0028_natural_vengeance.sql but
  // is not present in Supabase's generated types. Cast the response to the
  // shape the SQL function returns.
  const response = (await supabase.rpc("get_discord_config")) as {
    data: DiscordConfigRow[] | null;
    error: { message: string } | null;
  };

  if (response.error) {
    throw new Error(`Failed to load Discord config: ${response.error.message}`);
  }

  return response.data?.[0] ?? null;
}

export async function getDiscordConfig(): Promise<DiscordConfig | null> {
  const row = await fetchDiscordConfigRow();
  if (!row?.bot_token || !row.guild_id) {
    return null;
  }

  return {
    guildId: row.guild_id,
    inviteLink: row.invite_link,
    botToken: row.bot_token,
    botHealthStatus: row.bot_health_status,
    lastBotCheckAt: row.last_bot_check_at
      ? new Date(row.last_bot_check_at)
      : null,
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Returns the saved bot token without requiring the Discord server ID. This is
 * for independently configured consumers, such as region alerts, which use a
 * Discord channel rather than the notification guild.
 *
 * SECURITY: Same as getDiscordConfig — server-only; uses the service-role
 * client to decrypt the Vault secret. Callers must have already checked
 * the admin permission via verifyIntegrationsAdmin().
 */
export async function getDiscordBotToken(): Promise<string | null> {
  const row = await fetchDiscordConfigRow();
  return row?.bot_token ?? null;
}

/** Admin validation keeps its intent-specific name at the call site. */
export const getDiscordTokenForAdmin = getDiscordBotToken;

/**
 * Lightweight boolean accessor: is the Discord integration configured?
 *
 * Reads `guild_id` and `bot_token_vault_id` directly from the singleton
 * row instead of going through `get_discord_config()` — that RPC always
 * decrypts the Vault secret, which is unnecessary when the caller only
 * needs to decide whether to render Discord-related UI. Use this on hot
 * paths like the `/settings` server component.
 *
 * Returns false on any error (missing env vars, transient RPC failure, etc.)
 * so a misconfigured Discord integration can't break unrelated pages.
 */
export async function isDiscordIntegrationConfigured(): Promise<boolean> {
  // CORE-ARCH-011 tripwire: this function issues a Supabase HTTP round-trip and
  // must not run inside a DB transaction. See getDiscordConfig() above for the
  // same guard applied to the full Vault-decrypt path. (PP-lbqh)
  assertNotInTransaction("isDiscordIntegrationConfigured");
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("discord_integration_config")
      .select("guild_id, bot_token_vault_id")
      .eq("id", "singleton")
      .maybeSingle();
    if (error || !data) return false;
    return Boolean(data.guild_id && data.bot_token_vault_id);
  } catch {
    return false;
  }
}
