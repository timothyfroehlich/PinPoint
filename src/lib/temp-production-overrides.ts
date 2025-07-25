/**
 * TEMPORARY PRODUCTION OVERRIDES
 *
 * ⚠️  WARNING: This file contains temporary overrides for production deployment
 *
 * Purpose: Allow preview-like behavior in production for one-time deployment
 * - Enables test accounts in production when FORCE_PREVIEW_BEHAVIOR=true
 * - Should be DELETED after successful production verification
 *
 * Created: 2025-01-24 for one-time production deployment
 * TODO: Remove this file and associated environment variable after verification
 */

import { env } from "~/env";

/**
 * Temporary override to enable preview behavior in production
 * When FORCE_PREVIEW_BEHAVIOR=true is set in production environment,
 * this allows test accounts and preview-like functionality
 */
export function shouldForcePreviewBehavior(): boolean {
  return env.FORCE_PREVIEW_BEHAVIOR === "true";
}

/**
 * Check if we should enable preview-like authentication in production
 * This is a temporary override that should be removed after deployment verification
 */
export function shouldEnablePreviewAuthInProduction(): boolean {
  return shouldForcePreviewBehavior();
}
