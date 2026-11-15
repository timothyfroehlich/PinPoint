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
 * - MCP: 120 authenticated requests/minute and 20 mutations/minute per user+client
 * - Pinball Map account link: 5 sign-in attempts per user per 15 min
 * - Quick Search: 60 requests/minute for anonymous requests (keyed by IP), 120 requests/minute for signed-in users (keyed by user ID)
 *
 * @see https://github.com/timothyfroehlich/PinPoint/issues/536
 * @see https://github.com/timothyfroehlich/PinPoint/issues/537
 * @see https://github.com/timothyfroehlich/PinPoint/issues/538
 * @see PP-rw29
 */

import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import { errorMessage } from "~/lib/errors";
import { maskEmail } from "~/lib/logging/mask";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { isProductionRuntime } from "~/lib/runtime-env";

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
    if (!redisClient && !isProductionRuntime()) {
      log.info(
        { action: "rate-limit" },
        "Redis not configured — rate limiting disabled in non-production environment"
      );
    }
  }
  return redisClient;
}

/**
 * Whether a limit bucket is keyed by client IP, account email, or user ID.
 * IP-keyed checks apply the "unknown IP" handling; email-keyed checks
 * normalize the key to lowercase and mask it in logs; user-keyed checks
 * hash the user ID before it leaves the application.
 */
type RateLimitKeyType = "ip" | "email" | "user";

/** Declarative definition of one rate-limit bucket. */
interface LimitDefinition {
  /** Upstash algorithm: sliding window or fixed window. */
  algorithm: "sliding" | "fixed";
  /** Maximum requests allowed per window. */
  limit: number;
  /** Window length in Upstash `Duration` notation (e.g. "15 m"). */
  window: Duration;
  /**
   * Redis key prefix. This names the live production bucket: changing it
   * resets every counter under it. `rate-limit.test.ts` pins every value.
   */
  prefix: string;
  /** Human-readable label used in the failure log message. */
  label: string;
  /** Whether the key is a client IP, account email, or user ID. */
  keyType: RateLimitKeyType;
}

/**
 * Every rate-limit bucket in one table. Each entry produces one exported
 * `check*Limit` checker below; add a bucket here rather than writing a new
 * limiter factory.
 *
 * Pinball Map account link (pinballmap spec 8.4): each attempt forwards a
 * login and password to Pinball Map's auth_details, which Pinball Map itself
 * caps at 10 per minute for our whole API token, shared with its signup and
 * password-reset endpoints. Without a per-member cap, PinPoint would be an
 * unthrottled password-guessing proxy against Pinball Map accounts, and one
 * member could spend the shared allowance for everyone. Same shape as the
 * login account limiter.
 */
const LIMITS = {
  // Login: IP 10 per 15 min (sliding), account 5 per 15 min (fixed)
  loginIp: {
    algorithm: "sliding",
    limit: 10,
    window: "15 m",
    prefix: "ratelimit:login:ip",
    label: "Login IP",
    keyType: "ip",
  },
  loginAccount: {
    algorithm: "fixed",
    limit: 5,
    window: "15 m",
    prefix: "ratelimit:login:account",
    label: "Login account",
    keyType: "email",
  },
  signup: {
    algorithm: "sliding",
    limit: 3,
    window: "1 h",
    prefix: "ratelimit:signup:ip",
    label: "Signup",
    keyType: "ip",
  },
  forgotPassword: {
    algorithm: "fixed",
    limit: 3,
    window: "1 h",
    prefix: "ratelimit:forgot-password:email",
    label: "Forgot password",
    keyType: "email",
  },
  publicIssue: {
    algorithm: "sliding",
    limit: 5,
    window: "15 m",
    prefix: "ratelimit:public-issue:ip",
    label: "Public issue",
    keyType: "ip",
  },
  authenticatedIssue: {
    algorithm: "sliding",
    limit: 20,
    window: "15 m",
    prefix: "ratelimit:report:user",
    label: "Authenticated issue",
    keyType: "user",
  },
  pinballMapLink: {
    algorithm: "fixed",
    limit: 5,
    window: "15 m",
    prefix: "ratelimit:pinballmap-link:user",
    label: "Pinball Map link",
    keyType: "user",
  },
  imageUpload: {
    algorithm: "sliding",
    limit: BLOB_CONFIG.RATE_LIMIT.PER_HOUR,
    window: "1 h",
    prefix: "ratelimit:image-upload:ip",
    label: "Image upload",
    keyType: "ip",
  },
  mcpRequest: {
    algorithm: "sliding",
    limit: 120,
    window: "1 m",
    prefix: "ratelimit:mcp:request",
    label: "MCP request",
    keyType: "user",
  },
  mcpWrite: {
    algorithm: "sliding",
    limit: 20,
    window: "1 m",
    prefix: "ratelimit:mcp:write",
    label: "MCP write",
    keyType: "user",
  },
  // Quick search: anonymous 60/min keyed by IP, members 120/min keyed by user ID
  quickSearchIp: {
    algorithm: "sliding",
    limit: 60,
    window: "1 m",
    prefix: "ratelimit:quick-search:ip",
    label: "Quick search IP",
    keyType: "ip",
  },
  quickSearchUser: {
    algorithm: "sliding",
    limit: 120,
    window: "1 m",
    prefix: "ratelimit:quick-search:user",
    label: "Quick search user",
    keyType: "user",
  },
} as const satisfies Record<string, LimitDefinition>;

/**
 * Build the Upstash limiter for one bucket definition.
 * Returns null when Redis is not configured (graceful degradation).
 */
function createLimiter(definition: LimitDefinition): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const { algorithm, limit, window, prefix } = definition;
  return new Ratelimit({
    redis,
    limiter:
      algorithm === "sliding"
        ? Ratelimit.slidingWindow(limit, window)
        : Ratelimit.fixedWindow(limit, window),
    prefix,
    analytics: true,
  });
}

/**
 * Build a rate-limit checker for one bucket of the LIMITS table.
 *
 * The buckets differ only in their definition (algorithm, limit, window,
 * Redis prefix), whether the key is an IP, account email, or user ID
 * (`keyType`), and the log label. Everything else — lazy limiter
 * initialization, the Redis-unconfigured fallback, and the
 * fail-closed-in-production / fail-open-in-development semantics — is shared.
 *
 * @param definition - The bucket's entry in LIMITS
 * @returns An async checker `(key) => Promise<RateLimitResult>`
 */
function makeLimitChecker(
  definition: LimitDefinition
): (key: string) => Promise<RateLimitResult> {
  const { label, keyType } = definition;

  // Each checker keeps its own lazily-created limiter. `undefined` means
  // "not yet attempted"; `null` means "attempted, Redis unconfigured".
  let limiter: Ratelimit | null | undefined;

  return async function checkLimit(key: string): Promise<RateLimitResult> {
    let limitKey = key;

    if (keyType === "ip" && limitKey === "unknown") {
      if (isProductionRuntime()) {
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
      limiter = createLimiter(definition);
    }

    if (!limiter) {
      if (isProductionRuntime()) {
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
        ? hashIdentifier(limitKey.trim().toLowerCase())
        : keyType === "user"
          ? hashIdentifier(limitKey)
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
      const err = errorMessage(error, "Unknown");
      log.error(
        keyType === "email"
          ? { err, email: maskEmail(limitKey) }
          : keyType === "user"
            ? { err, userKeyPrefix: normalizedKey.slice(0, 8) }
            : { err, ip: limitKey },
        `${label} rate limit check failed`
      );
      reportError(error, { action: "rateLimit.check", keyType, label });
      if (isProductionRuntime()) {
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
export async function getClientIp(customHeaders?: Headers): Promise<string> {
  const headersList = customHeaders ?? (await headers());
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
export const checkLoginIpLimit = makeLimitChecker(LIMITS.loginIp);

/**
 * Check public issue rate limit (IP-based)
 *
 * @param key - Client IP address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkPublicIssueLimit = makeLimitChecker(LIMITS.publicIssue);

/**
 * Hashes an identifier to a pseudonymous string so raw user identifiers
 * are never stored in external rate-limit caches (CORE-SEC-007).
 */
function hashIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier, "utf8").digest("hex");
}

/**
 * Check authenticated issue rate limit (user-based)
 *
 * @param userId - User ID (UUID)
 * @returns Rate limit result, or success if Redis not configured
 */
export const checkAuthenticatedIssueLimit = makeLimitChecker(
  LIMITS.authenticatedIssue
);

/**
 * Check the Pinball Map account-link rate limit (user-based)
 *
 * @param userId - User ID (UUID)
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkPinballMapLinkLimit = makeLimitChecker(LIMITS.pinballMapLink);

/**
 * Check image upload rate limit (IP-based)
 *
 * @param key - Client IP address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkImageUploadLimit = makeLimitChecker(LIMITS.imageUpload);

/** Check the aggregate authenticated MCP transport budget for a user+client. */
export const checkMcpRequestLimit = makeLimitChecker(LIMITS.mcpRequest);

/** Check the narrower mutation budget for a user+OAuth-client key. */
export const checkMcpWriteLimit = makeLimitChecker(LIMITS.mcpWrite);

const checkQuickSearchUserLimit = makeLimitChecker(LIMITS.quickSearchUser);

const checkQuickSearchIpLimit = makeLimitChecker(LIMITS.quickSearchIp);

/**
 * Check quick search rate limit:
 * - Authenticated requests: 120 requests/minute sliding window, keyed by user ID (hashed)
 * - Anonymous requests: 60 requests/minute sliding window, keyed by client IP address
 *
 * @param ip - Client IP address
 * @param userId - Optional authenticated user ID
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export async function checkQuickSearchLimit(
  ip: string,
  userId?: string | null
): Promise<RateLimitResult> {
  return userId
    ? checkQuickSearchUserLimit(userId)
    : checkQuickSearchIpLimit(ip);
}

/**
 * Check signup rate limit (IP-based)
 *
 * @param key - Client IP address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkSignupLimit = makeLimitChecker(LIMITS.signup);

/**
 * Check login rate limit (account-based)
 *
 * @param key - User email address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkLoginAccountLimit = makeLimitChecker(LIMITS.loginAccount);

/**
 * Check forgot password rate limit (email-based)
 *
 * @param key - User email address
 * @returns Allow/deny result. Fails closed in production, and open in
 *   development, when rate limiting is unavailable.
 */
export const checkForgotPasswordLimit = makeLimitChecker(LIMITS.forgotPassword);

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
