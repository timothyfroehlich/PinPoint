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
 * Get current authenticated user with organization context
 * Uses the new organization context system for request-time organization resolution
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

  // Import here to avoid circular dependency
  const { getOrganizationContext } = await import("~/lib/organization-context");

  try {
    // Get organization context from the new system
    const orgContext = await getOrganizationContext();

    if (
      orgContext?.user?.id === user.id &&
      orgContext.accessLevel === "member" &&
      orgContext.membership
    ) {
      return {
        user,
        organizationId: orgContext.organization.id,
        membership: orgContext.membership,
        role: orgContext.membership.role,
      };
    }
  } catch (error) {
    console.warn("Failed to get organization context:", error);
  }

  // Return user without organization context if not a member or context unavailable
  return {
    user,
    organizationId: null,
    membership: null,
    role: null,
  };
});

/**
 * Require authenticated user and organization for Server Components
 * TEMPORARY: Keeping this working during architecture transition
 * Uses React 19 cache() for request-level memoization
 *
 * @deprecated This function will be replaced with request-time organization context
 */
export const requireAuthContext = cache(async () => {
  // Fetch full Supabase AuthUser first for compatibility
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  // Use secure organization resolution and membership validation
  const { requireMemberAccess } = await import("~/lib/organization-context");
  const { organization } = await requireMemberAccess();

  return { user, organizationId: organization.id };
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
 * Get authenticated user context with role and permissions
 * Uses the new organization context system with enhanced role information
 * Uses React 19 cache() for request-level memoization
 */
export const getServerAuthContextWithRole = cache(async () => {
  const baseContext = await getServerAuthContext();

  if (baseContext.user == null || baseContext.organizationId == null) {
    return {
      user: null,
      organizationId: null,
      membership: null,
      role: null,
      permissions: [],
    };
  }

  // Get enhanced role information with permissions from database
  const enhancedMembership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.user_id, baseContext.user.id),
      eq(memberships.organization_id, baseContext.organizationId),
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

  if (!enhancedMembership) {
    return {
      user: baseContext.user,
      organizationId: baseContext.organizationId,
      membership: null,
      role: null,
      permissions: [],
    };
  }

  // Extract permissions for easy access
  const permissions = enhancedMembership.role.rolePermissions.map(
    (rp) => rp.permission.name,
  );

  return {
    user: baseContext.user,
    organizationId: baseContext.organizationId,
    membership: enhancedMembership,
    role: enhancedMembership.role,
    permissions,
  };
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
 * Throws if not authenticated, no organization, or no role assigned
 * Uses React 19 cache() for request-level memoization
 */
export const requireAuthContextWithRole = cache(
  async (): Promise<CompleteAuthContext> => {
    const context = await getServerAuthContextWithRole();

    if (!context.user) {
      throw new Error("Authentication required");
    }

    if (!context.organizationId) {
      throw new Error("Organization selection required");
    }

    if (context.role === null) {
      throw new Error("Role assignment required");
    }

    if (!hasCompleteAuthContext(context)) {
      throw new Error("Incomplete authentication context");
    }

    return context;
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
