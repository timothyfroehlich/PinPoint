import { env } from "~/env.js";
import { isProduction, isPreview } from "~/lib/environment";

/**
 * Validation results for OAuth provider configuration
 */
export interface OAuthValidationResult {
  isValid: boolean;
  provider: string;
  errors: string[];
  warnings: string[];
}

/**
 * Validates Google OAuth configuration based on environment
 * In production/preview: OAuth credentials are required
 * In development/test: OAuth credentials are optional
 */
export function validateGoogleOAuth(): OAuthValidationResult {
  const result: OAuthValidationResult = {
    isValid: true,
    provider: "Google",
    errors: [],
    warnings: [],
  };

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const requiresOAuth = isProduction() || isPreview();

  // Check client ID
  if (requiresOAuth && !clientId) {
    result.errors.push(
      "GOOGLE_CLIENT_ID is required in production and preview environments",
    );
    result.isValid = false;
  } else if (!clientId) {
    result.warnings.push(
      "GOOGLE_CLIENT_ID not configured - Google OAuth will be unavailable",
    );
  }

  // Check client secret
  if (requiresOAuth && !clientSecret) {
    result.errors.push(
      "GOOGLE_CLIENT_SECRET is required in production and preview environments",
    );
    result.isValid = false;
  } else if (!clientSecret) {
    result.warnings.push(
      "GOOGLE_CLIENT_SECRET not configured - Google OAuth will be unavailable",
    );
  }

  // Additional validations
  if (clientId && clientId.length < 10) {
    result.errors.push("GOOGLE_CLIENT_ID appears to be invalid (too short)");
    result.isValid = false;
  }

  if (clientSecret && clientSecret.length < 10) {
    result.errors.push(
      "GOOGLE_CLIENT_SECRET appears to be invalid (too short)",
    );
    result.isValid = false;
  }

  return result;
}

/**
 * Validates all OAuth providers and returns comprehensive results
 * Can be extended to support additional OAuth providers in the future
 */
export function validateAllOAuthProviders(): OAuthValidationResult[] {
  const results: OAuthValidationResult[] = [];

  // Validate Google OAuth
  results.push(validateGoogleOAuth());

  // Future providers can be added here:
  // results.push(validateMicrosoftOAuth());

  return results;
}

/**
 * Validates OAuth configuration and logs results
 * Returns true if all critical validations pass
 */
export function validateAndLogOAuthConfig(): boolean {
  const results = validateAllOAuthProviders();
  let allValid = true;

  for (const result of results) {
    // Log errors
    for (const error of result.errors) {
      console.error(`🔴 OAuth ${result.provider} Error: ${error}`);
      allValid = false;
    }

    // Log warnings
    for (const warning of result.warnings) {
      console.warn(`🟡 OAuth ${result.provider} Warning: ${warning}`);
    }

    // Only log success in development and only if there are warnings
    if (
      result.isValid &&
      result.errors.length === 0 &&
      result.warnings.length > 0
    ) {
      console.log(`🟢 OAuth ${result.provider}: Configured with warnings`);
    }
  }

  return allValid;
}

/**
 * Throws an error if OAuth configuration is invalid in production/preview
 * In development, logs warnings but allows continuation
 */
export function assertOAuthConfigValid(): void {
  const isValid = validateAndLogOAuthConfig();
  const requiresStrictValidation = isProduction() || isPreview();

  if (!isValid && requiresStrictValidation) {
    throw new Error(
      "OAuth configuration validation failed in production/preview environment. Check your environment variables.",
    );
  }
}
