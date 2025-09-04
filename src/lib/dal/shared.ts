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
 * Require authenticated user for Server Components
 * DEPRECATED: Use organization-context functions directly instead
 * Uses React 19 cache() for request-level memoization
 *
 * @deprecated This function creates circular dependencies. Use getServerAuthContext() + organization-context functions instead
 */
export const requireAuthContext = cache(async () => {
  const { user } = await getServerAuthContext();

  if (!user) {
    throw new Error("Authentication required");
  }

  // Note: Callers should use organization-context functions for org resolution
  // This avoids circular dependency between DAL and organization-context
  throw new Error(
    "requireAuthContext is deprecated. Use getServerAuthContext() + organization-context functions to avoid circular dependencies."
  );
});

/**
 * New organization-aware auth context (for migration)
 * Accepts organizationId from request-time resolution
 * Uses React 19 cache() for request-level memoization
 */
export const requireAuthContextWithOrg = cache(
  async (organizationId: string) => {
    if (!organizationId) {
      throw new Error("Organization ID required");
    }

    const { user } = await getServerAuthContext();

    if (!user) {
      throw new Error("Authentication required");
    }

    // Validate user has membership in the requested organization
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.user_id, user.id),
        eq(memberships.organization_id, organizationId),
      ),
    });

    if (!membership) {
      throw new Error("User does not have access to this organization");
    }

    return { user, organizationId };
  },
);

/**
 * Get user role and permissions for specific organization
 * DEPRECATED: Creates circular dependency patterns
 * Uses React 19 cache() for request-level memoization
 * 
 * @deprecated Use organization-context functions + getUserRoleInOrganization(userId, orgId) instead
 */
export const getServerAuthContextWithRole = cache(async () => {
  throw new Error(
    "getServerAuthContextWithRole is deprecated. Use organization-context functions + explicit organizationId parameters to avoid circular dependencies."
  );
});

/**
 * Type for complete auth context with all required properties
 */
interface CompleteAuthContext {
  user: NonNullable<
    Awaited<ReturnType<typeof getServerAuthContextWithRole>>["user"]
  >;
  organizationId: NonNullable<
    Awaited<ReturnType<typeof getServerAuthContextWithRole>>["organizationId"]
  >;
  membership: NonNullable<
    Awaited<ReturnType<typeof getServerAuthContextWithRole>>["membership"]
  >;
  role: NonNullable<
    Awaited<ReturnType<typeof getServerAuthContextWithRole>>["role"]
  >;
  permissions: Awaited<
    ReturnType<typeof getServerAuthContextWithRole>
  >["permissions"];
}

/**
 * Type guard to check if context has all required properties
 */
function hasCompleteAuthContext(
  context: Awaited<ReturnType<typeof getServerAuthContextWithRole>>,
): context is CompleteAuthContext {
  return !!(
    context.user &&
    context.organizationId &&
    context.membership &&
    context.role
  );
}

/**
 * Require authenticated user context with role validation
 * DEPRECATED: Creates circular dependency patterns
 * Uses React 19 cache() for request-level memoization
 * 
 * @deprecated Use organization-context functions + explicit role validation instead
 */
export const requireAuthContextWithRole = cache(
  async (): Promise<CompleteAuthContext> => {
    throw new Error(
      "requireAuthContextWithRole is deprecated. Use organization-context functions + explicit role validation to avoid circular dependencies."
    );
  },
);

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
