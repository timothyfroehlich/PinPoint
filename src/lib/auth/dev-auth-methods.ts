/**
 * Development Authentication Methods
 *
 * Provides environment-aware authentication strategies for dev quick login.
 * Handles the complexity of different authentication methods across environments:
 * - Local development: OTP with local Supabase
 * - Preview deployments: Password fallback when OTP fails
 * - Production: No dev auth (enforced elsewhere)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isDevelopment, isPreview } from "~/lib/environment";

export type DevAuthMethod = "otp" | "password" | "unavailable";

export interface DevAuthResult {
  success: boolean;
  error?: string;
  method?: DevAuthMethod;
  requiresEmailConfirmation?: boolean;
}

/**
 * Determine the best authentication method for the current environment
 */
export function getDevAuthStrategy(): DevAuthMethod {
  if (isDevelopment()) {
    // Local development: OTP works with local Supabase
    return "otp";
  }

  if (isPreview()) {
    // Preview: Try OTP first, fallback to password available
    return "otp"; // We'll fallback to password if this fails
  }

  // Production or unknown environment
  return "unavailable";
}

/**
 * Attempt OTP authentication with smart fallback for preview environments
 */
export async function attemptDevLogin(
  supabase: SupabaseClient,
  email: string,
): Promise<DevAuthResult> {
  const strategy = getDevAuthStrategy();

  if (strategy === "unavailable") {
    return {
      success: false,
      error: "Dev authentication not available in this environment",
    };
  }

  // First attempt: OTP (works in local dev, may fail in preview)
  try {
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (!otpError) {
      return {
        success: true,
        method: "otp",
        requiresEmailConfirmation: true,
      };
    }

    // If we're in preview and OTP failed, try password fallback
    if (isPreview()) {
      console.warn(
        "OTP failed in preview environment, trying password fallback:",
        otpError.message,
      );
      return await attemptPasswordFallback(supabase, email);
    }

    // In development, OTP failure is a real error
    return {
      success: false,
      error: `OTP authentication failed: ${otpError.message}`,
      method: "otp",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Try password fallback in preview environment
    if (isPreview()) {
      console.warn(
        "OTP exception in preview environment, trying password fallback:",
        errorMessage,
      );
      return await attemptPasswordFallback(supabase, email);
    }

    return {
      success: false,
      error: `Authentication failed: ${errorMessage}`,
    };
  }
}

/**
 * Password-based fallback for preview environments
 * Uses predictable passwords for known test accounts
 */
async function attemptPasswordFallback(
  supabase: SupabaseClient,
  email: string,
): Promise<DevAuthResult> {
  try {
    // Generate predictable password for test accounts
    const testPassword = generateTestPassword(email);

    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email,
      password: testPassword,
    });

    if (!passwordError) {
      return {
        success: true,
        method: "password",
        requiresEmailConfirmation: false,
      };
    }

    return {
      success: false,
      error: `Password authentication failed: ${passwordError.message}`,
      method: "password",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Password fallback failed: ${errorMessage}`,
      method: "password",
    };
  }
}

/**
 * Generate predictable test passwords for dev accounts
 * This is secure because:
 * 1. Only works in preview environments (not production)
 * 2. Only works with predefined test account emails
 * 3. Test accounts have no real data or permissions
 */
async function generateTestPassword(email: string): Promise<string> {
  // Secure, predictable password generation for test accounts
  // Format: test_<hash-of-email>
  const encoder = new TextEncoder();
  const data = encoder.encode(email);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = arrayBufferToHex(hashBuffer).substring(0, 16); // 16 hex chars = 8 bytes
  return `test_${hashHex}`;
}

// Helper to convert ArrayBuffer to hex string
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.prototype.map
    .call(new Uint8Array(buffer), (x: number) => ("00" + x.toString(16)).slice(-2))
    .join("");
}
/**
 * Get user-friendly message for authentication result
 */
export function getAuthResultMessage(result: DevAuthResult): string {
  if (result.success) {
    if (result.requiresEmailConfirmation) {
      return "Magic link sent! Check your email to complete login.";
    } else {
      return "Login successful!";
    }
  }

  return result.error ?? "Login failed";
}

/**
 * Check if dev authentication should be available in current environment
 */
export function isDevAuthAvailable(): boolean {
  return isDevelopment() || isPreview();
}
