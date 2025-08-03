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
 * Runtime environment detection using validated environment variables
 * Uses VERCEL_ENV for accurate preview deployment detection
 */
function getClientEnvironment():
  | "development"
  | "production"
  | "preview"
  | "test" {
  // Check for test environment first
  if (env.NODE_ENV === "test") {
    return "test";
  }

  // Use VERCEL_ENV if available (official Vercel environment detection)
  if (env.VERCEL_ENV) {
    return env.VERCEL_ENV;
  }

  // Fallback to NODE_ENV
  if (env.NODE_ENV === "development") {
    return "development";
  }

  // Default to production for safety
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
 */
export function isTest(): boolean {
  return getClientEnvironment() === "test";
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
 *
 * Enabled in both development and preview environments for testing
 */
export function shouldEnableDevFeatures(): boolean {
  return isDevelopmentOrPreview();
}

/**
 * Check if dev authentication should be available
 * Client-safe version using runtime detection
 */
export function isDevAuthAvailable(): boolean {
  return shouldEnableDevFeatures();
}
