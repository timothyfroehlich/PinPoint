/**
 * Rate Limiting Module
 *
 * Provides rate limiting for authentication endpoints using Upstash Redis.
 * Uses a combination of IP-based and account-based limiting for defense-in-depth.
 *
 * Rate Limits:
 * - Login: 10 attempts per IP per 15 min, 5 attempts per email per 15 min
 * - Signup: 3 signups per IP per hour
 * - Forgot Password: 3 requests per email per hour
 * - Public Issue (anonymous): 5 submissions per IP per 15 min
 * - Authenticated Issue: 20 submissions per user per 15 min
 *
 * @see https://github.com/timothyfroehlich/PinPoint/issues/536
 * @see https://github.com/timothyfroehlich/PinPoint/issues/537
 * @see https://github.com/timothyfroehlich/PinPoint/issues/538
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { log } from "~/lib/logger";
import { maskEmail } from "~/lib/logging/mask";
import { BLOB_CONFIG } from "~/lib/blob/config";

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Returns a fail-closed rate limit result (5-minute cooldown).
 * Used in production when Redis is unavailable to block requests by default.
 */
function failClosedResult(): RateLimitResult {
  return {
    success: false,
    limit: 0,
    remaining: 0,
    reset: Date.now() + 300_000,
  };
}

/**
 * Returns a fail-open rate limit result. Used in non-production environments
 * where rate limiting degrades gracefully instead of blocking requests.
 */
function failOpenResult(): RateLimitResult {
  return { success: true, limit: 0, remaining: 0, reset: 0 };
}

function isProductionEnv(): boolean {
  const vercelEnv = process.env["VERCEL_ENV"];
  if (vercelEnv) return vercelEnv === "production";
  return process.env.NODE_ENV === "production";
}

/**
 * Check if Redis is configured via environment variables.
 * Supports both standard Upstash names and Vercel KV names.
 */
function isRedisConfigured(): boolean {
  const url =
    process.env["UPSTASH_REDIS_REST_URL"] ?? process.env["KV_REST_API_URL"];
  const token =
    process.env["UPSTASH_REDIS_REST_TOKEN"] ?? process.env["KV_REST_API_TOKEN"];

  return !!(url && token && !url.includes("your-redis-instance"));
}

/**
 * Create Redis client (lazy initialization)
 * Returns null if not configured (allows graceful degradation in development)
 */
function createRedisClient(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }

  // Explicitly support both Upstash and Vercel KV environment variable naming conventions
  const url =
    process.env["UPSTASH_REDIS_REST_URL"] ?? process.env["KV_REST_API_URL"];
  const token =
    process.env["UPSTASH_REDIS_REST_TOKEN"] ?? process.env["KV_REST_API_TOKEN"];

  return new Redis({
    url,
    token,
  });
}

// Lazy-initialized Redis client
let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient === undefined) {
    redisClient = createRedisClient();
    if (!redisClient && !isProductionEnv()) {
      log.info(
        { action: "rate-limit" },
        "Redis not configured — rate limiting disabled in non-production environment"
      );
    }
  }
  return redisClient;
}

/**
 * Login rate limiters
 * - IP-based: 10 attempts per 15 minutes (sliding window)
 * - Account-based: 5 attempts per 15 minutes (fixed window)
 */
function createLoginIpLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "15 m"),
    prefix: "ratelimit:login:ip",
    analytics: true,
  });
}

function createLoginAccountLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(5, "15 m"),
    prefix: "ratelimit:login:account",
    analytics: true,
  });
}

/**
 * Signup rate limiter
 * - IP-based: 3 signups per hour (sliding window)
 */
function createSignupLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    prefix: "ratelimit:signup:ip",
    analytics: true,
  });
}

/**
 * Forgot password rate limiter
 * - Email-based: 3 requests per hour (fixed window)
 */
function createForgotPasswordLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(3, "1 h"),
    prefix: "ratelimit:forgot-password:email",
    analytics: true,
  });
}

/**
 * Public Issue rate limiter
 * - IP-based: 5 submissions per 15 minutes (sliding window)
 */
function createPublicIssueLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "ratelimit:public-issue:ip",
    analytics: true,
  });
}

/**
 * Authenticated Issue rate limiter
 * - User-based: 20 submissions per 15 minutes (sliding window)
 */
function createAuthenticatedIssueLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "15 m"),
    prefix: "ratelimit:report:user",
    analytics: true,
  });
}

/**
 * Image Upload rate limiter
 * - IP-based: 10 uploads per hour (sliding window)
 */
function createImageUploadLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(BLOB_CONFIG.RATE_LIMIT.PER_HOUR, "1 h"),
    prefix: "ratelimit:image-upload:ip",
    analytics: true,
  });
}

/**
 * Whether a limit bucket is keyed by client IP, account email, or user ID.
 * IP-keyed checks apply the "unknown IP" handling; email-keyed checks
 * normalize the key to lowercase and mask it in logs; user-keyed checks
 * hash the user ID before it leaves the application.
 */
type RateLimitKeyType = "ip" | "email" | "user";

/**
 * Build a rate-limit checker for one limiter bucket.
 *
 * The seven auth/report limiters differ only in three ways: the Ratelimit
 * configuration (owned by the passed `createLimiter`), whether the key is an
 * IP, account email, or user ID (`keyType`), and the log label. Everything else —
 * lazy limiter initialization, the Redis-unconfigured fallback, and the
 * fail-closed-in-production / fail-open-in-development semantics — is shared.
 *
 * @param createLimiter - Factory for this bucket's limiter (returns null when Redis is unconfigured)
 * @param options.label - Human-readable label used in the failure log message
 * @param options.keyType - Whether the key is a client IP, account email, or user ID
 * @returns An async checker `(key) => Promise<RateLimitResult>`
 */
function makeLimitChecker(
  createLimiter: () => Ratelimit | null,
  options: { label: string; keyType: RateLimitKeyType }
): (key: string) => Promise<RateLimitResult> {
  const { label, keyType } = options;

  // Each checker keeps its own lazily-created limiter. `undefined` means
  // "not yet attempted"; `null` means "attempted, Redis unconfigured".
  let limiter: Ratelimit | null | undefined;

  return async function checkLimit(key: string): Promise<RateLimitResult> {
    let limitKey = key;

    if (keyType === "ip" && limitKey === "unknown") {
      if (isProductionEnv()) {
        log.warn(
          { action: "rate-limit" },
          "Client IP unavailable - using shared fallback key"
        );
        limitKey = "unknown-ip-fallback";
      } else {
        log.warn(
          { action: "rate-limit" },
          "Client IP unavailable - skipping rate limit in development"
        );
        return failOpenResult();
      }
    }

    if (limiter === undefined) {
      limiter = createLimiter();
    }

    if (!limiter) {
      if (isProductionEnv()) {
        log.error(
          { action: "rate-limit" },
          "Rate limiting unavailable in production - blocking request"
        );
        return failClosedResult();
      }
      return failOpenResult();
    }

    const normalizedKey =
      keyType === "email"
        ? limitKey.toLowerCase()
        : keyType === "user"
          ? hashUserId(limitKey)
          : limitKey;

    try {
      const result = await limiter.limit(normalizedKey);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (error) {
      const err = error instanceof Error ? error.message : "Unknown";
      log.error(
        keyType === "email"
          ? { err, email: maskEmail(limitKey) }
          : keyType === "user"
            ? { err, userKeyPrefix: normalizedKey.slice(0, 8) }
            : { err, ip: limitKey },
        `${label} rate limit check failed`
      );
      if (isProductionEnv()) {
        return failClosedResult();
      }
      return failOpenResult();
    }
  };
}

/**
 * Get client IP address from request headers
 *
 * @note This implementation assumes the application is deployed behind a trusted proxy
 * (like Vercel) that sets the `x-forwarded-for` header securely.
 * If deployed elsewhere, ensure your proxy configuration prevents header spoofing.
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  // x-forwarded-for may contain multiple IPs (client, proxies)
  // Take the first one which is the original client
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  // Fallback headers
  const realIp = headersList.get("x-real-ip");
  if (realIp) return realIp;

  // Ultimate fallback
  log.warn(
    { action: "rate-limit" },
    "Could not determine client IP, falling back to 'unknown'"
  );
  return "unknown";
}

/**
 * Check login rate limit (IP-based)
 *
 * @param key - Client IP address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkLoginIpLimit = makeLimitChecker(createLoginIpLimiter, {
  label: "Login IP",
  keyType: "ip",
});

/**
 * Check public issue rate limit (IP-based)
 *
 * @param key - Client IP address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkPublicIssueLimit = makeLimitChecker(
  createPublicIssueLimiter,
  {
    label: "Public issue",
    keyType: "ip",
  }
);

/**
 * Hashes a user ID to a pseudonymous string so raw user identifiers
 * are never stored in external rate-limit caches (CORE-SEC-007).
 */
function hashUserId(userId: string): string {
  return createHash("sha256").update(userId, "utf8").digest("hex");
}

/**
 * Check authenticated issue rate limit (user-based)
 *
 * @param userId - User ID (UUID)
 * @returns Rate limit result, or success if Redis not configured
 */
export const checkAuthenticatedIssueLimit = makeLimitChecker(
  createAuthenticatedIssueLimiter,
  { label: "Authenticated issue", keyType: "user" }
);

/**
 * Check image upload rate limit (IP-based)
 *
 * @param key - Client IP address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkImageUploadLimit = makeLimitChecker(
  createImageUploadLimiter,
  {
    label: "Image upload",
    keyType: "ip",
  }
);

/**
 * Check signup rate limit (IP-based)
 *
 * @param key - Client IP address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkSignupLimit = makeLimitChecker(createSignupLimiter, {
  label: "Signup",
  keyType: "ip",
});

/**
 * Check login rate limit (account-based)
 *
 * @param key - User email address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkLoginAccountLimit = makeLimitChecker(
  createLoginAccountLimiter,
  { label: "Login account", keyType: "email" }
);

/**
 * Check forgot password rate limit (email-based)
 *
 * @param key - User email address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkForgotPasswordLimit = makeLimitChecker(
  createForgotPasswordLimiter,
  { label: "Forgot password", keyType: "email" }
);

/**
 * Format reset time for user-friendly message
 *
 * @param resetTimestamp - Unix timestamp in milliseconds when rate limit resets
 * @returns Human-readable time string
 */
export function formatResetTime(resetTimestamp: number): string {
  const now = Date.now();
  const diffMs = resetTimestamp - now;

  if (diffMs <= 0) {
    return "now";
  }

  const diffSeconds = Math.ceil(diffMs / 1000);

  if (diffSeconds < 60) {
    return `${diffSeconds} second${diffSeconds === 1 ? "" : "s"}`;
  }

  const diffMinutes = Math.ceil(diffSeconds / 60);

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
  }

  const diffHours = Math.ceil(diffMinutes / 60);
  return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
}
