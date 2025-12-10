import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveRequestUrl } from "~/lib/url";

function createMockHeaders(record: Record<string, string>): Headers {
  return {
    get: (key: string) => record[key.toLowerCase()] ?? null,
    keys: () => Object.keys(record)[Symbol.iterator](),
  } as unknown as Headers;
}

describe("resolveRequestUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  it("constructs URL from host header and default http protocol", () => {
    const headers = createMockHeaders({ host: "localhost:3000" });
    expect(resolveRequestUrl(headers)).toBe("http://localhost:3000");
  });

  it("respects x-forwarded-proto for https", () => {
    const headers = createMockHeaders({
      host: "example.com",
      "x-forwarded-proto": "https",
    });

    expect(resolveRequestUrl(headers)).toBe("https://example.com");
  });

  it("prioritizes x-forwarded-host over host header (proxy support)", () => {
    const headers = createMockHeaders({
      host: "internal-proxy:8080",
      "x-forwarded-host": "public-site.com",
      "x-forwarded-proto": "https",
    });

    expect(resolveRequestUrl(headers)).toBe("https://public-site.com");
  });

  it("prioritizes NEXT_PUBLIC_SITE_URL if set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://canonical.com";

    const headers = createMockHeaders({ host: "ignored.com" });

    expect(resolveRequestUrl(headers)).toBe("https://canonical.com");
  });
});
