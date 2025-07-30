import type { AuthErrorType } from "./types";

/**
 * Standardized Error Handling for Supabase Operations
 *
 * This module provides type-safe error classes and utilities for
 * handling authentication and session errors consistently across
 * the application.
 */

/**
 * Base Supabase error class with type-safe error categorization.
 *
 * This extends the native Error class to provide structured error
 * information that can be used for proper error handling and
 * user feedback throughout the application.
 */
export class SupabaseError extends Error {
  public readonly type: AuthErrorType;
  public readonly originalError: Error | undefined;

  constructor(type: AuthErrorType, message: string, originalError?: Error) {
    super(message);
    this.name = "SupabaseError";
    this.type = type;
    this.originalError = originalError;

    // Maintain proper stack trace for debugging
    Error.captureStackTrace(this, SupabaseError);
  }

  /**
   * Creates a formatted error message with context.
   */
  public toDetailedString(): string {
    const parts = [`${this.type}: ${this.message}`];

    if (this.originalError) {
      parts.push(`Original: ${this.originalError.message}`);
    }

    if (this.stack) {
      parts.push(`Stack: ${this.stack}`);
    }

    return parts.join("\n");
  }

  /**
   * Converts the error to a JSON-serializable object for logging.
   */
  public toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
          }
        : undefined,
      stack: this.stack,
    };
  }
}

/**
 * Specific error classes for different types of authentication failures.
 */

export class AuthenticationError extends SupabaseError {
  constructor(message: string, originalError?: Error) {
    super("UNAUTHORIZED", message, originalError);
    this.name = "AuthenticationError";
  }
}

export class SessionExpiredError extends SupabaseError {
  constructor(message = "Session has expired", originalError?: Error) {
    super("EXPIRED_TOKEN", message, originalError);
    this.name = "SessionExpiredError";
  }
}

export class InvalidSessionError extends SupabaseError {
  constructor(message: string, originalError?: Error) {
    super("INVALID_SESSION", message, originalError);
    this.name = "InvalidSessionError";
  }
}

export class MissingOrganizationError extends SupabaseError {
  constructor(
    message = "Organization context is missing or invalid",
    originalError?: Error,
  ) {
    super("MISSING_ORGANIZATION", message, originalError);
    this.name = "MissingOrganizationError";
  }
}

export class InvalidJWTError extends SupabaseError {
  constructor(message: string, originalError?: Error) {
    super("INVALID_JWT", message, originalError);
    this.name = "InvalidJWTError";
  }
}

export class NetworkError extends SupabaseError {
  constructor(message: string, originalError?: Error) {
    super("NETWORK_ERROR", message, originalError);
    this.name = "NetworkError";
  }
}

export class ConfigurationError extends SupabaseError {
  constructor(message: string, originalError?: Error) {
    super("CONFIGURATION_ERROR", message, originalError);
    this.name = "ConfigurationError";
  }
}

/**
 * Error Factory Functions
 *
 * These functions provide convenient ways to create specific error types
 * with consistent messaging and proper error chaining.
 */

/**
 * Creates an authentication error for failed login attempts.
 */
export function createAuthenticationError(
  reason?: string,
  originalError?: Error,
): AuthenticationError {
  const message = reason
    ? `Authentication failed: ${reason}`
    : "Authentication failed";

  return new AuthenticationError(message, originalError);
}

/**
 * Creates a session error for invalid or malformed sessions.
 */
export function createSessionError(
  context: string,
  details?: string,
  originalError?: Error,
): InvalidSessionError {
  const message = details
    ? `Invalid session in ${context}: ${details}`
    : `Invalid session in ${context}`;

  return new InvalidSessionError(message, originalError);
}

/**
 * Creates an organization error for missing organization context.
 */
export function createOrganizationError(
  context: string,
  originalError?: Error,
): MissingOrganizationError {
  const message = `Organization context missing in ${context}`;
  return new MissingOrganizationError(message, originalError);
}

/**
 * Creates a JWT error for token validation failures.
 */
export function createJWTError(
  operation: string,
  details?: string,
  originalError?: Error,
): InvalidJWTError {
  const message = details
    ? `JWT error during ${operation}: ${details}`
    : `JWT error during ${operation}`;

  return new InvalidJWTError(message, originalError);
}

/**
 * Creates a network error for connection or API failures.
 */
export function createNetworkError(
  operation: string,
  originalError?: Error,
): NetworkError {
  const message = `Network error during ${operation}`;
  return new NetworkError(message, originalError);
}

/**
 * Creates a configuration error for environment or setup issues.
 */
export function createConfigurationError(
  component: string,
  issue: string,
  originalError?: Error,
): ConfigurationError {
  const message = `Configuration error in ${component}: ${issue}`;
  return new ConfigurationError(message, originalError);
}

/**
 * Error Type Guards
 *
 * Utility functions to check specific error types at runtime.
 */

export function isSupabaseError(error: unknown): error is SupabaseError {
  return error instanceof SupabaseError;
}

export function isAuthenticationError(
  error: unknown,
): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isSessionExpiredError(
  error: unknown,
): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

export function isInvalidSessionError(
  error: unknown,
): error is InvalidSessionError {
  return error instanceof InvalidSessionError;
}

export function isMissingOrganizationError(
  error: unknown,
): error is MissingOrganizationError {
  return error instanceof MissingOrganizationError;
}

export function isInvalidJWTError(error: unknown): error is InvalidJWTError {
  return error instanceof InvalidJWTError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isConfigurationError(
  error: unknown,
): error is ConfigurationError {
  return error instanceof ConfigurationError;
}
