/**
 * Client-Safe Environment Detection Utilities
 *
 * These functions are safe to use in client components and during SSR/build.
 * They use runtime detection instead of server-side environment variables
 * to avoid SSR/build issues.
 *
 * IMPORTANT: These are simplified client-safe versions.
 * For server-side logic, use ~/lib/environment.ts which has access to VERCEL_ENV.
 */

/**
 * Runtime environment detection that works during SSR/build
 * Uses typeof checks to detect build vs runtime environment
 */
function getClientEnvironment(): "development" | "production" | "test" {
  // During build/SSR, we can't reliably detect environment
  // Default to production for safety during static generation
  if (typeof window === "undefined") {
    return "production";
  }

  // At runtime, check for development indicators
  const isDev =
    typeof window !== "undefined" && window.location.hostname === "localhost";
  return isDev ? "development" : "production";
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
 */
export function isTest(): boolean {
  return getClientEnvironment() === "test";
}

/**
 * Check if running in development or test environment
 * Useful for features that should be available in both local dev and testing
 */
export function isDevelopmentOrTest(): boolean {
  return isDevelopment() || isTest();
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
 *
 * NOTE: This is a simplified client-safe version.
 * For server-side logic, use ~/lib/environment.ts for full VERCEL_ENV support.
 */
export function shouldEnableDevFeatures(): boolean {
  return isDevelopment();
}

/**
 * Check if dev authentication should be available
 * Client-safe version using runtime detection
 */
export function isDevAuthAvailable(): boolean {
  return shouldEnableDevFeatures();
}
