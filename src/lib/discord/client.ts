import "server-only";
import { DISCORD_API, DISCORD_TIMEOUT_MS } from "~/lib/discord/api";
import {
  safeFetch as externalFetch,
  withRetryAfter,
} from "~/lib/http/external";
import { log } from "~/lib/logger";
import { assertNotInTransaction } from "~/server/db/transaction-context";

/**
 * Outcome of any Discord message send.
 *
 * `blocked` means Discord refused this destination for a reason retrying will not
 * fix: for a DM, the recipient has DMs off or blocked the bot; for a channel, the
 * bot is not in the guild, cannot see the channel, or the channel is gone.
 */
export type DiscordSendResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "blocked"
        | "rate_limited"
        | "transient"
        | "not_configured"
        | "no_shared_server";
      /**
       * Set on a 401: Discord rejected the bot token itself, which a channel
       * status reports as Needs Discord rather than Can't post (region alerts
       * §3.2, discord-activity-summary §2.7).
       */
      invalidToken?: true;
    };

/** Historical alias — `sendDm`'s return type. */
export type SendDmResult = DiscordSendResult;

export interface SendDmInput {
  botToken: string;
  discordUserId: string;
  content: string;
}

/** Discord Message Flags (https://discord.com/developers/docs/resources/channel#message-object-message-flags) */
export const DISCORD_MESSAGE_FLAGS = {
  /** Do not include any embeds when serializing this message. */
  SUPPRESS_EMBEDS: 1 << 2, // 4
} as const;

export interface PostChannelMessageInput {
  botToken: string;
  /** Discord channel snowflake to post into. */
  channelId: string;
  content: string;
  /** Optional message flags (e.g. `DISCORD_MESSAGE_FLAGS.SUPPRESS_EMBEDS`). */
  flags?: number;
}

/**
 * Post a message to a Discord channel the bot can see.
 *
 * Distinct from `sendDm` only in the destination: a DM needs a channel opened for
 * the recipient first, a guild channel is already addressable. Everything after
 * that — auth header, `allowed_mentions: { parse: [] }`, the single in-budget 429
 * retry, error classification — is the same code path, so a fix to any of it
 * applies to both.
 *
 * Used by the PinballMap region machine-change alert (PP-o355.18,
 * PP-o355.51.9), which broadcasts a public fact to one operator-chosen channel
 * rather than DM-ing every member.
 */
export async function postChannelMessage(
  input: PostChannelMessageInput
): Promise<DiscordSendResult> {
  // CORE-ARCH-011 tripwire: same rule as DMs — the HTTP call goes out post-commit,
  // never inside a transaction (the Doodle Bug, PP-2053).
  assertNotInTransaction("postChannelMessage");

  if (!input.botToken || !input.channelId) {
    return { ok: false, reason: "not_configured" };
  }

  return postMessage(
    input.botToken,
    input.channelId,
    input.content,
    input.flags
  );
}

export async function sendDm(input: SendDmInput): Promise<SendDmResult> {
  // CORE-ARCH-011 tripwire: Discord DMs go out post-commit, never inside a
  // transaction (the Doodle Bug, PP-2053).
  assertNotInTransaction("sendDm");

  if (!input.botToken) return { ok: false, reason: "not_configured" };

  const channel = await openDmChannel(input.botToken, input.discordUserId);
  if (!channel.ok) return channel.result;

  return postMessage(
    input.botToken,
    channel.channelId,
    input.content,
    DISCORD_MESSAGE_FLAGS.SUPPRESS_EMBEDS
  );
}

async function openDmChannel(
  botToken: string,
  recipientId: string
): Promise<
  { ok: true; channelId: string } | { ok: false; result: SendDmResult }
> {
  const res = await safeFetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: authHeaders(botToken),
    body: JSON.stringify({ recipient_id: recipientId }),
  });
  if (!res.ok) return { ok: false, result: await classify(res) };

  const json = (await res.json()) as { id?: string };
  if (!json.id)
    return { ok: false, result: { ok: false, reason: "transient" } };
  return { ok: true, channelId: json.id };
}

async function postMessage(
  botToken: string,
  channelId: string,
  content: string,
  flags?: number
): Promise<SendDmResult> {
  const payload: Record<string, unknown> = {
    content,
    allowed_mentions: { parse: [] },
  };
  if (flags !== undefined) {
    payload["flags"] = flags;
  }

  const send = (): Promise<Response> =>
    safeFetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: authHeaders(botToken),
      // allowed_mentions: { parse: [] } is defense-in-depth: even if our
      // sanitize() escape ever regresses, Discord refuses to resolve any
      // user/role/everyone mention. Costs nothing and prevents accidental
      // @everyone fan-outs from user-supplied issue titles/comments.
      body: JSON.stringify(payload),
    });

  const sent = await withRetryAfter(send, (retryAfterSec) => {
    log.warn(
      {
        retryAfterSec,
        action: "sendDm.rateLimit",
      },
      "Discord retry-after exceeds inline retry budget"
    );
  });
  if (sent.rateLimited) return { ok: false, reason: "rate_limited" };
  const res = sent.response;
  if (!res.ok) return classify(res);
  return { ok: true };
}

/**
 * 403 codes that mean "retrying will not fix this" rather than "try again later".
 *
 * - `50007` "Cannot send messages to this user" — the recipient has DMs disabled,
 *   blocked the bot, or shares no server with it.
 * - `50001` "Missing Access" / `50013` "Missing Permissions" — the bot cannot see
 *   or post in the target channel.
 *
 * The permission pair used to be classified `transient`, on the reasoning that an
 * admin can fix a misconfiguration so we may as well retry. That is exactly
 * backwards for a channel post on a schedule: `postChannelMessage` backs the
 * hourly PinballMap region alert, where `transient` means the job warns once an
 * hour forever, queues rows that never drain, and spends PBM requests on each
 * attempt — while `blocked` is reported to Sentry so someone actually fixes it.
 * Retrying does not summon the admin; surfacing the failure does.
 *
 * No behavior change on the DM path *today*: `dispatch.ts` collapses every
 * non-`skipped` failure into one warn line (dispatch.ts:~382), so `blocked` and
 * `transient` are indistinguishable to a DM caller as the code stands. That is a
 * property of the current consumer, not an invariant of this classifier — a
 * future retry/replay queue that treats `transient` as "try again later" would
 * make missing-access DMs stop retrying. Whoever adds that distinction owns
 * re-checking this mapping for the DM path.
 */
const DISCORD_ERROR_CANNOT_DM_USER = 50007;
const DISCORD_ERROR_MISSING_ACCESS = 50001;
const DISCORD_ERROR_MISSING_PERMISSIONS = 50013;
const DISCORD_ERROR_NO_SHARED_SERVER = 50278;
const PERMANENT_403_CODES: readonly number[] = [
  DISCORD_ERROR_CANNOT_DM_USER,
  DISCORD_ERROR_MISSING_ACCESS,
  DISCORD_ERROR_MISSING_PERMISSIONS,
];

async function classify(res: Response): Promise<SendDmResult> {
  if (res.status === 404) return { ok: false, reason: "blocked" };
  if (res.status === 403) {
    const code = await readDiscordErrorCode(res);
    if (code === DISCORD_ERROR_NO_SHARED_SERVER) {
      return { ok: false, reason: "no_shared_server" };
    }
    return code !== null && PERMANENT_403_CODES.includes(code)
      ? { ok: false, reason: "blocked" }
      : { ok: false, reason: "transient" };
  }
  if (res.status === 429) return { ok: false, reason: "rate_limited" };
  // Any other 4xx is a client error retrying cannot fix — a malformed channel id
  // (400), a bad bot token (401), a resource that isn't there. Same argument as
  // the permanent-403 codes above: on the scheduled `postChannelMessage` path a
  // `transient` verdict means the hourly job warns forever and never reaches
  // Sentry, so nobody learns the channel is misconfigured. `blocked` surfaces it.
  // 429 is handled above; 5xx and the synthetic 599 (network failure) fall
  // through to `transient`, where retrying genuinely can recover.
  if (res.status === 401) {
    return { ok: false, reason: "blocked", invalidToken: true };
  }
  if (res.status >= 400 && res.status < 500) {
    return { ok: false, reason: "blocked" };
  }
  log.warn(
    { status: res.status, action: "sendDm.classify" },
    "Discord API non-2xx"
  );
  return { ok: false, reason: "transient" };
}

async function readDiscordErrorCode(res: Response): Promise<number | null> {
  try {
    const body = (await res.json()) as { code?: number };
    return typeof body.code === "number" ? body.code : null;
  } catch {
    return null;
  }
}

function safeFetch(url: string, init: RequestInit): Promise<Response> {
  return externalFetch(url, init, {
    timeoutMs: DISCORD_TIMEOUT_MS,
    networkErrorLog: {
      fields: { url, action: "sendDm.fetch" },
      message: "Discord fetch failed",
    },
  });
}

function authHeaders(botToken: string): Record<string, string> {
  return {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };
}
