import "server-only";
import { DISCORD_API, DISCORD_TIMEOUT_MS } from "~/lib/discord/api";
import { safeFetch } from "~/lib/http/external";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import { assertNotInTransaction } from "~/server/db/transaction-context";

/**
 * Stored status of an admin-configured Discord channel (region alerts §3.2,
 * reused by the activity summary §2.7).
 */
export type DiscordChannelStatus =
  | "not_configured"
  | "posting"
  | "cant_post"
  | "couldnt_check"
  | "needs_discord";

export interface DiscordChannelCheck {
  status: Exclude<DiscordChannelStatus, "not_configured">;
  statusDetail: string | null;
}

/** SEND_MESSAGES is permission bit 11. */
const SEND_MESSAGES = 1n << 11n;
/** Guild category (4) and forum (15) channels cannot take a plain message. */
const NON_TEXT_CHANNEL_TYPES = new Set([4, 15]);

/**
 * Best-effort save-time check that the bot can post to a channel
 * (region alerts §2.3). Only a real post proves it; this reads the channel
 * and the bot's computed permissions when Discord returns them.
 */
export async function checkDiscordChannel(
  botToken: string | null,
  channelId: string
): Promise<DiscordChannelCheck> {
  if (!botToken) {
    return {
      status: "needs_discord",
      statusDetail: "Discord bot token not configured",
    };
  }
  assertNotInTransaction("checkDiscordChannel");

  try {
    // A network failure or timeout comes back as a 599, which lands in the
    // 5xx branch below with the same verdict the catch gives.
    const res = await safeFetch(
      `${DISCORD_API}/channels/${channelId}`,
      { headers: { Authorization: `Bot ${botToken}` } },
      {
        timeoutMs: DISCORD_TIMEOUT_MS,
        networkErrorLog: {
          fields: { action: "checkDiscordChannel" },
          message: "Discord channel check failed",
        },
      }
    );
    if (res.status === 401) {
      return {
        status: "needs_discord",
        statusDetail: "Discord bot token is invalid",
      };
    }
    if (res.status === 403 || res.status === 404) {
      return {
        status: "cant_post",
        statusDetail: "Channel not found or bot lacks access",
      };
    }
    if (res.status === 429 || res.status >= 500) {
      return {
        status: "couldnt_check",
        statusDetail: "Discord was unreachable",
      };
    }
    if (!res.ok) {
      return {
        status: "couldnt_check",
        statusDetail: "Discord returned an unexpected response",
      };
    }
    const body = (await res.json()) as { permissions?: string; type?: number };
    if (body.type !== undefined && NON_TEXT_CHANNEL_TYPES.has(body.type)) {
      return {
        status: "cant_post",
        statusDetail: "Selected channel cannot receive direct text messages",
      };
    }
    if (
      body.permissions !== undefined &&
      (BigInt(body.permissions) & SEND_MESSAGES) === 0n
    ) {
      return {
        status: "cant_post",
        statusDetail: "Bot missing Send Messages permission in this channel",
      };
    }
    return { status: "posting", statusDetail: null };
  } catch (err) {
    log.warn(
      { err, action: "checkDiscordChannel" },
      "Discord channel check failed"
    );
    reportError(err, { action: "checkDiscordChannel", bestEffort: true });
    return { status: "couldnt_check", statusDetail: "Discord was unreachable" };
  }
}

/** The channel's name for a test-message confirmation; undefined on any failure. */
export async function fetchDiscordChannelName(
  botToken: string,
  channelId: string
): Promise<string | undefined> {
  assertNotInTransaction("fetchDiscordChannelName");
  try {
    // No network-error log: this name is optional decoration, and a failure
    // here has never been logged.
    const res = await safeFetch(
      `${DISCORD_API}/channels/${channelId}`,
      { headers: { Authorization: `Bot ${botToken}` } },
      { timeoutMs: DISCORD_TIMEOUT_MS }
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as { name?: string };
    // An empty name is no better than none for the confirmation line.
    if (!body.name) return undefined;
    return body.name;
  } catch {
    return undefined;
  }
}
