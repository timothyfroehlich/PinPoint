/**
 * Type Guards for Safe Property Access
 * Centralized type guards for common error and result patterns
 */

/**
 * Type guard for checking if a value is an Error object
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard for checking if a value is an Error with a code property
 */
export function isErrorWithCode(
  value: unknown,
): value is Error & { code: string } {
  return isError(value) && "code" in value && typeof value.code === "string";
}

/**
 * Type guard for checking if a value is an Error with a status property
 */
export function isErrorWithStatus(
  value: unknown,
): value is Error & { status: number } {
  return (
    isError(value) && "status" in value && typeof value.status === "number"
  );
}

/**
 * Type guard for checking if an object has a specific property
 */
export function hasProperty<T, K extends string>(
  obj: T,
  key: K,
): obj is T & Record<K, unknown> {
  return (
    obj !== null && obj !== undefined && typeof obj === "object" && key in obj
  );
}

/**
 * Type guard for checking if a value is an object with a message property
 */
export function hasMessage(value: unknown): value is { message: string } {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === "object" &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  );
}

/**
 * Safe message extraction from unknown error values
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (hasMessage(error)) {
    return error.message;
  }
  return String(error);
}
