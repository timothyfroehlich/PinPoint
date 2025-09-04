/**
 * Error Response Mapper - Phase 2B
 * Converts errors to structured HTTP responses
 * 
 * Provides consistent error response format across API routes while
 * safely handling both known and unknown error types.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logError } from "~/server/observability/logger";
import { 
  BaseAppError, 
  isBaseAppError, 
  HTTP_STATUS, 
  ERROR_TYPES,
  type ErrorType 
} from "./errors";

/**
 * Structured error response format
 */
export interface ErrorResponse {
  error: {
    type: ErrorType;
    message: string;
    code: string;
    timestamp: string;
    context?: Record<string, unknown>;
  };
}

/**
 * Internal error details for logging (not exposed to clients)
 */
interface InternalErrorDetails {
  originalError?: unknown;
  stack?: string;
  cause?: unknown;
}

/**
 * Maps any error to a structured HTTP response
 * 
 * @param error - The error to map (BaseAppError, ZodError, or unknown)
 * @param options - Additional options for error handling
 * @returns NextResponse with structured error JSON
 */
export function mapErrorToResponse(
  error: unknown,
  options: {
    /** Whether to include sensitive error details (dev mode) */
    includeSensitiveDetails?: boolean;
    /** Additional context to include in response */
    context?: Record<string, unknown>;
    /** Custom request ID for error correlation */
    requestId?: string;
  } = {}
): NextResponse<ErrorResponse> {
  const { includeSensitiveDetails = false, context = {}, requestId } = options;
  
  try {
    // Handle BaseAppError instances
    if (isBaseAppError(error)) {
      return handleBaseAppError(error, context);
    }
    
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return handleZodError(error, context);
    }
    
    // Handle unknown errors
    return handleUnknownError(error, {
      includeSensitiveDetails,
      context,
      requestId,
    });
    
  } catch (mappingError) {
    // Fallback if error mapping itself fails
    logError("Error mapping failed", {
      originalError: String(error),
      mappingError: String(mappingError),
      requestId,
    });
    
    return NextResponse.json(
      {
        error: {
          type: ERROR_TYPES.INTERNAL_ERROR,
          message: "An internal error occurred",
          code: "ERROR_MAPPING_FAILED",
          timestamp: new Date().toISOString(),
        },
      } satisfies ErrorResponse,
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * Handle BaseAppError instances
 */
function handleBaseAppError(
  error: BaseAppError,
  additionalContext: Record<string, unknown>
): NextResponse<ErrorResponse> {
  const errorResponse: ErrorResponse = {
    error: {
      type: error.type,
      message: error.message,
      code: error.code,
      timestamp: error.timestamp.toISOString(),
      context: {
        ...error.context,
        ...additionalContext,
      },
    },
  };

  return NextResponse.json(errorResponse, { status: error.statusCode });
}

/**
 * Handle Zod validation errors
 */
function handleZodError(
  error: ZodError,
  additionalContext: Record<string, unknown>
): NextResponse<ErrorResponse> {
  const errorResponse: ErrorResponse = {
    error: {
      type: ERROR_TYPES.VALIDATION_ERROR,
      message: "Validation failed",
      code: "VALIDATION_FAILED",
      timestamp: new Date().toISOString(),
      context: {
        validationErrors: error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        })),
        ...additionalContext,
      },
    },
  };

  return NextResponse.json(errorResponse, { status: HTTP_STATUS.BAD_REQUEST });
}

/**
 * Handle unknown errors safely
 */
function handleUnknownError(
  error: unknown,
  options: {
    includeSensitiveDetails: boolean;
    context: Record<string, unknown>;
    requestId?: string;
  }
): NextResponse<ErrorResponse> {
  const { includeSensitiveDetails, context, requestId } = options;
  
  // Log full error details for debugging
  const internalDetails: InternalErrorDetails = {
    originalError: error,
    stack: error instanceof Error ? error.stack : undefined,
    cause: error instanceof Error ? error.cause : undefined,
  };
  
  logError("Unhandled error in API route", {
    error: internalDetails,
    context,
    requestId,
  });
  
  // Determine safe message to expose
  let safeMessage = "An internal error occurred";
  let errorCode = "INTERNAL_ERROR";
  
  if (error instanceof Error) {
    // In development, we can be more specific
    if (includeSensitiveDetails) {
      safeMessage = error.message;
      errorCode = error.name.toUpperCase().replace(/\s+/g, "_");
    }
  }
  
  const errorResponse: ErrorResponse = {
    error: {
      type: ERROR_TYPES.INTERNAL_ERROR,
      message: safeMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
      context: includeSensitiveDetails ? context : undefined,
    },
  };

  return NextResponse.json(errorResponse, { 
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR 
  });
}

/**
 * Utility to wrap API route handlers with automatic error mapping
 * 
 * @param handler - The API route handler function
 * @returns Wrapped handler that automatically maps errors to responses
 */
export function withErrorMapping<T extends any[]>(
  handler: (...args: T) => Promise<Response | NextResponse>
) {
  return async (...args: T): Promise<Response | NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Check if we're in development mode
      const isDevelopment = process.env.NODE_ENV === "development";
      
      return mapErrorToResponse(error, {
        includeSensitiveDetails: isDevelopment,
      });
    }
  };
}

/**
 * Type guard to check if response is an error response
 */
export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "error" in response &&
    typeof (response as any).error === "object" &&
    "type" in (response as any).error &&
    "message" in (response as any).error &&
    "code" in (response as any).error
  );
}