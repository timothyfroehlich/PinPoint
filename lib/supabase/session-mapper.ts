import type {
  PinPointSupabaseSession,
  PinPointSession,
  SessionConversionResult,
  OrganizationContext,
  SupabaseJWTPayload,
  AuthErrorType,
} from "./types";
import { SupabaseError } from "./errors";

/**
 * Session Mapping Utilities
 *
 * These utilities handle the conversion between Supabase authentication
 * sessions and PinPoint application sessions, maintaining backward
 * compatibility with the existing NextAuth session structure.
 */

/**
 * Converts a Supabase session to a PinPoint session format.
 *
 * This function extracts organization context from JWT app_metadata,
 * maps user information to the expected format, and handles all
 * authentication states properly.
 *
 * @param supabaseSession - The raw Supabase session
 * @returns SessionConversionResult with either success + session or failure + error
 */
export function mapSupabaseSessionToPinPoint(
  supabaseSession: PinPointSupabaseSession,
): SessionConversionResult {
  try {
    // Extract organization context from app_metadata
    const organizationContext = extractOrganizationFromSession(supabaseSession);

    if (!organizationContext.success) {
      return {
        success: false,
        error: organizationContext.error,
        session: null,
      } as const;
    }

    // Extract user information
    const userName = supabaseSession.user.user_metadata["name"] as
      | string
      | undefined;
    const userImage = supabaseSession.user.user_metadata["avatar_url"] as
      | string
      | undefined;

    const user = {
      id: supabaseSession.user.id,
      email: supabaseSession.user.email ?? "",
      ...(userName && { name: userName }),
      ...(userImage && { image: userImage }),
    };

    // Create PinPoint session
    const pinPointSession: PinPointSession = {
      user,
      organizationId: organizationContext.data.organizationId,
      role: organizationContext.data.role,
      expires: new Date((supabaseSession.expires_at ?? 0) * 1000).toISOString(),
    };

    return {
      success: true,
      session: pinPointSession,
    };
  } catch (error) {
    return {
      success: false,
      error: `Session mapping failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      session: null,
    };
  }
}

/**
 * Extracts organization context from a Supabase session.
 *
 * This function looks for organization_id and role in the user's
 * app_metadata and validates that both are present and valid.
 *
 * @param session - The Supabase session
 * @returns Organization context or error
 */
export function extractOrganizationFromSession(
  session: PinPointSupabaseSession,
):
  | { success: true; data: OrganizationContext }
  | { success: false; error: string } {
  const { app_metadata } = session.user;

  // Check for organization_id
  if (
    !app_metadata.organization_id ||
    typeof app_metadata.organization_id !== "string"
  ) {
    return {
      success: false,
      error: "Missing or invalid organization_id in user app_metadata",
    };
  }

  // Check for role
  if (!app_metadata.role || typeof app_metadata.role !== "string") {
    return {
      success: false,
      error: "Missing or invalid role in user app_metadata",
    };
  }

  return {
    success: true,
    data: {
      organizationId: app_metadata.organization_id,
      role: app_metadata.role,
    },
  };
}

/**
 * Extracts organization context from a JWT token payload.
 *
 * This function parses JWT app_metadata to extract organization
 * information without requiring a full session object.
 *
 * @param jwtPayload - The decoded JWT payload
 * @returns Organization context or error
 */
export function extractOrganizationFromJWT(
  jwtPayload: SupabaseJWTPayload,
):
  | { success: true; data: OrganizationContext }
  | { success: false; error: string } {
  const { app_metadata } = jwtPayload;

  // Check for organization_id
  if (
    !app_metadata.organization_id ||
    typeof app_metadata.organization_id !== "string"
  ) {
    return {
      success: false,
      error: "Missing or invalid organization_id in JWT app_metadata",
    };
  }

  // Check for role
  if (!app_metadata.role || typeof app_metadata.role !== "string") {
    return {
      success: false,
      error: "Missing or invalid role in JWT app_metadata",
    };
  }

  return {
    success: true,
    data: {
      organizationId: app_metadata.organization_id,
      role: app_metadata.role,
    },
  };
}

/**
 * Validates a Supabase session for completeness and security.
 *
 * This function checks that all required fields are present and
 * that the session hasn't expired.
 *
 * @param session - The Supabase session to validate
 * @returns Validation result with error details if invalid
 */
export function validateSessionExpiry(
  session: PinPointSupabaseSession,
): { valid: true } | { valid: false; error: AuthErrorType; message: string } {
  // Check if session has expiration info
  if (!session.expires_at) {
    return {
      valid: false,
      error: "INVALID_SESSION",
      message: "Session missing expiration timestamp",
    };
  }

  // Check if session is expired
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at <= now) {
    return {
      valid: false,
      error: "EXPIRED_TOKEN",
      message: "Session has expired",
    };
  }

  // Check for required user fields
  if (!session.user.id) {
    return {
      valid: false,
      error: "INVALID_SESSION",
      message: "Session missing user ID",
    };
  }

  return { valid: true };
}

/**
 * Gets user information from a Supabase session.
 *
 * This function extracts and formats user data from the session,
 * handling missing or undefined fields gracefully.
 *
 * @param session - The Supabase session
 * @returns Formatted user data or null if invalid
 */
export function getSessionUser(session: PinPointSupabaseSession) {
  const userName = session.user.user_metadata["name"] as string | undefined;
  const userImage = session.user.user_metadata["avatar_url"] as
    | string
    | undefined;

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    ...(userName && { name: userName }),
    ...(userImage && { image: userImage }),
  };
}

/**
 * Handles session conversion errors with proper error types.
 *
 * This function converts generic errors into specific authentication
 * error types for better error handling throughout the application.
 *
 * @param error - The error to handle
 * @param context - Additional context for the error
 * @returns Structured error response
 */
export function handleSessionError(
  error: unknown,
  context?: string,
): { error: AuthErrorType; message: string } {
  if (error instanceof SupabaseError) {
    return {
      error: error.type,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    // Determine error type based on error message
    if (error.message.includes("expired")) {
      return {
        error: "EXPIRED_TOKEN",
        message: `Token expired${context ? ` during ${context}` : ""}`,
      };
    }

    if (error.message.includes("organization")) {
      return {
        error: "MISSING_ORGANIZATION",
        message: `Organization context missing${context ? ` in ${context}` : ""}`,
      };
    }

    if (error.message.includes("JWT") || error.message.includes("token")) {
      return {
        error: "INVALID_JWT",
        message: `Invalid JWT${context ? ` in ${context}` : ""}`,
      };
    }

    return {
      error: "INVALID_SESSION",
      message: `Session error${context ? ` in ${context}` : ""}: ${error.message}`,
    };
  }

  return {
    error: "CONFIGURATION_ERROR",
    message: `Unknown error${context ? ` in ${context}` : ""}: ${String(error)}`,
  };
}
