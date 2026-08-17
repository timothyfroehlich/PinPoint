import "server-only";
import { log } from "~/lib/logger";
import { assertNotInTransaction } from "~/server/db/transaction-context";

const DISCORD_API = "https://discord.com/api/v10";
const MAX_RETRY_AFTER_SECONDS = 5;

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
      reason: "blocked" | "rate_limited" | "transient" | "not_configured";
    };

/** Historical alias — `sendDm`'s return type. */
export type SendDmResult = DiscordSendResult;

export interface SendDmInput {
  botToken: string;
  discordUserId: string;
  content: string;
}

export interface PostChannelMessageInput {
  botToken: string;
  /** Discord channel snowflake to post into. */
  channelId: string;
  content: string;
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
 * Used by the PinballMap region new-machine alert (PP-o355.18), which broadcasts
 * a public fact to one operator-chosen channel rather than DM-ing every member.
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

  return postMessage(input.botToken, input.channelId, input.content);
}

export async function sendDm(input: SendDmInput): Promise<SendDmResult> {
  // CORE-ARCH-011 tripwire: Discord DMs go out post-commit, never inside a
  // transaction (the Doodle Bug, PP-2053).
  assertNotInTransaction("sendDm");

  if (!input.botToken) return { ok: false, reason: "not_configured" };

  const channel = await openDmChannel(input.botToken, input.discordUserId);
  if (!channel.ok) return channel.result;

  return postMessage(input.botToken, channel.channelId, input.content);
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
  content: string
): Promise<SendDmResult> {
  const send = (): Promise<Response> =>
    safeFetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: authHeaders(botToken),
      // allowed_mentions: { parse: [] } is defense-in-depth: even if our
      // sanitize() escape ever regresses, Discord refuses to resolve any
      // user/role/everyone mention. Costs nothing and prevents accidental
      // @everyone fan-outs from user-supplied issue titles/comments.
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });

  let res = await send();
  if (res.status === 429) {
    const retryAfterSec = parseRetryAfter(res);
    if (retryAfterSec > MAX_RETRY_AFTER_SECONDS) {
      log.warn(
        {
          retryAfterSec,
          action: "sendDm.rateLimit",
        },
        "Discord retry-after exceeds inline retry budget"
      );
      return { ok: false, reason: "rate_limited" };
    }
    await sleep(retryAfterSec * 1000);
    res = await send();
    if (res.status === 429) return { ok: false, reason: "rate_limited" };
  }
  if (!res.ok) return classify(res);
  return { ok: true };
}

/**
 * Discord error code 50007: "Cannot send messages to this user". Returned
 * when the recipient has DMs disabled, blocked the bot, or doesn't share a
 * server with the bot. Other 403s (e.g., 50001 "Missing Access") indicate
 * bot misconfiguration that an admin can fix — those are transient from
 * our perspective.
 */
const DISCORD_ERROR_CANNOT_DM_USER = 50007;

async function classify(res: Response): Promise<SendDmResult> {
  if (res.status === 404) return { ok: false, reason: "blocked" };
  if (res.status === 403) {
    const code = await readDiscordErrorCode(res);
    return code === DISCORD_ERROR_CANNOT_DM_USER
      ? { ok: false, reason: "blocked" }
      : { ok: false, reason: "transient" };
  }
  if (res.status === 429) return { ok: false, reason: "rate_limited" };
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

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    log.warn({ err, url, action: "sendDm.fetch" }, "Discord fetch failed");
    return new Response(null, { status: 599 });
  }
}

function authHeaders(botToken: string): Record<string, string> {
  return {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };
}

function parseRetryAfter(res: Response): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const n = Number.parseFloat(header);
    if (Number.isFinite(n)) return n;
  }
  return 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
