/**
 * Database Query Result Types
 * Type definitions for common database query result patterns
 */

/**
 * Result type for count queries
 */
export interface CountResult {
  count: number | null;
}

/**
 * Result type for existence check queries
 */
export interface ExistsResult {
  exists: boolean;
}

/**
 * Generic result type for aggregation queries with typed fields
 */
export type AggregateResult<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K] | null;
};

/**
 * Utility type that ensures proper null handling for query results
 */
export type SafeQueryResult<T> = T extends (infer U)[]
  ? U[]
  : T extends Record<string, unknown>
  ? T
  : T;

/**
 * Common aggregation result for statistics queries
 */
export interface StatsResult {
  total: number | null;
  open: number | null;
  resolved: number | null;
  closed: number | null;
}

/**
 * Result type for queries that return a single optional record
 */
export type OptionalResult<T> = T | null;

/**
 * Helper type for safely accessing count query results
 */
export function safeCount(result: CountResult[] | undefined): number {
  return result?.[0]?.count ?? 0;
}

/**
 * Helper type for safely accessing stats query results
 */
export function safeStats(result: StatsResult[] | undefined): StatsResult {
  const stats = result?.[0];
  return {
    total: stats?.total ?? 0,
    open: stats?.open ?? 0,
    resolved: stats?.resolved ?? 0,
    closed: stats?.closed ?? 0,
  };
}