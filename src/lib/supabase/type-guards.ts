/**
 * Comprehensive Type Guards for Supabase API Responses
 *
 * This module provides runtime type validation for all Supabase API responses,
 * ensuring type safety and proper error handling throughout the application.
 *
 * These type guards are essential for TypeScript strict mode compliance and
 * provide detailed error information for debugging and monitoring.
 */

import type {
  User,
  Session,
  AuthResponse,
  AuthError,
  UserResponse,
} from "@supabase/supabase-js";

import type { PinPointSupabaseUser, AuthErrorType } from "./types";

// ============================================================================
// Core Supabase Type Guards
// ============================================================================

/**
 * Type guard for standard Supabase User
 */
export function isSupabaseUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "email" in value &&
    "created_at" in value &&
    typeof (value as User).id === "string"
  );
}

/**
 * Type guard for PinPoint-specific Supabase User with app_metadata
 */
export function isPinPointSupabaseUser(
  value: unknown,
): value is PinPointSupabaseUser {
  if (!isSupabaseUser(value)) return false;

  const user = value;
  return typeof user.app_metadata === "object";
}

/**
 * Type guard for Supabase AuthError
 */
export function isSupabaseAuthError(value: unknown): value is AuthError {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as AuthError).message === "string"
  );
}

/**
 * Type guard for successful UserResponse
 */
export function isSuccessfulUserResponse(
  response: UserResponse,
): response is { data: { user: User }; error: null } {
  return response.error === null && isSupabaseUser(response.data.user);
}

/**
 * Type guard for successful AuthResponse
 */
export function isSuccessfulAuthResponse(
  response: AuthResponse,
): response is { data: { user: User; session: Session | null }; error: null } {
  return (
    response.error === null &&
    response.data.user !== null &&
    isSupabaseUser(response.data.user)
  );
}

// ============================================================================
// Admin API Type Guards
// ============================================================================

/**
 * Type guard for successful admin.listUsers() response
 */
export function isSuccessfulListUsersResponse(
  response: unknown,
): response is { data: { users: User[] }; error: null } {
  if (!hasValidResponseStructure(response)) return false;
  if ((response as { error: unknown }).error !== null) return false;

  const data = (response as { data: unknown }).data;
  if (typeof data !== "object" || data === null) return false;

  const users = (data as { users?: unknown }).users;
  if (!Array.isArray(users)) return false;

  return users.every((user: unknown) => isSupabaseUser(user));
}

/**
 * Type guard for successful admin.createUser() response
 */
export function isSuccessfulCreateUserResponse(
  response: unknown,
): response is { data: { user: User }; error: null } {
  if (!hasValidResponseStructure(response)) return false;
  if ((response as { error: unknown }).error !== null) return false;

  const data = (response as { data: unknown }).data;
  if (typeof data !== "object" || data === null) return false;

  const user = (data as { user?: unknown }).user;
  return isSupabaseUser(user);
}

/**
 * Type guard for successful admin.deleteUser() response
 */
export function isSuccessfulDeleteUserResponse(
  response: any,
): response is { data: {}; error: null } {
  return response && response.error === null;
}

// ============================================================================
// Error Classification Type Guards
// ============================================================================

/**
 * Classify Supabase auth errors into specific types
 */
export function classifySupabaseError(error: AuthError): AuthErrorType {
  const message = error.message.toLowerCase();

  if (message.includes("jwt") || message.includes("token")) {
    return "INVALID_JWT";
  }

  if (message.includes("expired") || message.includes("exp")) {
    return "EXPIRED_TOKEN";
  }

  if (message.includes("session") || message.includes("unauthorized")) {
    return "INVALID_SESSION";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "NETWORK_ERROR";
  }

  if (message.includes("config") || message.includes("environment")) {
    return "CONFIGURATION_ERROR";
  }

  if (message.includes("organization")) {
    return "MISSING_ORGANIZATION";
  }

  // Default to unauthorized for unknown auth errors
  return "UNAUTHORIZED";
}

// ============================================================================
// Response Validation Utilities
// ============================================================================

/**
 * Validate that a response has the expected structure
 */
export function hasValidResponseStructure(
  response: unknown,
): response is { data: unknown; error: unknown } {
  return (
    typeof response === "object" &&
    response !== null &&
    "data" in response &&
    "error" in response
  );
}

/**
 * Extract user data safely from any Supabase response
 */
export function extractUserFromResponse(response: unknown): User | null {
  if (!hasValidResponseStructure(response)) return null;

  const data = (response as any).data;
  if (!data) return null;

  // Handle different response structures
  if (isSupabaseUser(data.user)) {
    return data.user;
  }

  if (isSupabaseUser(data)) {
    return data;
  }

  return null;
}

/**
 * Extract error information safely from any Supabase response
 */
export function extractErrorFromResponse(response: unknown): {
  error: AuthError | null;
  classified: AuthErrorType | null;
} {
  if (!hasValidResponseStructure(response)) {
    return { error: null, classified: null };
  }

  const error = (response as any).error;
  if (!isSupabaseAuthError(error)) {
    return { error: null, classified: null };
  }

  return {
    error,
    classified: classifySupabaseError(error),
  };
}

// ============================================================================
// User Metadata Validation
// ============================================================================

/**
 * Validate user has required PinPoint app_metadata
 */
export function hasValidPinPointMetadata(
  user: User,
): user is PinPointSupabaseUser {
  return (
    typeof user.app_metadata === "object" &&
    typeof user.app_metadata["organization_id"] === "string"
  );
}

/**
 * Extract organization ID safely from user metadata
 */
export function extractOrganizationId(user: User): string | null {
  if (!hasValidPinPointMetadata(user)) return null;
  return user.app_metadata["organization_id"] ?? null;
}

/**
 * Extract role safely from user metadata
 */
export function extractUserRole(user: User): string | null {
  if (!hasValidPinPointMetadata(user)) return null;
  return user.app_metadata["role"] ?? null;
}

// ============================================================================
// Comprehensive Response Validation
// ============================================================================

/**
 * Comprehensive validation result for Supabase operations
 */
export interface SupabaseValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    type: AuthErrorType;
    message: string;
    originalError?: AuthError;
  };
}

/**
 * Validate and classify any Supabase response comprehensively
 */
export function validateSupabaseResponse<T = unknown>(
  response: unknown,
  expectedDataValidator?: (data: unknown) => data is T,
): SupabaseValidationResult<T> {
  // Check response structure
  if (!hasValidResponseStructure(response)) {
    return {
      success: false,
      error: {
        type: "CONFIGURATION_ERROR",
        message: "Invalid response structure from Supabase",
      },
    };
  }

  const { error, classified } = extractErrorFromResponse(response);

  // Handle error responses
  if (error && classified) {
    return {
      success: false,
      error: {
        type: classified,
        message: error.message,
        originalError: error,
      },
    };
  }

  // Extract and validate data
  const data = (response as any).data;
  if (expectedDataValidator && !expectedDataValidator(data)) {
    return {
      success: false,
      error: {
        type: "CONFIGURATION_ERROR",
        message: "Response data does not match expected format",
      },
    };
  }

  return {
    success: true,
    data: data as T,
  };
}
