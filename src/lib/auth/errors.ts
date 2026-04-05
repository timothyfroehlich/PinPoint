import type { AuthError } from "@supabase/supabase-js";
import { isAuthWeakPasswordError } from "@supabase/supabase-js";

export interface AuthErrorMapping {
  code: string;
  message: string;
}

/**
 * Maps Supabase Auth errors to user-facing messages.
 *
 * Uses `error.code` instead of brittle string matching on error messages.
 * Returns undefined when the error code is not recognized so callers can
 * fall back to a context-appropriate generic message.
 */
export function getUserMessageForAuthError(
  error: AuthError
): AuthErrorMapping | undefined {
  if (isAuthWeakPasswordError(error)) {
    if (error.reasons.includes("pwned")) {
      return {
        code: "WEAK_PASSWORD",
        message:
          "This password has appeared in a data breach and cannot be used. Please choose a different password.",
      };
    }
    if (error.reasons.includes("length")) {
      return {
        code: "WEAK_PASSWORD",
        message: "Password is too short. Please use at least 8 characters.",
      };
    }
    if (error.reasons.includes("characters")) {
      return {
        code: "WEAK_PASSWORD",
        message:
          "Password needs more variety. Include uppercase, lowercase, numbers, or symbols.",
      };
    }
    return {
      code: "WEAK_PASSWORD",
      message: "Password is too weak. Please choose a stronger password.",
    };
  }

  switch (error.code) {
    case "weak_password":
      return {
        code: "WEAK_PASSWORD",
        message: "Password is too weak. Please choose a stronger password.",
      };
    case "user_already_exists":
    case "email_exists":
      return {
        code: "EMAIL_TAKEN",
        message: "This email is already registered.",
      };
    case "captcha_failed":
      return {
        code: "CAPTCHA",
        message: "Verification failed. Please refresh the page and try again.",
      };
    case "over_request_rate_limit":
      return {
        code: "RATE_LIMIT",
        message: "Too many attempts. Please try again in a few minutes.",
      };
    case "email_not_confirmed":
      return {
        code: "EMAIL_NOT_CONFIRMED",
        message:
          "Please check your email and confirm your account before signing in.",
      };
    case "same_password":
      return {
        code: "SAME_PASSWORD",
        message: "New password must be different from your current password.",
      };
    case "validation_failed":
    case "email_address_invalid":
      return {
        code: "VALIDATION",
        message: "Please check your details and try again.",
      };
    case "email_address_not_authorized":
      return {
        code: "SERVER",
        message:
          "Unable to send verification email to this address. Please try a different email or contact support.",
      };
    case "signup_disabled":
    case "email_provider_disabled":
      return {
        code: "SERVER",
        message: "Account registration is currently unavailable.",
      };
    default:
      return undefined;
  }
}

/**
 * Extracts the Turnstile token from FormData, returning undefined when
 * missing, empty, or not a string (e.g., File).
 */
export function extractCaptchaToken(formData: FormData): string | undefined {
  const entry = formData.get("captchaToken");
  if (typeof entry === "string" && entry.length > 0) {
    return entry;
  }
  return undefined;
}

/**
 * Creates a structured log context for Supabase auth errors.
 */
export function authErrorLogContext(
  error: AuthError,
  action: string
): Record<string, unknown> {
  return {
    action,
    errorCode: error.code,
    errorStatus: error.status,
    error: error.message,
  };
}
