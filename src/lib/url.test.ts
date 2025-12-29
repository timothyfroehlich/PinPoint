import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("requireSiteUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns NEXT_PUBLIC_SITE_URL if set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");

    // Dynamic import AFTER stubbing env vars
    const { requireSiteUrl } = await import("./url");

    expect(requireSiteUrl("test")).toBe("https://example.com");
  });

  it("returns VERCEL_URL if set and NEXT_PUBLIC_SITE_URL is missing", async () => {
    // Explicitly unstub env vars that might be set from .env.local
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    vi.stubEnv("PORT", undefined);
    vi.stubEnv("VERCEL_URL", "my-app.vercel.app");

    const { requireSiteUrl } = await import("./url");

    expect(requireSiteUrl("test")).toBe("https://my-app.vercel.app");
  });

  it("returns localhost fallback if nothing is set in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    vi.stubEnv("VERCEL_URL", undefined);
    vi.stubEnv("PORT", "3000");

    const { requireSiteUrl } = await import("./url");

    expect(requireSiteUrl("test")).toBe("http://localhost:3000");
  });

  it("throws error in production if nothing is set (new behavior)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    vi.stubEnv("VERCEL_URL", undefined);
    vi.stubEnv("PORT", "3000");

    const { requireSiteUrl } = await import("./url");

    expect(() => requireSiteUrl("test")).toThrowError(
      /Configuration Error: NEXT_PUBLIC_SITE_URL is missing/
    );
  });
});
