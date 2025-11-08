/**
 * Request-Time Organization Context Resolution
 *
 * Provides organization context independent of user authentication status.
 * Supports both authenticated and anonymous users accessing organizational data
 * with appropriate access level determination.
 */

import { getDb } from "~/lib/dal/shared";
import { sql } from "drizzle-orm";
// Phase 1: Import canonical resolver directly (legacy wrappers removed)
import { requireAuthorized } from "~/server/auth/context";
import { withOrgRLS } from "~/server/db/utils/rls";
import type { DrizzleClient } from "~/server/db/drizzle";
import type { OrganizationContext } from "~/lib/types";
// Legacy wrapper functions removed - use canonical resolver from ~/server/auth/context directly

/**
 * Set database session variable for RLS policies
 * Call this to enable database-level organization isolation
 */
export const setRLSOrganizationContext = async (
  organizationId: string,
): Promise<void> => {
  try {
    // Use Drizzle sql template for safe parameterization
    await getDb().execute(
      sql`SET LOCAL app.current_organization_id = ${organizationId}`,
    );
  } catch (error) {
    console.warn("Failed to set RLS organization context:", error);
    // Continue execution - application-level filtering will still work
  }
};

/**
 * Ensure organization context exists and run a function inside an RLS-bound transaction.
 * Returns the result of the function. Use for Server Components and Server Actions.
 * Updated to use canonical resolver directly.
 */
export async function ensureOrgContextAndBindRLS<T>(
  fn: (tx: DrizzleClient, context: OrganizationContext) => Promise<T>,
): Promise<T> {
  const authContext = await requireAuthorized();

  // Map to legacy OrganizationContext shape for compatibility
  const context: OrganizationContext = {
    user: authContext.user,
    organization: {
      id: authContext.org.id,
      name: authContext.org.name,
      subdomain: authContext.org.subdomain,
    },
    membership: authContext.membership,
    accessLevel: "member" as const,
  };

  return withOrgRLS(getDb(), context.organization.id, async (tx) => fn(tx, context));
}
