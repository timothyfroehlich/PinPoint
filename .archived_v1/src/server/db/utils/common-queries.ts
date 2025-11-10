/**
 * Common query utilities used across Drizzle router implementations.
 * Provides consistent patterns for organization scoping, single record queries, etc.
 *
 * Note: All utilities in this file use snake_case field names to match the database schema.
 * Field validation utilities are available to ensure consistency during development.
 */

import { eq, and, isNull, type SQL } from "drizzle-orm";
import type { PgColumn, PgSelect } from "drizzle-orm/pg-core";
import { devValidateFields } from "./field-validation";
import { env } from "~/env.js";

/**
 * Organization scoping condition for multi-tenant queries.
 * @param column - The organizationId column to filter on
 * @param organizationId - The organization ID to filter by
 */
export function withOrganizationScope(
  column: PgColumn,
  organizationId: string,
): SQL {
  return eq(column, organizationId);
}

/**
 * Soft delete filtering - excludes records where deletedAt is not null.
 * @param deletedAtColumn - The deletedAt column to check
 */
export function excludeSoftDeleted(deletedAtColumn: PgColumn): SQL {
  return isNull(deletedAtColumn);
}

/**
 * Combine organization scoping with soft delete filtering.
 * @param orgColumn - The organizationId column
 * @param organizationId - The organization ID to filter by
 * @param deletedAtColumn - The deletedAt column to check
 */
export function withOrgScopeAndNotDeleted(
  orgColumn: PgColumn,
  organizationId: string,
  deletedAtColumn: PgColumn,
): SQL {
  const condition = and(
    withOrganizationScope(orgColumn, organizationId),
    excludeSoftDeleted(deletedAtColumn),
  );
  if (!condition) {
    throw new Error(
      "Failed to create combined organization and soft delete condition",
    );
  }
  return condition;
}

/**
 * Execute a query and return the first result, or null if no results.
 * Common pattern for "findUnique" style queries.
 * @param query - The Drizzle query to execute
 */
export async function getSingleRecord<T>(
  query: Promise<T[]>,
): Promise<T | null> {
  const [record] = await query;
  return record ?? null;
}

/**
 * Execute a query with limit(1) and return the first result, or null.
 * Optimized version for queries that should return at most one record.
 * @param baseQuery - The base query (before .limit(1)) - must be in dynamic mode
 */
export async function getSingleRecordWithLimit<T extends PgSelect>(
  baseQuery: T,
): Promise<Awaited<ReturnType<T["execute"]>>[0] | null> {
  const [record] = await baseQuery.limit(1);
  return record ?? null;
}

/**
 * Common error messages for consistent error handling.
 */
export const COMMON_ERRORS = {
  NOT_FOUND: "Record not found",
  NOT_IN_ORGANIZATION: "Record not found in organization",
  ORGANIZATION_MISMATCH: "Record does not belong to organization",
  INVALID_FIELD_NAME: "Invalid field name - use snake_case",
} as const;

/**
 * Development helper for validating field names in queries
 * Only active in development environment to catch field naming errors early
 * @param tableName - The table being queried
 * @param fields - Array of field names being accessed
 * @example
 * ```typescript
 * // Validate before query construction
 * validateQueryFields('users', ['email', 'created_at']); // OK
 * validateQueryFields('users', ['emailAddress']); // Throws in development
 * ```
 */
export function validateQueryFields(
  tableName: Parameters<typeof devValidateFields>[0],
  fields: string[],
): void {
  try {
    devValidateFields(tableName, fields);
  } catch (error) {
    // In development/test, rethrow validation errors for stricter checks
    if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
      throw error;
    }
    // In production, just log the warning
    console.warn(
      `⚠️  Field validation warning for table '${tableName}':`,
      error,
    );
  }
}
