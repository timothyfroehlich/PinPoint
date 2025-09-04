/**
 * Request-Time Organization Context Resolution
 *
 * Provides organization context independent of user authentication status.
 * Supports both authenticated and anonymous users accessing organizational data
 * with appropriate access level determination.
 */

import { cache } from "react";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "~/lib/dal/shared";
import { getOrganizationBySubdomain, getUserMembershipPublic } from "~/lib/dal/public-organizations";
import { createClient } from "~/lib/supabase/server";
import { isDevelopment } from "~/lib/environment";
import { extractTrustedSubdomain } from "~/lib/subdomain-verification";
import { withOrgRLS } from "~/server/db/utils/rls";
import type { DrizzleClient } from "~/server/db/drizzle";
import type { OrganizationContext, AccessLevel } from "~/lib/types";

/**
 * Extract subdomain from request headers
 * Works with both development (subdomain.localhost:3000) and production patterns
 */
async function extractSubdomain(): Promise<string | null> {
  const headersList = await headers();

  // Prefer trusted subdomain header values (set by middleware)
  const trusted = extractTrustedSubdomain(headersList as unknown as Headers);
  if (trusted) return trusted;

  // Fall back to Host header parsing
  const host = headersList.get("host");
  if (!host) return null;

  // Remove port from host for parsing
  const hostParts = host.split(":");
  const hostWithoutPort = hostParts[0];

  if (!hostWithoutPort) return null;

  if (isDevelopment()) {
    // Development: subdomain.localhost
    if (hostWithoutPort === "localhost") return null;
    const parts = hostWithoutPort.split(".");
    if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
      return parts[0] ?? null;
    }
    return null;
  } else {
    // Production: subdomain.domain.com
    const parts = hostWithoutPort.split(".");
    if (parts.length >= 3) {
      return parts[0] ?? null;
    }
    return null;
  }
}

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
 * Determines organization from subdomain and user access level
 *
 * Returns null if no valid organization context can be established
 */
export const getOrganizationContext = cache(
  async (): Promise<OrganizationContext | null> => {
    // Extract subdomain from request
    const subdomain = await extractSubdomain();
    if (!subdomain) {
      return null;
    }

    // Resolve organization from subdomain
    const organization = await resolveOrganization(subdomain);
    if (!organization) {
      return null;
    }

    // Get current user (if authenticated)
    let user = null;
    let accessLevel: AccessLevel = "anonymous";
    let membership = undefined;

    try {
      const supabase = await createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const email = authUser.email ?? "";
        const name =
          (authUser.user_metadata["name"] as string | undefined) ?? email;
        user = {
          id: authUser.id,
          email,
          name,
        };

        accessLevel = "authenticated";

        // Check if user has membership in this organization
        const userMembership = await getUserMembership(
          authUser.id,
          organization.id,
        );
        if (userMembership) {
          accessLevel = "member";
          membership = {
            id: userMembership.id,
            role: userMembership.role,
          };
        }
      }
    } catch (error) {
      // If auth fails, continue as anonymous user
      console.warn("Auth check failed in organization context:", error);
    }

    const context: OrganizationContext = {
      organization,
      user,
      accessLevel,
    };

    if (membership) {
      context.membership = membership;
    }

    return context;
  },
);

/**
 * Require organization context (throws if not available)
 * Use this in Server Components that need organization context
 */
export const requireOrganizationContext = cache(
  async (): Promise<OrganizationContext> => {
    const context = await getOrganizationContext();
    if (!context) {
      throw new Error(
        "Organization context not available - invalid subdomain or organization not found",
      );
    }
    return context;
  },
);

/**
 * Require member-level access (throws if user is not a member)
 * Use this in Server Components that require organizational membership
 */
export const requireMemberAccess = cache(
  async (): Promise<
    OrganizationContext & {
      user: NonNullable<OrganizationContext["user"]>;
      accessLevel: "member";
      membership: NonNullable<OrganizationContext["membership"]>;
    }
  > => {
    const context = await requireOrganizationContext();

    if (
      context.accessLevel !== "member" ||
      !context.user ||
      !context.membership
    ) {
      throw new Error(
        "Member access required - user does not have membership in this organization",
      );
    }

    return context as OrganizationContext & {
      user: NonNullable<OrganizationContext["user"]>;
      accessLevel: "member";
      membership: NonNullable<OrganizationContext["membership"]>;
    };
  },
);

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
export async function ensureOrgContextAndBindRLS<T>(
  fn: (tx: DrizzleClient, context: OrganizationContext) => Promise<T>,
): Promise<T> {
  const context = await requireOrganizationContext();
  return withOrgRLS(db, context.organization.id, async (tx) => fn(tx, context));
}
