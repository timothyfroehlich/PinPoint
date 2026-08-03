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
 * Returns true when any Error in the cause chain has a string `code` property.
 *
 * Intentionally NOT a type guard — narrowing `error` to `Error & { code: string }`
 * would be a lie when the matching link is on `error.cause` (the outer error
 * still has no `code`). Callers that need the actual code must use
 * `getPostgresErrorCode(error)` or `isPgErrorCode(error, "23505")`.
 */
export const isPostgresError = (error: unknown): boolean => {
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

/**
 * Returns the violated constraint's name, across both driver spellings.
 *
 * **Why a bare 23505 check is not enough.** A table with several unique
 * constraints reports the same SQLSTATE for all of them, so code that assumes
 * *which* one fired reports the wrong cause. `machines` has both a unique
 * `initials` and the partial `machines_pinballmap_listed_unique` (migration
 * 0052), and the machine write paths used to answer every 23505 with "Initials
 * are already taken" — actively misleading for a duplicate-listing collision
 * (PP-o355.15).
 *
 * **The two drivers spell the field differently, and that is a live trap
 * (verified 2026-08-01), not a defensive guess:**
 *
 * - **postgres-js** (production, `src/server/db/index.ts`) maps the Postgres wire
 *   field `n` to **`constraint_name`** — `node_modules/postgres/src/connection.js:46`.
 * - **PGlite** (every integration test) inherits pg-protocol's camelCase naming
 *   and exposes **`constraint`**, alongside `dataType`, `internalPosition`, etc.
 *
 * So a helper reading only one key passes its tests and silently fails in
 * production, or fails its tests while production works. Both must be read.
 * The same split applies to the other fields (`table_name`/`table`,
 * `column_name`/`column`) if anything ever needs them.
 *
 * Returns undefined when absent, so callers must keep a general fallback: not
 * every unique violation carries a name (some arrive from `EXCLUDE` constraints
 * or through drivers that drop the field).
 *
 * Its production caller is `captureAutoLink` (`~/lib/pinballmap/sync`), which
 * stands down on a duplicate-listing collision and must NOT stand down on the
 * unique index of the timeline receipt written in the same transaction — the two
 * are indistinguishable by SQLSTATE alone.
 */
export const getPostgresErrorConstraint = (
  error: unknown
): string | undefined => {
  for (const link of walkCauseChain(error)) {
    // Checked separately rather than via a key list so `in` narrows each access
    // — no cast, matching `isPostgresError` above (CORE-TS-007).
    if ("constraint_name" in link && typeof link.constraint_name === "string") {
      return link.constraint_name;
    }
    if ("constraint" in link && typeof link.constraint === "string") {
      return link.constraint;
    }
  }
  return undefined;
};
