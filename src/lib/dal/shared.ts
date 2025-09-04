/**
 * Shared utilities for Data Access Layer
 * Enables Server Components to query database directly
 */

import { cache } from "react";
import { createClient } from "~/lib/supabase/server";
import { getGlobalDatabaseProvider } from "~/server/db/provider";

/**
 * Database instance for DAL functions
 */
export const db = getGlobalDatabaseProvider().getClient();

/**
 * Get current authenticated user (no organization context)
 * Pure auth context without organizational dependencies
 * Uses React 19 cache() for request-level memoization to eliminate duplicate auth queries
 */
export const getServerAuthContext = cache(async () => {
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
