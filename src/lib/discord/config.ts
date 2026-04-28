import "server-only";
import { createAdminClient } from "~/lib/supabase/admin";

/**
 * Discord integration configuration, as loaded by `getDiscordConfig()`.
 *
 * Returned only when the integration is enabled AND a bot token is set.
 * Otherwise callers receive `null` and should treat the integration as
 * unavailable (skip channel registration, disable admin UI sections, etc.).
 */
export interface DiscordConfig {
  enabled: true;
  guildId: string | null;
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
 * - `enabled` is false
 * - Bot token is not yet set
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
  enabled: boolean;
  guild_id: string | null;
  invite_link: string | null;
  bot_token: string | null;
  bot_health_status: "unknown" | "healthy" | "degraded";
  last_bot_check_at: string | null;
  updated_at: string;
}

async function fetchDiscordConfigRow(): Promise<DiscordConfigRow | null> {
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
  if (!row || !row.enabled || !row.bot_token) {
    return null;
  }

  return {
    enabled: true,
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
 * Admin-only accessor: returns the saved bot token regardless of the
 * `enabled` flag. Used by the admin Validate buttons so an admin can probe
 * the saved token before flipping the integration on (the chicken-and-egg:
 * env-seeded token + integration starts disabled → admin must validate to
 * enable, but old getDiscordConfig() refused to surface the token until
 * enabled was already true).
 *
 * SECURITY: Same as getDiscordConfig — server-only; uses the service-role
 * client to decrypt the Vault secret. Callers must have already checked
 * the admin permission via verifyIntegrationsAdmin().
 */
export async function getDiscordTokenForAdmin(): Promise<string | null> {
  const row = await fetchDiscordConfigRow();
  return row?.bot_token ?? null;
}
