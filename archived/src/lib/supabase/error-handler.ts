/**
 * Enhanced Supabase Error Handling with Comprehensive Type Safety
 *
 * This module provides structured error handling for all Supabase operations,
 * replacing generic error throwing with type-safe error classification and
 * contextual information for debugging and monitoring.
 */

import type { AuthError, User } from "@supabase/supabase-js";
import {
  SupabaseError,
  createAuthenticationError,
  createSessionError,
  createOrganizationError,
  createJWTError,
  createNetworkError,
  createConfigurationError,
} from "./errors";

import { validateSupabaseResponse, classifySupabaseError } from "./type-guards";

import type { AuthErrorType } from "./types";

// ============================================================================
// Operation Context Types
// ============================================================================

/**
 * Context information for Supabase operations
 */
export interface SupabaseOperationContext {
  operation: string;
  userId?: string;
  email?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced error result with operation context
 */
export interface SupabaseErrorResult {
  type: AuthErrorType;
  message: string;
  context: SupabaseOperationContext;
  originalError?: AuthError;
  timestamp: Date;
}

/**
 * Success result with operation context
 */
export interface SupabaseSuccessResult<T = unknown> {
  success: true;
  data: T;
  context: SupabaseOperationContext;
}

/**
 * Failure result with comprehensive error information
 */
export interface SupabaseFailureResult {
  success: false;
  error: SupabaseErrorResult;
}

/**
 * Combined result type for all Supabase operations
 */
export type SupabaseOperationResult<T = unknown> =
  | SupabaseSuccessResult<T>
  | SupabaseFailureResult;

// ============================================================================
// Core Error Handler
// ============================================================================

/**
 * Main error handler for Supabase operations
 * Provides comprehensive error classification and context
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SupabaseErrorHandler {
  /**
   * Handle and classify a Supabase response with full context
   */
  export function handleResponse<T = unknown>(
    response: unknown,
    context: SupabaseOperationContext,
    dataValidator?: (data: unknown) => data is T,
  ): SupabaseOperationResult<T> {
    const validation = validateSupabaseResponse(response, dataValidator);

    if (validation.success) {
      return {
        success: true,
        data: validation.data as T,
        context,
      };
    }

    if (!validation.error) {
      throw new Error("Validation failed but no error information available");
    }

    const errorResult: SupabaseErrorResult = {
      type: validation.error.type,
      message: validation.error.message,
      context,
      ...(validation.error.originalError && {
        originalError: validation.error.originalError,
      }),
      timestamp: new Date(),
    };

    return {
      success: false,
      error: errorResult,
    };
  }

  /**
   * Create a structured error from unknown error value
   */
  export function createStructuredError(
    error: unknown,
    context: SupabaseOperationContext,
  ): SupabaseErrorResult {
    // Handle SupabaseError instances
    if (error instanceof SupabaseError) {
      return {
        type: error.type,
        message: error.message,
        context,
        ...(error.originalError && {
          originalError: error.originalError as AuthError,
        }),
        timestamp: new Date(),
      };
    }

    // Handle native AuthError from Supabase
    if (isAuthError(error)) {
      const classified = classifySupabaseError(error);
      return {
        type: classified,
        message: error.message,
        context,
        originalError: error,
        timestamp: new Date(),
      };
    }

    // Handle generic Error instances
    if (error instanceof Error) {
      // Try to classify based on message content
      const classified = classifyGenericError(error.message);
      return {
        type: classified,
        message: error.message,
        context,
        timestamp: new Date(),
      };
    }

    // Handle unknown error types
    const errorMessage = String(error);
    const classified = classifyGenericError(errorMessage);
    return {
      type: classified,
      message: `Unknown error: ${errorMessage}`,
      context,
      timestamp: new Date(),
    };
  }

  /**
   * Throw a structured SupabaseError from an operation result
   */
  export function throwStructuredError(result: SupabaseFailureResult): never {
    const { error } = result;

    switch (error.type) {
      case "UNAUTHORIZED":
        throw createAuthenticationError(
          `${error.context.operation}: ${error.message}`,
          error.originalError,
        );

      case "INVALID_SESSION":
        throw createSessionError(
          error.context.operation,
          error.message,
          error.originalError,
        );

      case "EXPIRED_TOKEN":
        throw createSessionError(
          error.context.operation,
          `Token expired: ${error.message}`,
          error.originalError,
        );

      case "MISSING_ORGANIZATION":
        throw createOrganizationError(
          error.context.operation,
          error.originalError,
        );

      case "INVALID_JWT":
        throw createJWTError(
          error.context.operation,
          error.message,
          error.originalError,
        );

      case "NETWORK_ERROR":
        throw createNetworkError(error.context.operation, error.originalError);

      case "CONFIGURATION_ERROR":
        throw createConfigurationError(
          "Supabase",
          error.message,
          error.originalError,
        );

      default:
        throw createAuthenticationError(
          `${error.context.operation}: ${error.message}`,
          error.originalError,
        );
    }
  }

  /**
   * Type guard for AuthError
   */
  function isAuthError(error: unknown): error is AuthError {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as AuthError).message === "string"
    );
  }

  /**
   * Classify generic error messages into AuthErrorType
   */
  function classifyGenericError(message: string): AuthErrorType {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("network") || lowerMessage.includes("fetch")) {
      return "NETWORK_ERROR";
    }

    if (
      lowerMessage.includes("config") ||
      lowerMessage.includes("environment")
    ) {
      return "CONFIGURATION_ERROR";
    }

    if (lowerMessage.includes("jwt") || lowerMessage.includes("token")) {
      return "INVALID_JWT";
    }

    if (lowerMessage.includes("session")) {
      return "INVALID_SESSION";
    }

    if (lowerMessage.includes("organization")) {
      return "MISSING_ORGANIZATION";
    }

    // Default to unauthorized
    return "UNAUTHORIZED";
  }
}

// ============================================================================
// Convenience Functions for Common Operations
// ============================================================================

/**
 * Handle admin.listUsers() response
 */
export function handleListUsersResponse(
  response: unknown,
  context: Omit<SupabaseOperationContext, "operation">,
): SupabaseOperationResult<{ users: User[] }> {
  return SupabaseErrorHandler.handleResponse(
    response,
    { ...context, operation: "admin.listUsers" },
    (data): data is { users: User[] } =>
      typeof data === "object" &&
      data !== null &&
      "users" in data &&
      Array.isArray((data as { users: unknown }).users),
  );
}

/**
 * Handle admin.createUser() response
 */
export function handleCreateUserResponse(
  response: unknown,
  context: Omit<SupabaseOperationContext, "operation">,
): SupabaseOperationResult<{ user: User }> {
  return SupabaseErrorHandler.handleResponse(
    response,
    { ...context, operation: "admin.createUser" },
    (data): data is { user: User } =>
      typeof data === "object" &&
      data !== null &&
      "user" in data &&
      typeof (data as { user: unknown }).user === "object",
  );
}

/**
 * Handle admin.deleteUser() response
 */
export function handleDeleteUserResponse(
  response: unknown,
  context: Omit<SupabaseOperationContext, "operation">,
): SupabaseOperationResult<Record<string, never>> {
  return SupabaseErrorHandler.handleResponse(response, {
    ...context,
    operation: "admin.deleteUser",
  });
}

/**
 * Handle auth.getUser() response
 */
export function handleGetUserResponse(
  response: unknown,
  context: Omit<SupabaseOperationContext, "operation">,
): SupabaseOperationResult<{ user: User }> {
  return SupabaseErrorHandler.handleResponse(
    response,
    { ...context, operation: "auth.getUser" },
    (data): data is { user: User } =>
      typeof data === "object" &&
      data !== null &&
      "user" in data &&
      typeof (data as { user: unknown }).user === "object",
  );
}

// ============================================================================
// Safe Operation Wrappers
// ============================================================================

/**
 * Safely execute a Supabase operation with comprehensive error handling
 */
export async function safeSupabaseOperation<T>(
  operation: () => Promise<unknown>,
  context: SupabaseOperationContext,
  dataValidator?: (data: unknown) => data is T,
): Promise<SupabaseOperationResult<T>> {
  try {
    const response = await operation();
    return SupabaseErrorHandler.handleResponse(
      response,
      context,
      dataValidator,
    );
  } catch (error) {
    const structuredError = SupabaseErrorHandler.createStructuredError(
      error,
      context,
    );
    return {
      success: false,
      error: structuredError,
    };
  }
}

/**
 * Execute operation and throw structured error on failure
 */
export async function safeSupabaseOperationOrThrow<T>(
  operation: () => Promise<unknown>,
  context: SupabaseOperationContext,
  dataValidator?: (data: unknown) => data is T,
): Promise<T> {
  const result = await safeSupabaseOperation(operation, context, dataValidator);

  if (!result.success) {
    SupabaseErrorHandler.throwStructuredError(result);
  }

  return result.data;
}

// ============================================================================
// Logging Integration
// ============================================================================

/**
 * Log Supabase errors with structured information
 */
export function logSupabaseError(
  error: SupabaseErrorResult,
  logger: {
    error: (msg: string, meta?: Record<string, unknown>) => void;
  },
): void {
  logger.error("Supabase operation failed", {
    type: error.type,
    operation: error.context.operation,
    message: error.message,
    context: error.context,
    timestamp: error.timestamp,
    originalError: error.originalError
      ? {
          name: error.originalError.name,
          message: error.originalError.message,
        }
      : undefined,
  });
}
