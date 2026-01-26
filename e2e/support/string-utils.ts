/**
 * String utility functions for E2E tests
 */

/**
 * Escape special regex characters in a string for use in RegExp constructor
 *
 * Useful when you need to match a literal string that may contain regex special characters
 * like brackets, dots, or parentheses.
 *
 * @param str - String to escape
 * @returns String with regex special characters escaped
 *
 * @example
 * ```ts
 * const title = "[w0_abc] Test Issue";
 * const pattern = new RegExp(escapeRegexString(title));
 * // Matches the literal string "[w0_abc] Test Issue"
 * ```
 */
export function escapeRegexString(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
