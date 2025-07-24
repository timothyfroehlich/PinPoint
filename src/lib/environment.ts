/**
 * Environment Detection Utilities
 *
 * Properly handles Vercel environment detection using VERCEL_ENV instead of NODE_ENV.
 *
 * Vercel Environment Mapping:
 * - Local development: VERCEL_ENV=undefined, NODE_ENV=development
 * - Preview deployments: VERCEL_ENV=preview, NODE_ENV=production
 * - Production deployments: VERCEL_ENV=production, NODE_ENV=production
 */

import { env } from "~/env";

/**
 * Check if running in local development environment
 */
export function isDevelopment(): boolean {
  // Local development: VERCEL_ENV is undefined and NODE_ENV is development
  return env.VERCEL_ENV === undefined && env.NODE_ENV === "development";
}

/**
 * Check if running in Vercel preview environment
 */
export function isPreview(): boolean {
  return env.VERCEL_ENV === "preview";
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return env.VERCEL_ENV === "production";
}

/**
 * Check if running in development or preview (non-production) environment
 * Useful for features that should be available in both local dev and preview
 */
export function isDevelopmentOrPreview(): boolean {
  return isDevelopment() || isPreview();
}

/**
 * Get the current environment name for logging/debugging
 */
export function getEnvironmentName(): string {
  if (isDevelopment()) return "development";
  if (isPreview()) return "preview";
  if (isProduction()) return "production";
  return "unknown";
}

/**
 * Check if dev features should be enabled
 * This includes dev login, debug menus, etc.
 */
export function shouldEnableDevFeatures(): boolean {
  return isDevelopmentOrPreview();
}
