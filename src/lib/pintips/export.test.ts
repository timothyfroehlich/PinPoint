import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPinTipsExport, PINTIPS_EXPORT_URL } from "./export";

const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(response: Response): { url: string | undefined } {
  const seen: { url: string | undefined } = { url: undefined };
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    seen.url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    return Promise.resolve(response);
  });
  return seen;
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("fetchPinTipsExport", () => {
  it("requests the export URL", async () => {
    const seen = mockFetch(new Response("[]", { status: 200 }));
    await expect(fetchPinTipsExport()).rejects.toThrow(/only 0 usable tips/);
    expect(seen.url).toBe(PINTIPS_EXPORT_URL);
  });

  it("throws on an HTTP failure", async () => {
    mockFetch(new Response("nope", { status: 503 }));
    await expect(fetchPinTipsExport()).rejects.toThrow(/HTTP 503/);
  });

  it("throws on a network failure", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new TypeError("fetch failed"))
    );
    await expect(fetchPinTipsExport()).rejects.toThrow(
      /network error or timeout/
    );
  });
});
