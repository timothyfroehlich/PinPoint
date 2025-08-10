import { v4 as uuidv4 } from "uuid";

/**
 * Generate cryptographically secure UUID with environment fallback support.
 * Uses crypto.randomUUID() when available (Node 14.17+), falls back to uuid library.
 */
export function generateId(): string {
  // In all currently supported Node.js versions (14.17+ as of 2025), crypto.randomUUID is available
  // Keep fallback for legacy or non-Node environments during development/testing
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  } else {
    return uuidv4();
  }
}

/**
 * Generate prefixed ID for database entities.
 * @param prefix - The prefix to add (e.g., 'user', 'membership')
 * @returns A prefixed UUID like 'user_123e4567-e89b-12d3-a456-426614174000'
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${generateId()}`;
}
