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
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("VERCEL_URL", "my-app.vercel.app");

    const { requireSiteUrl } = await import("./url");

    expect(requireSiteUrl("test")).toBe("https://my-app.vercel.app");
  });

  it("prefers VERCEL_BRANCH_URL on preview deploys over NEXT_PUBLIC_SITE_URL", async () => {
    // Simulates the Vercel-inheritance pitfall: prod-scoped NEXT_PUBLIC_SITE_URL
    // leaks into preview, but we don't want OAuth redirects landing on prod.
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", "pinpoint-git-feat-x-advacar.vercel.app");
    vi.stubEnv("VERCEL_URL", "pinpoint-abc123-advacar.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pinpoint.apc.example");

    const { requireSiteUrl } = await import("./url");

    expect(requireSiteUrl("test")).toBe(
      "https://pinpoint-git-feat-x-advacar.vercel.app"
    );
  });

  it("falls back to VERCEL_URL on preview when VERCEL_BRANCH_URL is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", undefined);
    vi.stubEnv("VERCEL_URL", "pinpoint-abc123-advacar.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pinpoint.apc.example");

    const { requireSiteUrl } = await import("./url");

    expect(requireSiteUrl("test")).toBe(
      "https://pinpoint-abc123-advacar.vercel.app"
    );
  });

  it("uses NEXT_PUBLIC_SITE_URL on production deploys (not the Vercel URL)", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_BRANCH_URL", "pinpoint-git-main-advacar.vercel.app");
    vi.stubEnv("VERCEL_URL", "pinpoint-xyz-advacar.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pinpoint.apc.example");

    const { requireSiteUrl } = await import("./url");

    expect(requireSiteUrl("test")).toBe("https://pinpoint.apc.example");
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

  it("omits ?next= for the root path (login default is better than landing page)", async () => {
    const { getLoginUrl } = await import("./url");
    expect(getLoginUrl("/")).toBe("/login");
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
