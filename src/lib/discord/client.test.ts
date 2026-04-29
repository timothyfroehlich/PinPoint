import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendDm } from "./client";

const ORIGINAL_FETCH = globalThis.fetch;

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function installFetchMock(handler: (call: FetchCall) => Response): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const call: FetchCall = { url, init };
    calls.push(call);
    return Promise.resolve(handler(call));
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.useRealTimers();
});

describe("sendDm", () => {
  it("opens a DM channel and posts a message — happy path", async () => {
    const calls = installFetchMock((call) => {
      if (call.url.endsWith("/users/@me/channels")) {
        return new Response(JSON.stringify({ id: "dm-chan-1" }), {
          status: 200,
        });
      }
      if (call.url.endsWith("/channels/dm-chan-1/messages")) {
        return new Response(JSON.stringify({ id: "msg-1" }), { status: 200 });
      }
      throw new Error(`unexpected url ${call.url}`);
    });

    const result = await sendDm({
      botToken: "bot-tok",
      discordUserId: "user-1",
      content: "hi",
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: "Bot bot-tok",
    });
  });

  it("retries once after a 429 honoring retry-after", async () => {
    let attempt = 0;
    installFetchMock((call) => {
      if (call.url.endsWith("/users/@me/channels")) {
        return new Response(JSON.stringify({ id: "dm-1" }), { status: 200 });
      }
      attempt += 1;
      if (attempt === 1) {
        return new Response(JSON.stringify({ retry_after: 0.05 }), {
          status: 429,
          headers: { "retry-after": "0.05" },
        });
      }
      return new Response(JSON.stringify({ id: "msg-1" }), { status: 200 });
    });

    const promise = sendDm({
      botToken: "t",
      discordUserId: "u",
      content: "hi",
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(await promise).toEqual({ ok: true });
    expect(attempt).toBe(2);
  });

  it("does not sleep on retry-after values above the inline retry budget", async () => {
    let messageAttempts = 0;
    installFetchMock((call) => {
      if (call.url.endsWith("/users/@me/channels")) {
        return new Response(JSON.stringify({ id: "dm-1" }), { status: 200 });
      }
      messageAttempts += 1;
      return new Response(JSON.stringify({ retry_after: 60 }), {
        status: 429,
        headers: { "retry-after": "60" },
      });
    });

    await expect(
      sendDm({
        botToken: "t",
        discordUserId: "u",
        content: "hi",
      })
    ).resolves.toEqual({ ok: false, reason: "rate_limited" });
    expect(messageAttempts).toBe(1);
  });

  it("returns reason='blocked' on 403 with Discord code 50007 (cannot DM user)", async () => {
    installFetchMock((call) =>
      call.url.endsWith("/users/@me/channels")
        ? new Response(
            JSON.stringify({ code: 50007, message: "Cannot send messages" }),
            { status: 403 }
          )
        : new Response("{}", { status: 200 })
    );
    const result = await sendDm({
      botToken: "t",
      discordUserId: "u",
      content: "hi",
    });
    expect(result).toEqual({ ok: false, reason: "blocked" });
  });

  it("returns reason='transient' on 403 with a non-50007 code (bot misconfig)", async () => {
    // 50001 = Missing Access — admin can fix, not the user's fault.
    installFetchMock((call) =>
      call.url.endsWith("/users/@me/channels")
        ? new Response(
            JSON.stringify({ code: 50001, message: "Missing Access" }),
            { status: 403 }
          )
        : new Response("{}", { status: 200 })
    );
    const result = await sendDm({
      botToken: "t",
      discordUserId: "u",
      content: "hi",
    });
    expect(result).toEqual({ ok: false, reason: "transient" });
  });

  it("returns reason='blocked' on 404 (DM channel does not exist)", async () => {
    installFetchMock((call) =>
      call.url.endsWith("/users/@me/channels")
        ? new Response("{}", { status: 404 })
        : new Response("{}", { status: 200 })
    );
    const result = await sendDm({
      botToken: "t",
      discordUserId: "u",
      content: "hi",
    });
    expect(result).toEqual({ ok: false, reason: "blocked" });
  });

  it("returns reason='transient' on network error", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new TypeError("network"))
    ) as typeof fetch;
    const result = await sendDm({
      botToken: "t",
      discordUserId: "u",
      content: "hi",
    });
    expect(result).toEqual({ ok: false, reason: "transient" });
  });

  it("returns reason='not_configured' when botToken is empty", async () => {
    const result = await sendDm({
      botToken: "",
      discordUserId: "u",
      content: "hi",
    });
    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });
});
