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
 * - Public Issue: 5 submissions per IP per 15 min
 *
 * @see https://github.com/timothyfroehlich/PinPoint/issues/536
 * @see https://github.com/timothyfroehlich/PinPoint/issues/537
 * @see https://github.com/timothyfroehlich/PinPoint/issues/538
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { log } from "~/lib/logger";

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
 * Check if Redis is configured via environment variables
 */
function isRedisConfigured(): boolean {
  const url = process.env["UPSTASH_REDIS_REST_URL"];
  return !!(
    url &&
    process.env["UPSTASH_REDIS_REST_TOKEN"] &&
    !url.includes("your-redis-instance")
  );
}

/**
 * Create Redis client (lazy initialization)
 * Returns null if not configured (allows graceful degradation in development)
 */
function createRedisClient(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }
  // Redis.fromEnv() reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
  return Redis.fromEnv();
}

// Lazy-initialized Redis client
let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient === undefined) {
    redisClient = createRedisClient();
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

// Lazy-initialized rate limiters
let loginIpLimiter: Ratelimit | null | undefined;
let loginAccountLimiter: Ratelimit | null | undefined;
let signupLimiter: Ratelimit | null | undefined;
let forgotPasswordLimiter: Ratelimit | null | undefined;
let publicIssueLimiter: Ratelimit | null | undefined;

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
 * @param ip - Client IP address
 * @returns Rate limit result, or success if Redis not configured
 */
export async function checkLoginIpLimit(ip: string): Promise<RateLimitResult> {
  if (ip === "unknown") {
    log.warn(
      { action: "rate-limit" },
      "Client IP unavailable - skipping login IP rate limit (fail open)"
    );
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  if (loginIpLimiter === undefined) {
    loginIpLimiter = createLoginIpLimiter();
  }

  if (!loginIpLimiter) {
    log.warn(
      { action: "rate-limit" },
      "Upstash Redis not configured - login IP rate limiting disabled"
    );
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  try {
    const result = await loginIpLimiter.limit(ip);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : "Unknown", ip },
      "Login IP rate limit check failed"
    );
    // Fail open - allow request if Redis is down
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}

/**
 * Check public issue rate limit (IP-based)
 *
 * @param ip - Client IP address
 * @returns Rate limit result, or success if Redis not configured
 */
export async function checkPublicIssueLimit(
  ip: string
): Promise<RateLimitResult> {
  if (ip === "unknown") {
    log.warn(
      { action: "rate-limit" },
      "Client IP unavailable - skipping public issue rate limit (fail open)"
    );
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  if (publicIssueLimiter === undefined) {
    publicIssueLimiter = createPublicIssueLimiter();
  }

  if (!publicIssueLimiter) {
    log.warn(
      { action: "rate-limit" },
      "Upstash Redis not configured - public issue rate limiting disabled"
    );
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  try {
    const result = await publicIssueLimiter.limit(ip);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : "Unknown", ip },
      "Public issue rate limit check failed"
    );
    // Fail open - allow request if Redis is down
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}

/**
 * Check login rate limit (account-based)
 *
 * @param email - User email address
 * @returns Rate limit result, or success if Redis not configured
 */
export async function checkLoginAccountLimit(
  email: string
): Promise<RateLimitResult> {
  if (loginAccountLimiter === undefined) {
    loginAccountLimiter = createLoginAccountLimiter();
  }

  if (!loginAccountLimiter) {
    log.warn(
      { action: "rate-limit" },
      "Upstash Redis not configured - login account rate limiting disabled"
    );
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  try {
    // Normalize email to lowercase for consistent rate limiting
    const result = await loginAccountLimiter.limit(email.toLowerCase());
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        email: email.substring(0, 3) + "***",
      },
      "Login account rate limit check failed"
    );
    // Fail open - allow request if Redis is down
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}

/**
 * Check signup rate limit (IP-based)
 *
 * @param ip - Client IP address
 * @returns Rate limit result, or success if Redis not configured
 */
export async function checkSignupLimit(ip: string): Promise<RateLimitResult> {
  if (ip === "unknown") {
    log.warn(
      { action: "rate-limit" },
      "Client IP unavailable - skipping signup rate limit (fail open)"
    );
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  if (signupLimiter === undefined) {
    signupLimiter = createSignupLimiter();
  }

  if (!signupLimiter) {
    log.warn(
      { action: "rate-limit" },
      "Upstash Redis not configured - signup rate limiting disabled"
    );
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  try {
    const result = await signupLimiter.limit(ip);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : "Unknown", ip },
      "Signup rate limit check failed"
    );
    // Fail open - allow request if Redis is down
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}

/**
 * Check forgot password rate limit (email-based)
 *
 * @param email - User email address
 * @returns Rate limit result, or success if Redis not configured
 */
export async function checkForgotPasswordLimit(
  email: string
): Promise<RateLimitResult> {
  if (forgotPasswordLimiter === undefined) {
    forgotPasswordLimiter = createForgotPasswordLimiter();
  }

  if (!forgotPasswordLimiter) {
    log.warn(
      { action: "rate-limit" },
      "Upstash Redis not configured - forgot password rate limiting disabled"
    );
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  try {
    // Normalize email to lowercase for consistent rate limiting
    const result = await forgotPasswordLimiter.limit(email.toLowerCase());
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        email: email.substring(0, 3) + "***",
      },
      "Forgot password rate limit check failed"
    );
    // Fail open - allow request if Redis is down
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}

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
