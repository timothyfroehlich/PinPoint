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

describe("isInternalUrl", () => {
  it("returns true for valid internal paths", async () => {
    const { isInternalUrl } = await import("./url");
    expect(isInternalUrl("/")).toBe(true);
    expect(isInternalUrl("/dashboard")).toBe(true);
    expect(isInternalUrl("/m/ABC")).toBe(true);
    expect(isInternalUrl("/settings?param=value")).toBe(true);
  });

  it("returns false for external URLs", async () => {
    const { isInternalUrl } = await import("./url");
    expect(isInternalUrl("https://example.com")).toBe(false);
    expect(isInternalUrl("http://example.com")).toBe(false);
    expect(isInternalUrl("//example.com")).toBe(false);
  });

  it("returns false for null, undefined, or empty string", async () => {
    const { isInternalUrl } = await import("./url");
    expect(isInternalUrl(null)).toBe(false);
    expect(isInternalUrl(undefined)).toBe(false);
    expect(isInternalUrl("")).toBe(false);
  });
});

describe("getLoginUrl", () => {
  it("builds login URL for a basic path", async () => {
    const { getLoginUrl } = await import("./url");
    expect(getLoginUrl("/settings")).toBe("/login?next=%2Fsettings");
  });

  it("encodes query params in the return path", async () => {
    const { getLoginUrl } = await import("./url");
    expect(getLoginUrl("/report?machine=TA")).toBe(
      "/login?next=%2Freport%3Fmachine%3DTA"
    );
  });

  it("handles the root path", async () => {
    const { getLoginUrl } = await import("./url");
    expect(getLoginUrl("/")).toBe("/login?next=%2F");
  });
});

describe("getSafeRedirect", () => {
  it("returns the URL if it is internal", async () => {
    const { getSafeRedirect } = await import("./url");
    expect(getSafeRedirect("/settings")).toBe("/settings");
  });

  it("returns the fallback if URL is external", async () => {
    const { getSafeRedirect } = await import("./url");
    expect(getSafeRedirect("https://example.com")).toBe("/dashboard");
  });

  it("returns a custom fallback if provided", async () => {
    const { getSafeRedirect } = await import("./url");
    expect(getSafeRedirect("https://example.com", "/custom")).toBe("/custom");
  });

  it("returns the fallback if URL is null/undefined", async () => {
    const { getSafeRedirect } = await import("./url");
    expect(getSafeRedirect(null)).toBe("/dashboard");
    expect(getSafeRedirect(undefined)).toBe("/dashboard");
  });
});
