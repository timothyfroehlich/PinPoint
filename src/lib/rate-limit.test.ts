import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock @upstash/redis and @upstash/ratelimit to prevent any network calls (CORE-TEST-006)
const mockLimit = vi.fn();
const mockSlidingWindow = vi.fn().mockReturnValue("sliding-window-algorithm");
const mockFixedWindow = vi.fn().mockReturnValue("fixed-window-algorithm");
const mockRatelimitConstructor = vi.fn();

vi.mock("@upstash/ratelimit", () => {
  class MockRatelimit {
    limit = mockLimit;
    constructor(options: unknown) {
      mockRatelimitConstructor(options);
    }
    static slidingWindow = mockSlidingWindow;
    static fixedWindow = mockFixedWindow;
  }
  return { Ratelimit: MockRatelimit };
});

vi.mock("@upstash/redis", () => {
  class MockRedis {
    constructor(public options: unknown) {}
  }
  return { Redis: MockRedis };
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
      expect(mockRatelimitConstructor).not.toHaveBeenCalled();
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

      mockLimit.mockResolvedValueOnce({
        success: true,
        limit: 20,
        remaining: 19,
        reset: 1700000000000,
      });

      const { checkAuthenticatedIssueLimit } = await import("./rate-limit");
      const result = await checkAuthenticatedIssueLimit("user-tech-789");

      // Verify sliding window configuration: 20 requests per 15 minutes
      expect(mockSlidingWindow).toHaveBeenCalledWith(20, "15 m");
      expect(mockRatelimitConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: "ratelimit:report:user",
          analytics: true,
        })
      );

      // Verify the limit call is keyed directly to the userId
      expect(mockLimit).toHaveBeenCalledWith("user-tech-789");
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

      mockLimit.mockResolvedValueOnce({
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

      mockLimit.mockRejectedValueOnce(new Error("Upstash connection timeout"));

      const { checkAuthenticatedIssueLimit } = await import("./rate-limit");
      const before = Date.now();
      const result = await checkAuthenticatedIssueLimit("user-tech-789");

      expect(result.success).toBe(false);
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.reset).toBeGreaterThanOrEqual(before + 300_000);
    });

    it("degrades gracefully to success in development when the Redis limiter call throws", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token-secret");

      mockLimit.mockRejectedValueOnce(new Error("Local dev network error"));

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

      mockLimit.mockResolvedValueOnce({
        success: true,
        limit: 5,
        remaining: 4,
        reset: 1700000000000,
      });

      const { checkPublicIssueLimit } = await import("./rate-limit");
      const result = await checkPublicIssueLimit("198.51.100.42");

      expect(mockSlidingWindow).toHaveBeenCalledWith(5, "15 m");
      expect(mockRatelimitConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: "ratelimit:public-issue:ip",
          analytics: true,
        })
      );
      expect(mockLimit).toHaveBeenCalledWith("198.51.100.42");
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

      mockLimit.mockResolvedValueOnce({
        success: true,
        limit: 5,
        remaining: 4,
        reset: 1700000000000,
      });

      const { checkPublicIssueLimit } = await import("./rate-limit");
      await checkPublicIssueLimit("unknown");

      expect(mockLimit).toHaveBeenCalledWith("unknown-ip-fallback");
    });
  });
});
