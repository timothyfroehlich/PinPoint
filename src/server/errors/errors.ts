/**
 * Error Taxonomy - Phase 2B
 * Unified error classes for structured error handling
 * 
 * Provides consistent error structure across the application with
 * type-safe error codes and context information.
 */

/**
 * Standard HTTP status codes for error responses
 */
export const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Error type enumeration for structured error handling
 */
export const ERROR_TYPES = {
  AUTH_ERROR: "AUTH_ERROR",
  PERMISSION_ERROR: "PERMISSION_ERROR",
  ORG_RESOLUTION_ERROR: "ORG_RESOLUTION_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND_ERROR: "NOT_FOUND_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorType = typeof ERROR_TYPES[keyof typeof ERROR_TYPES];

/**
 * Base application error with structured properties
 * All custom errors should extend this class
 */
export abstract class BaseAppError extends Error {
  public readonly type: ErrorType;
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    type: ErrorType,
    code: string,
    message: string,
    statusCode: number,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date();

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, BaseAppError.prototype);
  }

  /**
   * Serialize error to structured object for logging/responses
   */
  toJSON(): {
    type: ErrorType;
    code: string;
    message: string;
    statusCode: number;
    context?: Record<string, unknown>;
    timestamp: string;
  } {
    return {
      type: this.type,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
    };
  }

  /**
   * Check if error is of specific type (type guard)
   */
  public isType<T extends BaseAppError>(type: new (...args: any[]) => T): this is T {
    return this instanceof type;
  }
}

/**
 * Authentication-related errors
 * Used when user authentication fails or is invalid
 */
export class AuthError extends BaseAppError {
  constructor(
    message: string,
    code = "AUTH_FAILED",
    context?: Record<string, unknown>
  ) {
    super(ERROR_TYPES.AUTH_ERROR, code, message, HTTP_STATUS.UNAUTHORIZED, context);
    Object.setPrototypeOf(this, AuthError.prototype);
  }

  // Factory methods for common auth errors
  static invalidCredentials(context?: Record<string, unknown>): AuthError {
    return new AuthError(
      "Invalid credentials provided",
      "INVALID_CREDENTIALS",
      context
    );
  }

  static sessionExpired(context?: Record<string, unknown>): AuthError {
    return new AuthError(
      "Session has expired, please login again",
      "SESSION_EXPIRED",
      context
    );
  }

  static invalidToken(context?: Record<string, unknown>): AuthError {
    return new AuthError(
      "Invalid or malformed authentication token",
      "INVALID_TOKEN",
      context
    );
  }

  static userNotFound(context?: Record<string, unknown>): AuthError {
    return new AuthError(
      "User account not found",
      "USER_NOT_FOUND",
      context
    );
  }
}

/**
 * Permission and authorization errors
 * Used when user lacks required permissions for an operation
 */
export class PermissionError extends BaseAppError {
  constructor(
    message: string,
    code = "PERMISSION_DENIED",
    context?: Record<string, unknown>
  ) {
    super(ERROR_TYPES.PERMISSION_ERROR, code, message, HTTP_STATUS.FORBIDDEN, context);
    Object.setPrototypeOf(this, PermissionError.prototype);
  }

  // Factory methods for common permission errors
  static insufficientPermissions(
    required: string | string[],
    context?: Record<string, unknown>
  ): PermissionError {
    const permissions = Array.isArray(required) ? required.join(", ") : required;
    return new PermissionError(
      `Insufficient permissions. Required: ${permissions}`,
      "INSUFFICIENT_PERMISSIONS",
      { ...context, requiredPermissions: required }
    );
  }

  static roleRequired(role: string, context?: Record<string, unknown>): PermissionError {
    return new PermissionError(
      `Role '${role}' required for this operation`,
      "ROLE_REQUIRED",
      { ...context, requiredRole: role }
    );
  }

  static resourceAccessDenied(
    resource: string,
    action: string,
    context?: Record<string, unknown>
  ): PermissionError {
    return new PermissionError(
      `Access denied: cannot ${action} ${resource}`,
      "RESOURCE_ACCESS_DENIED",
      { ...context, resource, action }
    );
  }

  static membershipRequired(
    organizationId: string,
    context?: Record<string, unknown>
  ): PermissionError {
    return new PermissionError(
      "Organization membership required for this operation",
      "MEMBERSHIP_REQUIRED",
      { ...context, organizationId }
    );
  }
}

/**
 * Organization resolution errors
 * Used when organization context cannot be determined or is invalid
 */
export class OrgResolutionError extends BaseAppError {
  constructor(
    message: string,
    code = "ORG_RESOLUTION_FAILED",
    context?: Record<string, unknown>
  ) {
    super(
      ERROR_TYPES.ORG_RESOLUTION_ERROR,
      code,
      message,
      HTTP_STATUS.NOT_FOUND,
      context
    );
    Object.setPrototypeOf(this, OrgResolutionError.prototype);
  }

  // Factory methods for common org resolution errors
  static organizationNotFound(
    identifier: string,
    context?: Record<string, unknown>
  ): OrgResolutionError {
    return new OrgResolutionError(
      `Organization not found: ${identifier}`,
      "ORG_NOT_FOUND",
      { ...context, organizationIdentifier: identifier }
    );
  }

  static invalidSubdomain(
    subdomain: string,
    context?: Record<string, unknown>
  ): OrgResolutionError {
    return new OrgResolutionError(
      `Invalid or inactive subdomain: ${subdomain}`,
      "INVALID_SUBDOMAIN",
      { ...context, subdomain }
    );
  }

  static ambiguousOrganizationContext(context?: Record<string, unknown>): OrgResolutionError {
    return new OrgResolutionError(
      "Cannot determine organization context from request",
      "AMBIGUOUS_ORG_CONTEXT",
      context
    );
  }

  static multipleOrganizations(context?: Record<string, unknown>): OrgResolutionError {
    return new OrgResolutionError(
      "User belongs to multiple organizations, explicit selection required",
      "MULTIPLE_ORGS",
      context
    );
  }
}

/**
 * Type guard functions for error identification
 */
export function isBaseAppError(error: unknown): error is BaseAppError {
  return error instanceof BaseAppError;
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError;
}

export function isOrgResolutionError(error: unknown): error is OrgResolutionError {
  return error instanceof OrgResolutionError;
}

/**
 * Utility function to get error type from any error
 */
export function getErrorType(error: unknown): ErrorType {
  if (isBaseAppError(error)) {
    return error.type;
  }
  return ERROR_TYPES.INTERNAL_ERROR;
}