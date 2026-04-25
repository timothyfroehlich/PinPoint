/**
 * Postgres error introspection that walks the `cause` chain.
 *
 * Drizzle ORM wraps postgres-js errors in DrizzleQueryError with the original
 * error attached on `.cause`. A direct `error.code` check on the wrapper is
 * always undefined, so naive code checks miss every wrapped failure (PP-d5f).
 *
 * These helpers walk the cause chain so detection works regardless of how
 * deeply the underlying postgres-js error is nested.
 */

const MAX_CAUSE_DEPTH = 10;

const walkCauseChain = (error: unknown): Error[] => {
  const chain: Error[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (!(current instanceof Error)) break;
    chain.push(current);
    current = "cause" in current ? current.cause : undefined;
  }
  return chain;
};

/**
 * Type guard: any Error in the cause chain has a string `code` property.
 *
 * Returns true for both bare postgres-js errors and Drizzle-wrapped errors.
 */
export const isPostgresError = (
  error: unknown
): error is Error & { code: string } => {
  for (const link of walkCauseChain(error)) {
    if ("code" in link && typeof link.code === "string") return true;
  }
  return false;
};

/**
 * Returns the first string `code` found by walking the cause chain.
 *
 * Use this when you need the actual SQL error code (e.g. "23505", "23503")
 * regardless of whether the error is wrapped by Drizzle.
 */
export const getPostgresErrorCode = (error: unknown): string | undefined => {
  for (const link of walkCauseChain(error)) {
    if ("code" in link && typeof link.code === "string") return link.code;
  }
  return undefined;
};

/**
 * Convenience: matches a specific Postgres SQLSTATE code anywhere in the chain.
 *
 * @example
 *   if (isPgErrorCode(error, "23505")) {
 *     return err("VALIDATION", `Initials '${initials}' are already taken.`);
 *   }
 */
export const isPgErrorCode = (error: unknown, code: string): boolean =>
  getPostgresErrorCode(error) === code;
