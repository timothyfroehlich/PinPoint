/**
 * Client-Safe Environment Detection Utilities
 *
 * These functions are safe to use in client components and during SSR/build.
 * They use the validated env schema for reliable environment detection.
 *
 * Uses VERCEL_ENV for proper preview deployment detection on Vercel.
 */

import { env } from "~/env";

/**
 * Runtime environment detection using client-safe public environment variables
 * Uses NEXT_PUBLIC_VERCEL_ENV which is automatically set by next.config.mjs
 * from VERCEL_ENV (Vercel deployments) or NODE_ENV (local development)
 */
function getClientEnvironment():
  | "development"
  | "production"
  | "preview"
  | "test" {
  // Primary: Use NEXT_PUBLIC_VERCEL_ENV (automatically set by Next.js config)
  if (env.NEXT_PUBLIC_VERCEL_ENV) {
    // Validate the value is one of our expected types
    if (
      ["development", "production", "preview", "test"].includes(
        env.NEXT_PUBLIC_VERCEL_ENV,
      )
    ) {
      return env.NEXT_PUBLIC_VERCEL_ENV as
        | "development"
        | "production"
        | "preview"
        | "test";
    }
  }

  // Fallback 1: Browser-based detection for localhost
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname.includes("127.0.0.1")) {
      return "development";
    }
  }

  // Fallback 2: Default to production for safety
  return "production";
}

/**
 * Check if running in local development environment
 * Client-safe version using runtime detection
 */
export function isDevelopment(): boolean {
  return getClientEnvironment() === "development";
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return getClientEnvironment() === "production";
}

/**
 * Check if running in test environment
 * Note: Test detection needs special handling since it's not available via public env vars
 */
export function isTest(): boolean {
  // In test environment, we can safely check NODE_ENV since tests run in Node.js
  if (typeof process !== "undefined" && typeof window === "undefined") {
    // Server-side: use validated env for test detection
    try {
      return env.NODE_ENV === "test";
    } catch {
      // Fallback if env access fails
      return false;
    }
  }

  // Client-side: tests don't typically run in browser, so default to false
  return false;
}

/**
 * Check if running in preview environment (Vercel preview deployments)
 */
export function isPreview(): boolean {
  return getClientEnvironment() === "preview";
}

/**
 * Check if running in development or test environment
 * Useful for features that should be available in both local dev and testing
 */
export function isDevelopmentOrTest(): boolean {
  return isDevelopment() || isTest();
}

/**
 * Check if running in development or preview environment
 * Useful for features that should be available in both local dev and preview deployments
 */
export function isDevelopmentOrPreview(): boolean {
  return isDevelopment() || isPreview();
}

/**
 * Get the current environment name for logging/debugging
 */
export function getEnvironmentName(): string {
  return getClientEnvironment();
}

/**
 * Check if dev features should be enabled
 * This includes dev login, debug menus, etc.
 * Now explicitly controlled by NEXT_PUBLIC_ENABLE_DEV_FEATURES environment variable
 */
export function shouldEnableDevFeatures(): boolean {
  return env.NEXT_PUBLIC_ENABLE_DEV_FEATURES;
}

/**
 * Check if dev authentication should be available
 * Client-safe version using runtime detection
 */
export function isDevAuthAvailable(): boolean {
  return shouldEnableDevFeatures();
}

/**
 * Get the app URL for client-side usage (QR codes, external links, etc.)
 * Client-safe wrapper around the validated env variable
 */
export function getAppUrl(): string {
  return env.NEXT_PUBLIC_APP_URL;
}
