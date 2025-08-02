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

import { createDevUserAction, type DevUserData } from "./dev-auth-server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { shouldEnableDevFeatures } from "~/lib/environment";

/**
 * Result of a dev authentication attempt
 */
export interface DevAuthResult {
  success: boolean;
  error?: string;
  method?: "created" | "existing" | "signed_in";
  requiresEmailConfirmation?: boolean;
}

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
  "test.com",
  "example.com",
  "localhost",
  "pinpoint.dev",
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
  clientSupabase: SupabaseClient,
  email: string,
): Promise<DevAuthResult> {
  try {
    const { error } = await clientSupabase.auth.signInWithPassword({
      email,
      password: DEV_PASSWORD,
    });

    if (error) {
      console.error("Dev sign-in failed:", error.message);
      return {
        success: false,
        error: `Sign-in failed: ${error.message}`,
      };
    }

    console.log(`Dev user signed in: ${email}`);
    return {
      success: true,
      method: "signed_in",
      requiresEmailConfirmation: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Dev sign-in error:", errorMessage);
    return {
      success: false,
      error: `Sign-in failed: ${errorMessage}`,
    };
  }
}

/**
 * Main function for dev authentication - creates user if needed, then signs them in
 * This provides the "click button, immediately logged in" experience
 */
export async function authenticateDevUser(
  clientSupabase: SupabaseClient,
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
    // Try to sign in first (user might already exist)
    const signInResult = await signInDevUser(clientSupabase, userData.email);

    if (signInResult.success) {
      return {
        ...signInResult,
        method: "existing",
      };
    }

    // User doesn't exist or sign-in failed, create the user
    console.log(`User ${userData.email} doesn't exist, creating...`);

    const createResult = await createDevUserAction(userData);

    if (!createResult.success) {
      return {
        success: false,
        error: createResult.error ?? "Failed to create user",
      };
    }

    // Now sign in the newly created user
    const newSignInResult = await signInDevUser(clientSupabase, userData.email);

    if (newSignInResult.success) {
      return {
        ...newSignInResult,
        method: "created",
      };
    }

    return newSignInResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Dev authentication error:", errorMessage);
    return {
      success: false,
      error: `Authentication failed: ${errorMessage}`,
    };
  }
}

/**
 * Helper function to get user-friendly result messages
 */
export function getAuthResultMessage(result: DevAuthResult): string {
  if (result.success) {
    switch (result.method) {
      case "created":
        return "✅ Dev user created and logged in successfully!";
      case "existing":
        return "✅ Logged in successfully!";
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
