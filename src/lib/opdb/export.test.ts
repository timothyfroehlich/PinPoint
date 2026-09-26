import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchOpdbExport,
  MIN_EXPORT_MACHINES,
  OPDB_EXPORT_URL,
} from "./export";

const ORIGINAL_FETCH = globalThis.fetch;

function entries(count: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({
    opdbId: `G${String(i)}-M${String(i)}`,
    name: `Machine ${String(i)}`,
    type: "ss",
    display: "dmd",
    playerCount: 4,
    people: [],
  }));
}

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

describe("fetchOpdbExport", () => {
  it("downloads and parses the export", async () => {
    const seen = mockFetch(
      new Response(JSON.stringify({ entries: entries(MIN_EXPORT_MACHINES) }), {
        status: 200,
      })
    );
    const machines = await fetchOpdbExport();
    expect(seen.url).toBe(OPDB_EXPORT_URL);
    expect(machines).toHaveLength(MIN_EXPORT_MACHINES);
  });

  it("throws on an HTTP failure", async () => {
    mockFetch(new Response("nope", { status: 503 }));
    await expect(fetchOpdbExport()).rejects.toThrow(/HTTP 503/);
  });

  it("refuses an implausibly small export", async () => {
    mockFetch(
      new Response(JSON.stringify({ entries: entries(5) }), { status: 200 })
    );
    await expect(fetchOpdbExport()).rejects.toThrow(/only 5 machines/);
  });
});
