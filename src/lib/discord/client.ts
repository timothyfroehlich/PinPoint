import "server-only";
import { setTimeout } from "node:timers";
import { log } from "~/lib/logger";

const DISCORD_API = "https://discord.com/api/v10";

export type SendDmResult =
  | { ok: true }
  | {
      ok: false;
      reason: "blocked" | "rate_limited" | "transient" | "not_configured";
    };

export interface SendDmInput {
  botToken: string;
  discordUserId: string;
  content: string;
}

export async function sendDm(input: SendDmInput): Promise<SendDmResult> {
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
      body: JSON.stringify({ content }),
    });

  let res = await send();
  if (res.status === 429) {
    const retryAfterSec = parseRetryAfter(res);
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
    setTimeout(resolve, ms);
  });
}
