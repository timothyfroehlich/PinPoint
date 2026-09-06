import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";

/**
 * Unit coverage for the shared rate-limit checker factory (PP-ql95).
 *
 * The seven exported checkers are built from one `makeLimitChecker` factory, so
 * these tests exercise the behavior the factory centralizes — lazy limiter
 * init, the Redis-unconfigured fallback, fail-closed-in-prod / fail-open-in-dev
 * semantics, IP "unknown" handling, and email lowercasing — through a
 * representative checker of each key type.
 */

const { limitMock, ctorMock, slidingWindowMock, fixedWindowMock } = vi.hoisted(
  () => ({
    limitMock: vi.fn(),
    ctorMock: vi.fn(),
    slidingWindowMock: vi.fn(() => ({ kind: "sliding" })),
    fixedWindowMock: vi.fn(() => ({ kind: "fixed" })),
  })
);

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
    static slidingWindow = slidingWindowMock;
    static fixedWindow = fixedWindowMock;
    limit = limitMock;
    constructor(options: unknown) {
      ctorMock(options);
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
    vi.clearAllMocks();
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

describe("formatResetTime", () => {
  it("returns 'now' for timestamps in the past or present", async () => {
    const { formatResetTime } = await import("./rate-limit");
    expect(formatResetTime(Date.now() - 5000)).toBe("now");
    expect(formatResetTime(Date.now())).toBe("now");
  });

  it("formats seconds correctly for diff < 60s", async () => {
    const { formatResetTime } = await import("./rate-limit");
    const now = Date.now();
    expect(formatResetTime(now + 1000)).toBe("1 second");
    expect(formatResetTime(now + 15_000)).toBe("15 seconds");
  });

  it("formats minutes correctly for diff < 60m", async () => {
    const { formatResetTime } = await import("./rate-limit");
    const now = Date.now();
    expect(formatResetTime(now + 65_000)).toBe("2 minutes");
    expect(formatResetTime(now + 5 * 60_000)).toBe("5 minutes");
  });

  it("formats hours correctly for diff >= 60m", async () => {
    const { formatResetTime } = await import("./rate-limit");
    const now = Date.now();
    expect(formatResetTime(now + 60 * 60_000)).toBe("1 hour");
    expect(formatResetTime(now + 2 * 60 * 60_000)).toBe("2 hours");
  });
});

describe("rate-limit module — environment isolation & limiter behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Pin ambient env vars to prevent real Upstash credentials from leaking (CORE-TEST-006)
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("checkAuthenticatedIssueLimit", () => {
    it("allows requests when Redis is not configured in development/test", async () => {
      const { checkAuthenticatedIssueLimit } = await import("./rate-limit");
      const result = await checkAuthenticatedIssueLimit("user-uuid-123");
      expect(result).toEqual({
        success: true,
        limit: 0,
        remaining: 0,
        reset: 0,
      });
      expect(ctorMock).not.toHaveBeenCalled();
    });

    it("fails closed when Redis is not configured in production", async () => {
      vi.stubEnv("VERCEL_ENV", "production");
      const { checkAuthenticatedIssueLimit } = await import("./rate-limit");

      const before = Date.now();
      const result = await checkAuthenticatedIssueLimit("user-uuid-123");
      const after = Date.now();

      expect(result.success).toBe(false);
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
      // Fail-closed result uses a 5-minute cooldown (300,000 ms)
      expect(result.reset).toBeGreaterThanOrEqual(before + 300_000);
      expect(result.reset).toBeLessThanOrEqual(after + 300_000);
    });

    it("configures the 20/15m sliding window and keys on userId when Redis is configured", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token-secret");

      limitMock.mockResolvedValueOnce({
        success: true,
        limit: 20,
        remaining: 19,
        reset: 1700000000000,
      });

      const { checkAuthenticatedIssueLimit } = await import("./rate-limit");
      const result = await checkAuthenticatedIssueLimit("user-tech-789");

      // Verify sliding window configuration: 20 requests per 15 minutes
      expect(slidingWindowMock).toHaveBeenCalledWith(20, "15 m");
      expect(ctorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: "ratelimit:report:user",
          analytics: true,
        })
      );

      // Verify the limit call is keyed to the sha256 hash of the userId (CORE-SEC-007)
      const expectedKey = createHash("sha256")
        .update("user-tech-789", "utf8")
        .digest("hex");
      expect(limitMock).toHaveBeenCalledWith(expectedKey);
      expect(result).toEqual({
        success: true,
        limit: 20,
        remaining: 19,
        reset: 1700000000000,
      });
    });

    it("returns rate-limited result when limit is exceeded", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token-secret");

      limitMock.mockResolvedValueOnce({
        success: false,
        limit: 20,
        remaining: 0,
        reset: 1700000900000,
      });

      const { checkAuthenticatedIssueLimit } = await import("./rate-limit");
      const result = await checkAuthenticatedIssueLimit("user-tech-789");

      expect(result).toEqual({
        success: false,
        limit: 20,
        remaining: 0,
        reset: 1700000900000,
      });
    });

    it("fails closed in production when the Redis limiter call throws", async () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token-secret");

      limitMock.mockRejectedValueOnce(new Error("Upstash connection timeout"));

      const { checkAuthenticatedIssueLimit } = await import("./rate-limit");
      const before = Date.now();
      const result = await checkAuthenticatedIssueLimit("user-tech-789");

      expect(result.success).toBe(false);
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.reset).toBeGreaterThanOrEqual(before + 300_000);
    });

    it("logs only a pseudonymous key prefix when the limiter throws", async () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token-secret");
      limitMock.mockRejectedValueOnce(new Error("Upstash connection timeout"));

      const userId = "user-tech-789";
      const expectedKeyPrefix = createHash("sha256")
        .update(userId, "utf8")
        .digest("hex")
        .slice(0, 8);
      const { checkAuthenticatedIssueLimit } = await import("./rate-limit");
      const { log } = await import("~/lib/logger");

      await checkAuthenticatedIssueLimit(userId);

      expect(log.error).toHaveBeenCalledWith(
        { err: "Upstash connection timeout", userKeyPrefix: expectedKeyPrefix },
        "Authenticated issue rate limit check failed"
      );
      expect(JSON.stringify(vi.mocked(log.error).mock.calls)).not.toContain(
        userId
      );
    });

    it("degrades gracefully to success in development when the Redis limiter call throws", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token-secret");

      limitMock.mockRejectedValueOnce(new Error("Local dev network error"));

      const { checkAuthenticatedIssueLimit } = await import("./rate-limit");
      const result = await checkAuthenticatedIssueLimit("user-tech-789");

      expect(result).toEqual({
        success: true,
        limit: 0,
        remaining: 0,
        reset: 0,
      });
    });
  });

  describe("checkPublicIssueLimit", () => {
    it("configures 5/15m sliding window and keys on IP when Redis is configured", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token-secret");

      limitMock.mockResolvedValueOnce({
        success: true,
        limit: 5,
        remaining: 4,
        reset: 1700000000000,
      });

      const { checkPublicIssueLimit } = await import("./rate-limit");
      const result = await checkPublicIssueLimit("198.51.100.42");

      expect(slidingWindowMock).toHaveBeenCalledWith(5, "15 m");
      expect(ctorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: "ratelimit:public-issue:ip",
          analytics: true,
        })
      );
      expect(limitMock).toHaveBeenCalledWith("198.51.100.42");
      expect(result).toEqual({
        success: true,
        limit: 5,
        remaining: 4,
        reset: 1700000000000,
      });
    });

    it("uses fallback key 'unknown-ip-fallback' in production when client IP is unknown", async () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token-secret");

      limitMock.mockResolvedValueOnce({
        success: true,
        limit: 5,
        remaining: 4,
        reset: 1700000000000,
      });

      const { checkPublicIssueLimit } = await import("./rate-limit");
      await checkPublicIssueLimit("unknown");

      expect(limitMock).toHaveBeenCalledWith("unknown-ip-fallback");
    });
  });
});
