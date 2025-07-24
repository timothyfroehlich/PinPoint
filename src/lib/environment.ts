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

/**
 * Authentication Strategy Functions
 * These functions determine which authentication providers should be enabled
 * based on the current environment
 */

/**
 * Check if credentials provider should be enabled
 * Used for test users in development and demo users in preview
 */
export function shouldEnableCredentialsProvider(): boolean {
  // Temporary override for production deployment - allows preview behavior in production
  // TODO: Remove this after successful production deployment verification
  if (env.FORCE_PREVIEW_BEHAVIOR === "true") {
    return true;
  }
  return isDevelopment() || isPreview() || env.NODE_ENV === "test";
}

/**
 * Check if test login should be enabled
 * Only enabled in development and test environments for easy testing
 */
export function shouldEnableTestLogin(): boolean {
  return isDevelopment() || env.NODE_ENV === "test";
}

/**
 * Check if demo login should be enabled
 * Only enabled in preview environment for stakeholder demonstrations
 */
export function shouldEnableDemoLogin(): boolean {
  return isPreview();
}

/**
 * Check if Google OAuth should be required
 * OAuth is optional in development/test, required in preview/production
 */
export function shouldRequireGoogleOAuth(): boolean {
  return isPreview() || isProduction();
}
