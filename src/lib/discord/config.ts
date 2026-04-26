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
 */
/** Trimmed env value, or null if undefined / empty. */
function envOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

interface DiscordConfigRow {
  enabled: boolean;
  guild_id: string | null;
  invite_link: string | null;
  bot_token: string | null;
  bot_health_status: "unknown" | "healthy" | "degraded";
  last_bot_check_at: string | null;
  updated_at: string;
}

export async function getDiscordConfig(): Promise<DiscordConfig | null> {
  // Dev convenience: when DISCORD_BOT_TOKEN is set in env, skip the DB
  // round-trip and return a synthetic config built from env vars. This
  // lets new worktrees pick up Discord credentials automatically without
  // an admin re-paste through /admin/integrations/discord. Production
  // never sets this env var, so the DB path still owns config there.
  const envToken = process.env["DISCORD_BOT_TOKEN"]?.trim();
  if (envToken) {
    return {
      enabled: true,
      guildId: envOrNull(process.env["DISCORD_GUILD_ID"]),
      inviteLink: envOrNull(process.env["DISCORD_INVITE_LINK"]),
      botToken: envToken,
      botHealthStatus: "unknown",
      lastBotCheckAt: null,
      updatedAt: new Date(),
    };
  }

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

  const rows = response.data ?? [];
  const row = rows[0];
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
