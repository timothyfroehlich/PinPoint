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
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    vi.stubEnv("VERCEL_URL", undefined);
    vi.stubEnv("PORT", "3000");

    const { requireSiteUrl } = await import("./url");

    expect(() => requireSiteUrl("test")).toThrowError(
      /Configuration Error: NEXT_PUBLIC_SITE_URL is missing/
    );
  });

  it("refuses a localhost site URL on the Vercel production deployment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

    const { requireSiteUrl } = await import("./url");

    expect(() => requireSiteUrl("test")).toThrowError(
      /Configuration Error: NEXT_PUBLIC_SITE_URL is missing/
    );
  });

  it("allows localhost for a local production build run as a development deployment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    vi.stubEnv("VERCEL_URL", undefined);
    vi.stubEnv("PORT", "3000");

    const { requireSiteUrl } = await import("./url");

    expect(requireSiteUrl("test")).toBe("http://localhost:3000");
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

  // Each of these resolves to another host when a browser follows it as a
  // Location header: "\" reads as "/", and tabs/newlines are stripped.
  it.each([
    "/\\evil.example",
    "/\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
  ])("returns false for off-site path %j", async (url) => {
    const { isInternalUrl } = await import("./url");
    expect(isInternalUrl(url)).toBe(false);
  });

  it.each(["/\u0000/dashboard", "/\u007F/dashboard", "/\u0085/dashboard"])(
    "returns false for a path with control characters %j",
    async (url) => {
      const { isInternalUrl } = await import("./url");
      expect(isInternalUrl(url)).toBe(false);
    }
  );

  it.each(["/issues?q=left flipper", "/\u3000/dashboard"])(
    "accepts a same-origin path with a space %j",
    async (url) => {
      const { isInternalUrl } = await import("./url");
      expect(isInternalUrl(url)).toBe(true);
    }
  );

  it.each([
    "next=/%5Cevil.example",
    "next=/%5C%5Cevil.example",
    "next=/%09/evil.example",
    "next=/%0A/evil.example",
  ])("returns false for the decoded query string %s", async (query) => {
    const { isInternalUrl } = await import("./url");
    expect(isInternalUrl(new URLSearchParams(query).get("next"))).toBe(false);
  });

  it("accepts a percent-encoded backslash, which stays in the path", async () => {
    const { isInternalUrl } = await import("./url");
    expect(isInternalUrl("/%5Cevil.example")).toBe(true);
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

  it("returns the fallback for a backslash path that resolves off-site", async () => {
    const { getSafeRedirect } = await import("./url");
    expect(getSafeRedirect("/\\evil.example")).toBe("/dashboard");
  });
});
