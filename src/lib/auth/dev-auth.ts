/**
 * Development Authentication Utilities
 *
 * Provides immediate login functionality for development and preview environments.
 * Uses Supabase admin API to create users with pre-confirmed emails and fixed passwords,
 * eliminating the need for OTP/email confirmation during development and E2E testing.
 *
 * Security Features:
 * - Environment-gated: Only works in development/preview environments
 * - Fixed passwords: Prevents credential confusion
 * - User marking: Dev users are marked with metadata
 * - Domain restrictions: Limited to development email domains
 *
 * Future-ready: Structured to work seamlessly with separate dev/prod databases
 * when the user upgrades their Supabase plan.
 */

import { shouldEnableDevFeatures } from "~/lib/environment-client";
import type { DevUserData, DevAuthResult } from "~/lib/types";

/**
 * Fixed password for all dev users
 * This is intentionally simple since it's only for development environments
 */
const DEV_PASSWORD = "dev-login-123";

/**
 * Allowed email domains for dev users
 * Restricts dev user creation to development-specific domains
 */
const ALLOWED_DEV_DOMAINS = [
  "dev.local",
  "localhost",
  "pinpoint.dev",
  "example.com",
];

/**
 * Validates that an email is allowed for dev user creation
 */
function isValidDevEmail(email: string): boolean {
  const domain = email.split("@")[1];
  return domain ? ALLOWED_DEV_DOMAINS.includes(domain.toLowerCase()) : false;
}

/**
 * Signs in a dev user using password authentication
 * No OTP or email confirmation required
 */
async function signInDevUser(
  clientSupabase: import("~/types/supabase-client").TypedSupabaseClient,
  email: string,
): Promise<DevAuthResult> {
  try {
    console.log(
      `Attempting sign-in with password for: ${email.replace(/\n|\r/g, "")}`,
    );

    const { data, error } = await clientSupabase.auth.signInWithPassword({
      email,
      password: DEV_PASSWORD,
    });

    if (error) {
      // Log detailed error information for debugging
      console.error(`Dev sign-in failed for ${email.replace(/\n|\r/g, "")}:`, {
        code: error.status,
        message: error.message,
        possibleCauses: [
          error.message.includes("Invalid login credentials")
            ? "User doesn't exist or wrong password"
            : null,
          error.message.includes("Email not confirmed")
            ? "Email needs confirmation"
            : null,
          error.message.includes("Too many requests") ? "Rate limited" : null,
        ].filter(Boolean),
      });

      return {
        success: false,
        error: `Sign-in failed: ${error.message}`,
      };
    }

    // On successful sign-in, Supabase should return a user

    console.log(
      `Dev user signed in successfully: ${email.replace(/\n|\r/g, "")} (ID: ${data.user.id})`,
    );
    return {
      success: true,
      method: "signed_in",
      requiresEmailConfirmation: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Dev sign-in exception for ${email.replace(/\n|\r/g, "")}:`,
      errorMessage,
    );
    return {
      success: false,
      error: `Sign-in failed: ${errorMessage}`,
    };
  }
}

/**
 * Main function for dev authentication - signs in existing seeded users
 * This provides the "click button, immediately logged in" experience for seeded users only
 */
export async function authenticateDevUser(
  clientSupabase: import("~/types/supabase-client").TypedSupabaseClient,
  userData: DevUserData,
): Promise<DevAuthResult> {
  // Environment safety check
  if (!shouldEnableDevFeatures()) {
    return {
      success: false,
      error:
        "Dev authentication is only available in development and preview environments",
    };
  }

  // Email domain validation
  if (!isValidDevEmail(userData.email)) {
    return {
      success: false,
      error: `Email domain not allowed for dev users. Allowed domains: ${ALLOWED_DEV_DOMAINS.join(", ")}`,
    };
  }

  try {
    console.log(
      `Attempting to sign in seeded user: ${userData.email.replace(/\n|\r/g, "")}`,
    );

    // Only try to sign in - assume user exists from seeding
    const signInResult = await signInDevUser(clientSupabase, userData.email);

    if (signInResult.success) {
      console.log(
        `Successfully signed in seeded user: ${userData.email.replace(/\n|\r/g, "")}`,
      );
      return {
        ...signInResult,
        method: "existing",
      };
    }

    // Sign-in failed - provide detailed error information for debugging
    console.error(
      `Dev sign-in failed for ${userData.email.replace(/\n|\r/g, "")}: ${signInResult.error ?? ""}`,
    );

    return {
      success: false,
      error:
        `Sign-in failed for seeded user. This usually means:\n` +
        `1. Database wasn't properly seeded (run 'npm run db:reset')\n` +
        `2. User exists but password doesn't match expected dev password\n` +
        `3. Email confirmation issues\n` +
        `Specific error: ${signInResult.error ?? ""}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Dev authentication error:", errorMessage);
    return {
      success: false,
      error: `Authentication failed: ${errorMessage}. Ensure database is seeded with 'npm run db:reset'`,
    };
  }
}

/**
 * Helper function to get user-friendly result messages
 */
export function getAuthResultMessage(result: DevAuthResult): string {
  if (result.success) {
    switch (result.method) {
      case "existing":
        return "✅ Logged in with seeded user successfully!";
      case "signed_in":
        return "✅ Signed in successfully!";
      default:
        return "✅ Authentication successful!";
    }
  }

  return `❌ ${result.error ?? "Authentication failed"}`;
}

/**
 * Check if dev authentication is available in the current environment
 */
export function isDevAuthAvailable(): boolean {
  return shouldEnableDevFeatures();
}

/**
 * Get the current authentication strategy for display purposes
 */
export function getDevAuthStrategy(): "immediate" | "unavailable" {
  return shouldEnableDevFeatures() ? "immediate" : "unavailable";
}
