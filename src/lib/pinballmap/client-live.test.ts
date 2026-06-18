import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLiveClient } from "./client-live";

const ORIGINAL_FETCH = globalThis.fetch;
const CREDS = { email: "tim@example.com", token: "secret-tok" };

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
    calls.push({ url, init });
    return Promise.resolve(handler({ url, init }));
  });
  return calls;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.useRealTimers();
});
beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("live client — reads", () => {
  it("fetchLocation hits the location endpoint and parses + filters lmxes", async () => {
    const calls = installFetchMock(() =>
      json({
        id: 26454,
        name: "APC",
        date_last_updated: "2026-06-01",
        last_updated_by_username: "qixx",
        machine_count: 2,
        location_machine_xrefs: [
          {
            id: 1,
            machine_id: 10,
            ic_enabled: null,
            deleted_at: null,
            last_updated_by_username: "qixx",
            machine_conditions: [
              {
                id: 100,
                comment: "loud",
                username: "qixx",
                created_at: "2026-05-01T00:00:00Z",
              },
            ],
          },
          // soft-deleted entries must be dropped from the snapshot
          {
            id: 2,
            machine_id: 11,
            deleted_at: "2026-04-01T00:00:00Z",
            machine_conditions: [],
          },
        ],
      })
    );

    const snap = await createLiveClient().fetchLocation(26454);
    expect(calls[0]?.url).toContain("/locations/26454.json");
    expect(calls[0]?.init?.headers).toMatchObject({
      "User-Agent": expect.any(String),
    });
    expect(snap.lmxes).toHaveLength(1);
    expect(snap.lmxes[0]?.conditions[0]?.id).toBe(100);
  });

  it("fetchLocation throws on a non-2xx so sync can record an error", async () => {
    installFetchMock(() => new Response(null, { status: 500 }));
    await expect(createLiveClient().fetchLocation(26454)).rejects.toThrow(
      /HTTP 500/
    );
  });

  it("fetchCatalog requests the full machines payload (no no_details)", async () => {
    const calls = installFetchMock(() =>
      json([
        {
          id: 7,
          name: "Godzilla",
          manufacturer: "Stern",
          year: 2021,
          ipdb_id: 6845,
        },
      ])
    );
    const catalog = await createLiveClient().fetchCatalog();
    expect(calls[0]?.url).toContain("/machines.json");
    expect(calls[0]?.url).not.toContain("no_details");
    expect(catalog[0]).toMatchObject({
      machineId: 7,
      name: "Godzilla",
      ipdbId: 6845,
    });
  });
});

describe("live client — auth", () => {
  it("authDetails returns token+username on success", async () => {
    installFetchMock(() =>
      json({ authentication_token: "abc", username: "tim" })
    );
    const res = await createLiveClient().authDetails("tim@example.com", "pw");
    expect(res).toEqual({ ok: true, token: "abc", username: "tim" });
  });

  it("authDetails maps 401 to invalid_credentials", async () => {
    installFetchMock(() => new Response(null, { status: 401 }));
    expect(await createLiveClient().authDetails("x", "y")).toEqual({
      ok: false,
      reason: "invalid_credentials",
    });
  });
});

describe("live client — writes", () => {
  it("addMachine POSTs with credentials + ids in the query and returns the new lmx id", async () => {
    const calls = installFetchMock(() => json({ id: 555 }, 200));
    const res = await createLiveClient().addMachine({
      credentials: CREDS,
      locationId: 26454,
      machineId: 10,
    });
    expect(res).toEqual({ ok: true, lmxId: 555 });
    const url = new URL(calls[0]?.url ?? "");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(url.pathname).toContain("/location_machine_xrefs.json");
    expect(url.searchParams.get("user_email")).toBe(CREDS.email);
    expect(url.searchParams.get("user_token")).toBe(CREDS.token);
    expect(url.searchParams.get("location_id")).toBe("26454");
    expect(url.searchParams.get("machine_id")).toBe("10");
  });

  it("postCondition PUTs the condition to the lmx endpoint", async () => {
    const calls = installFetchMock(() => json({}, 200));
    const res = await createLiveClient().postCondition({
      credentials: CREDS,
      lmxId: 42,
      comment: "fixed flippers",
    });
    expect(res).toEqual({ ok: true });
    const url = new URL(calls[0]?.url ?? "");
    expect(calls[0]?.init?.method).toBe("PUT");
    expect(url.pathname).toContain("/location_machine_xrefs/42.json");
    expect(url.searchParams.get("condition")).toBe("fixed flippers");
  });

  it("confirmLineup PUTs the confirm endpoint", async () => {
    const calls = installFetchMock(() => json({}, 200));
    await createLiveClient().confirmLineup({
      credentials: CREDS,
      locationId: 26454,
    });
    expect(new URL(calls[0]?.url ?? "").pathname).toContain(
      "/locations/26454/confirm.json"
    );
  });

  it("classifies write failures: 401->unauthorized, 404->not_found", async () => {
    installFetchMock(() => new Response(null, { status: 401 }));
    expect(
      await createLiveClient().removeMachine({ credentials: CREDS, lmxId: 1 })
    ).toEqual({ ok: false, reason: "unauthorized" });

    installFetchMock(() => new Response(null, { status: 404 }));
    expect(
      await createLiveClient().removeMachine({ credentials: CREDS, lmxId: 1 })
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("retries a write once after a 429 within budget", async () => {
    vi.useFakeTimers();
    let attempt = 0;
    installFetchMock(() => {
      attempt += 1;
      return attempt === 1
        ? new Response(null, {
            status: 429,
            headers: { "retry-after": "0.05" },
          })
        : json({}, 200);
    });
    const promise = createLiveClient().postCondition({
      credentials: CREDS,
      lmxId: 9,
      comment: "x",
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(await promise).toEqual({ ok: true });
    expect(attempt).toBe(2);
  });

  it("reports rate_limited when retry-after exceeds the inline budget", async () => {
    installFetchMock(
      () =>
        new Response(null, { status: 429, headers: { "retry-after": "9999" } })
    );
    expect(
      await createLiveClient().postCondition({
        credentials: CREDS,
        lmxId: 9,
        comment: "x",
      })
    ).toEqual({ ok: false, reason: "rate_limited" });
  });
});
