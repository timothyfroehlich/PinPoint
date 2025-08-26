/**
 * Shared utilities for Data Access Layer
 * Enables Server Components to query database directly
 */

import { cache } from "react";
import { createClient } from "~/lib/supabase/server";
import { getGlobalDatabaseProvider } from "~/server/db/provider";

/**
 * Get current authenticated user and organization context for Server Components
 * Uses React 19 cache() for request-level memoization to eliminate duplicate auth queries
 */
export const getServerAuthContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, organizationId: null };
  }

  const organizationId = user.user_metadata?.["organizationId"] as string | undefined;

  return {
    user,
    organizationId: organizationId || null,
  };
});

/**
 * Require authenticated user and organization for Server Components
 * Throws if not authenticated or no organization selected
 * Uses React 19 cache() for request-level memoization
 */
export const requireAuthContext = cache(async () => {
  const { user, organizationId } = await getServerAuthContext();
  
  if (!user) {
    throw new Error("Authentication required");
  }
  
  if (!organizationId) {
    throw new Error("Organization selection required");
  }
  
  return { user, organizationId };
});

/**
 * Pagination helpers for Server Components
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export function getPaginationParams(options: PaginationOptions = {}) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;
  
  return { limit, offset, page };
}

/**
 * Database instance for DAL functions
 */
export const db = getGlobalDatabaseProvider().getClient();