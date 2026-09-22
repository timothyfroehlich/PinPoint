/**
 * Extract a human-readable message from an unknown thrown value.
 *
 * A `catch` clause binds `unknown`, so reading `.message` always has to be
 * guarded by an `instanceof Error` check. This centralizes the
 * `error instanceof Error ? error.message : …` idiom that was repeated across
 * the codebase (PP-uufe).
 *
 * @param error - The caught value (typically from a `catch` block).
 * @param fallback - Message to use when `error` is not an `Error`. When
 *   omitted, defaults to `String(error)` so non-`Error` throws (strings,
 *   objects, etc.) still surface something readable instead of being discarded.
 * @returns `error.message` for `Error` instances; otherwise `fallback`, or
 *   `String(error)` when no fallback is given.
 */
export function errorMessage(error: unknown, fallback?: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback ?? String(error);
}
