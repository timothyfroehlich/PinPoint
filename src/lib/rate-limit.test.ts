import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit coverage for the shared rate-limit checker factory (PP-ql95).
 *
 * The six exported checkers are built from one `makeLimitChecker` factory, so
 * these tests exercise the behavior the factory centralizes — lazy limiter
 * init, the Redis-unconfigured fallback, fail-closed-in-prod / fail-open-in-dev
 * semantics, IP "unknown" handling, and email lowercasing — through a
 * representative checker of each key type.
 */

const { limitMock, ctorMock } = vi.hoisted(() => ({
  limitMock: vi.fn(),
  ctorMock: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Imported by the module for getClientIp; never exercised here.
vi.mock("next/headers", () => ({ headers: vi.fn() }));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    constructor(_opts: unknown) {
      void _opts;
    }
  },
}));

vi.mock("@upstash/ratelimit", () => {
  class MockRatelimit {
    static slidingWindow = vi.fn(() => ({ kind: "sliding" }));
    static fixedWindow = vi.fn(() => ({ kind: "fixed" }));
    limit = limitMock;
    constructor(_opts: unknown) {
      void _opts;
      ctorMock();
    }
  }
  return { Ratelimit: MockRatelimit };
});

function stubRedisConfigured(): void {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://real-instance.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  vi.stubEnv("KV_REST_API_URL", undefined);
  vi.stubEnv("KV_REST_API_TOKEN", undefined);
}

function stubRedisUnconfigured(): void {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
  vi.stubEnv("KV_REST_API_URL", undefined);
  vi.stubEnv("KV_REST_API_TOKEN", undefined);
}

function stubProduction(): void {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("NODE_ENV", "production");
}

function stubDevelopment(): void {
  vi.stubEnv("VERCEL_ENV", undefined);
  vi.stubEnv("NODE_ENV", "development");
}

describe("rate-limit checker factory", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    limitMock.mockReset();
    ctorMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes email keys to lowercase before calling the limiter", async () => {
    stubRedisConfigured();
    stubProduction();
    limitMock.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 999,
    });

    const { checkLoginAccountLimit } = await import("./rate-limit");
    const result = await checkLoginAccountLimit("USER@Example.COM");

    expect(limitMock).toHaveBeenCalledWith("user@example.com");
    expect(result).toEqual({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 999,
    });
  });

  it("does not apply IP 'unknown' handling to email checkers", async () => {
    stubRedisConfigured();
    stubProduction();
    limitMock.mockResolvedValue({
      success: true,
      limit: 3,
      remaining: 2,
      reset: 0,
    });

    const { checkLoginAccountLimit } = await import("./rate-limit");
    await checkLoginAccountLimit("unknown");

    // Email path treats "unknown" as an ordinary key, not the IP fallback.
    expect(limitMock).toHaveBeenCalledWith("unknown");
  });

  it("uses the shared fallback key for an unknown IP in production", async () => {
    stubRedisConfigured();
    stubProduction();
    limitMock.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 0,
    });

    const { checkLoginIpLimit } = await import("./rate-limit");
    await checkLoginIpLimit("unknown");

    expect(limitMock).toHaveBeenCalledWith("unknown-ip-fallback");
  });

  it("skips the limit (fail-open) for an unknown IP in development", async () => {
    stubRedisConfigured();
    stubDevelopment();

    const { checkSignupLimit } = await import("./rate-limit");
    const result = await checkSignupLimit("unknown");

    expect(result).toEqual({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    });
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("fails closed in production when Redis is unconfigured", async () => {
    stubRedisUnconfigured();
    stubProduction();

    const before = Date.now();
    const { checkPublicIssueLimit } = await import("./rate-limit");
    const result = await checkPublicIssueLimit("1.2.3.4");

    expect(result.success).toBe(false);
    expect(result.limit).toBe(0);
    expect(result.remaining).toBe(0);
    expect(result.reset).toBeGreaterThanOrEqual(before + 300_000);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("fails open in development when Redis is unconfigured", async () => {
    stubRedisUnconfigured();
    stubDevelopment();

    const { checkForgotPasswordLimit } = await import("./rate-limit");
    const result = await checkForgotPasswordLimit("user@example.com");

    expect(result).toEqual({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    });
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("fails closed in production when the limiter throws", async () => {
    stubRedisConfigured();
    stubProduction();
    limitMock.mockRejectedValue(new Error("redis down"));

    const before = Date.now();
    const { checkLoginIpLimit } = await import("./rate-limit");
    const result = await checkLoginIpLimit("1.2.3.4");

    expect(result.success).toBe(false);
    expect(result.reset).toBeGreaterThanOrEqual(before + 300_000);
  });

  it("passes the limiter's own result through on success", async () => {
    stubRedisConfigured();
    stubProduction();
    limitMock.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: 42,
    });

    const { checkPublicIssueLimit } = await import("./rate-limit");
    const result = await checkPublicIssueLimit("1.2.3.4");

    expect(result).toEqual({
      success: false,
      limit: 5,
      remaining: 0,
      reset: 42,
    });
  });

  it("logs the shared fallback key (not the raw 'unknown') when an unknown IP throws in production", async () => {
    stubRedisConfigured();
    stubProduction();
    limitMock.mockRejectedValue(new Error("redis down"));

    const { checkLoginIpLimit } = await import("./rate-limit");
    const { log } = await import("~/lib/logger");
    await checkLoginIpLimit("unknown");

    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "unknown-ip-fallback" }),
      "Login IP rate limit check failed"
    );
  });

  it("logs the masked original-case email (not the lowercased key) when an email checker throws", async () => {
    stubRedisConfigured();
    stubProduction();
    limitMock.mockRejectedValue(new Error("redis down"));

    const { checkLoginAccountLimit } = await import("./rate-limit");
    const { log } = await import("~/lib/logger");
    const { maskEmail } = await import("~/lib/logging/mask");
    await checkLoginAccountLimit("USER@Example.COM");

    // maskEmail keeps the first three chars: "USE***" proves the original
    // (non-lowercased) input was passed, and that the log message label is correct.
    expect(maskEmail("USER@Example.COM")).toBe("USE***");
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ email: "USE***" }),
      "Login account rate limit check failed"
    );
  });

  it("constructs each checker's limiter at most once across repeated calls (closure memoization)", async () => {
    stubRedisConfigured();
    stubProduction();
    limitMock.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 0,
    });

    const { checkLoginIpLimit } = await import("./rate-limit");
    await checkLoginIpLimit("1.2.3.4");
    await checkLoginIpLimit("5.6.7.8");

    // One Ratelimit constructed for the single checker, despite two calls.
    expect(ctorMock).toHaveBeenCalledTimes(1);
  });
});
