import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requireSiteUrl } from "./url";

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

  it("returns NEXT_PUBLIC_SITE_URL if set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    expect(requireSiteUrl("test")).toBe("https://example.com");
  });

  it("returns VERCEL_URL if set and NEXT_PUBLIC_SITE_URL is missing", () => {
    vi.stubEnv("VERCEL_URL", "my-app.vercel.app");
    expect(requireSiteUrl("test")).toBe("https://my-app.vercel.app");
  });

  it("returns localhost fallback if nothing is set in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(requireSiteUrl("test")).toBe("http://localhost:3000");
  });

  it("throws error in production if nothing is set (new behavior)", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;

    expect(() => requireSiteUrl("test")).toThrowError(
      /Configuration Error: NEXT_PUBLIC_SITE_URL is missing/
    );
  });
});
