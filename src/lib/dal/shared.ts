/**
 * Shared utilities for Data Access Layer
 * Enables Server Components to query database directly
 */

import { cache } from "react";
import { eq, type Column } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { getGlobalDatabaseProvider } from "~/server/db/provider";

/**
 * Database instance for DAL functions
 */
export const db = getGlobalDatabaseProvider().getClient();

/**
 * Get current authenticated user for DAL functions (no organization context)
 * Pure auth context without organizational dependencies
 * Uses React 19 cache() for request-level memoization to eliminate duplicate auth queries
 */
export const getDALAuthContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null };
  }

  return { user };
});



/**
 * Pagination helpers for Server Components
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export function getPaginationParams(options: PaginationOptions = {}): {
  limit: number;
  offset: number;
  page: number;
} {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const offset = (page - 1) * limit;

  return { limit, offset, page };
}

/**
 * Organization scoping utilities for database queries
 * Eliminates the manual `eq(table.organization_id, organizationId)` pattern across 50+ files
 */

/**
 * Creates organization scoping condition for database queries
 * 
 * Replaces: eq(issues.organization_id, organizationId)
 * With: withOrgScope(organizationId, issues.organization_id)
 */
export function withOrgScope(organizationId: string, organizationColumn: Column) {
  return eq(organizationColumn, organizationId);
}

/**
 * Creates an organization-scoped where clause for entity queries
 * 
 * Replaces: { where: { id: entityId, organizationId } }
 * With: withOrgEntityScope(entityId, organizationId, table)
 */
export function withOrgEntityScope(
  entityId: string, 
  organizationId: string, 
  entityIdColumn: Column,
  organizationColumn: Column
) {
  return {
    id: eq(entityIdColumn, entityId),
    organizationId: eq(organizationColumn, organizationId)
  };
}
