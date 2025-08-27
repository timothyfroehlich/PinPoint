/**
 * Shared utilities for Data Access Layer
 * Enables Server Components to query database directly
 */

import { cache } from "react";
import { createClient } from "~/lib/supabase/server";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { and, eq } from "drizzle-orm";
import { memberships } from "~/server/db/schema";

/**
 * Database instance for DAL functions
 */
export const db = getGlobalDatabaseProvider().getClient();

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
    return { user: null, organizationId: null, membership: null, role: null };
  }

  const organizationId = user.user_metadata?.["organizationId"] as string | undefined;

  return {
    user,
    organizationId: organizationId || null,
    membership: null,
    role: null,
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
 * Get authenticated user context with role and permissions
 * Includes membership and role information for authorization
 * Uses React 19 cache() for request-level memoization
 */
export const getServerAuthContextWithRole = cache(async () => {
  const { user, organizationId } = await getServerAuthContext();
  
  if (!user || !organizationId) {
    return { user: null, organizationId: null, membership: null, role: null, permissions: [] };
  }
  
  // Get user membership with role and permissions
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.user_id, user.id),
      eq(memberships.organization_id, organizationId)
    ),
    with: {
      role: {
        columns: {
          id: true,
          name: true,
          is_system: true,
          is_default: true,
        },
        with: {
          rolePermissions: {
            with: {
              permission: {
                columns: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
      },
    },
  });
  
  if (!membership) {
    return { user, organizationId, membership: null, role: null, permissions: [] };
  }
  
  // Extract permissions for easy access
  const permissions = membership.role.rolePermissions.map(rp => rp.permission.name);
  
  return {
    user,
    organizationId,
    membership,
    role: membership.role,
    permissions,
  };
});

/**
 * Require authenticated user context with role validation
 * Throws if not authenticated, no organization, or no role assigned
 * Uses React 19 cache() for request-level memoization
 */
export const requireAuthContextWithRole = cache(async () => {
  const context = await getServerAuthContextWithRole();
  
  if (!context.user) {
    throw new Error("Authentication required");
  }
  
  if (!context.organizationId) {
    throw new Error("Organization selection required");
  }
  
  if (!context.membership || !context.role) {
    throw new Error("Role assignment required");
  }
  
  return {
    user: context.user,
    organizationId: context.organizationId,
    membership: context.membership,
    role: context.role,
    permissions: context.permissions,
  };
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