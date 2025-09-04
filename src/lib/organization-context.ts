/**
 * Request-Time Organization Context Resolution
 *
 * Provides organization context independent of user authentication status.
 * Supports both authenticated and anonymous users accessing organizational data
 * with appropriate access level determination.
 */

import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "~/lib/dal/shared";
import { getOrganizationBySubdomain, getUserMembershipPublic } from "~/lib/dal/public-organizations";
// Phase 1: Import adapters for legacy function compatibility
import {
  getOrganizationContextAdapter,
  requireOrganizationContextAdapter,
  requireMemberAccessAdapter,
} from "~/server/auth/legacy-adapters";
import { withOrgRLS } from "~/server/db/utils/rls";
import type { DrizzleClient } from "~/server/db/drizzle";
import type { OrganizationContext } from "~/lib/types";
// Re-export canonical resolver (Phase 1 consolidation)
export { getRequestAuthContext } from "~/server/auth/context";


/**
 * Resolve organization from subdomain
 * Returns organization entity if found, null otherwise
 */
export const resolveOrganization = cache(async (subdomain: string) => {
  return await getOrganizationBySubdomain(subdomain);
});

/**
 * Get user membership in specific organization
 * Returns membership with role if user is a member, null otherwise
 */
export const getUserMembership = cache(
  async (userId: string, organizationId: string) => {
    return await getUserMembershipPublic(userId, organizationId);
  },
);

/**
 * Get current organization context from request
 * Phase 1: Now using adapter with deprecation warning
 */
export const getOrganizationContext = getOrganizationContextAdapter;

/**
 * Require organization context (throws if not available)
 * Phase 1: Now using adapter with deprecation warning
 */
export const requireOrganizationContext = requireOrganizationContextAdapter;

/**
 * Require member-level access (throws if user is not a member)
 * Phase 1: Now using adapter with deprecation warning
 */
export const requireMemberAccess = requireMemberAccessAdapter;

/**
 * Set database session variable for RLS policies
 * Call this to enable database-level organization isolation
 */
export const setRLSOrganizationContext = async (
  organizationId: string,
): Promise<void> => {
  try {
    // Use Drizzle sql template for safe parameterization
    await db.execute(
      sql`SET LOCAL app.current_organization_id = ${organizationId}`,
    );
  } catch (error) {
    console.warn("Failed to set RLS organization context:", error);
    // Continue execution - application-level filtering will still work
  }
};

/**
 * Complete organization context setup for Server Components
 * Resolves organization, validates access, and sets RLS context
 *
 * @returns Organization context with user access level
 */
export const setupOrganizationContext = cache(
  async (): Promise<OrganizationContext> => {
    const context = await requireOrganizationContext();

    // Set database session variable for RLS policies
    await setRLSOrganizationContext(context.organization.id);

    return context;
  },
);

/**
 * Ensure organization context exists and run a function inside an RLS-bound transaction.
 * Returns the result of the function. Use for Server Components and Server Actions.
 */
// (Removed duplicate getRequestAuthContext implementation; canonical version now lives in ~/server/auth/context)

export async function ensureOrgContextAndBindRLS<T>(
  fn: (tx: DrizzleClient, context: OrganizationContext) => Promise<T>,
): Promise<T> {
  const context = await requireOrganizationContext();
  return withOrgRLS(db, context.organization.id, async (tx) => fn(tx, context));
}
