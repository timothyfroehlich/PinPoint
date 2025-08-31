/**
 * Request-Time Organization Context Resolution
 * 
 * Provides organization context independent of user authentication status.
 * Supports both authenticated and anonymous users accessing organizational data
 * with appropriate access level determination.
 */

import { cache } from "react";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "~/lib/dal/shared";
import { organizations, memberships } from "~/server/db/schema";
import { createClient } from "~/utils/supabase/server";
import { isDevelopment } from "~/lib/environment";

export type AccessLevel = "anonymous" | "authenticated" | "member";

export interface OrganizationContext {
  organization: {
    id: string;
    name: string;
    subdomain: string;
  };
  user: {
    id: string;
    email: string;
    name?: string;
  } | null;
  accessLevel: AccessLevel;
  membership?: {
    id: string;
    role: {
      id: string;
      name: string;
    };
  };
}

/**
 * Extract subdomain from request headers
 * Works with both development (subdomain.localhost:3000) and production patterns
 */
async function extractSubdomain(): Promise<string | null> {
  const headersList = await headers();
  
  // Try x-subdomain header first (set by middleware)
  const subdomainHeader = headersList.get("x-subdomain");
  if (subdomainHeader) {
    return subdomainHeader;
  }
  
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
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
    columns: {
      id: true,
      name: true,
      subdomain: true,
    },
  });
  
  return organization;
});

/**
 * Get user membership in specific organization
 * Returns membership with role if user is a member, null otherwise
 */
export const getUserMembership = cache(async (userId: string, organizationId: string) => {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.user_id, userId),
      eq(memberships.organization_id, organizationId),
    ),
    with: {
      role: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });
  
  return membership;
});

/**
 * Get current organization context from request
 * Determines organization from subdomain and user access level
 * 
 * Returns null if no valid organization context can be established
 */
export const getOrganizationContext = cache(async (): Promise<OrganizationContext | null> => {
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
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (authUser) {
      user = {
        id: authUser.id,
        email: authUser.email!,
        name: authUser.user_metadata?.['name'] || authUser.email!,
      };
      
      accessLevel = "authenticated";
      
      // Check if user has membership in this organization
      const userMembership = await getUserMembership(authUser.id, organization.id);
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
});

/**
 * Require organization context (throws if not available)
 * Use this in Server Components that need organization context
 */
export const requireOrganizationContext = cache(async (): Promise<OrganizationContext> => {
  const context = await getOrganizationContext();
  if (!context) {
    throw new Error("Organization context not available - invalid subdomain or organization not found");
  }
  return context;
});

/**
 * Require member-level access (throws if user is not a member)
 * Use this in Server Components that require organizational membership
 */
export const requireMemberAccess = cache(async (): Promise<OrganizationContext & { 
  user: NonNullable<OrganizationContext["user"]>;
  accessLevel: "member";
  membership: NonNullable<OrganizationContext["membership"]>;
}> => {
  const context = await requireOrganizationContext();
  
  if (context.accessLevel !== "member" || !context.user || !context.membership) {
    throw new Error("Member access required - user does not have membership in this organization");
  }
  
  return context as any; // TypeScript assertion - we've validated the types above
});

/**
 * Set database session variable for RLS policies
 * Call this to enable database-level organization isolation
 */
export const setRLSOrganizationContext = async (organizationId: string): Promise<void> => {
  try {
    await db.execute(
      `SET LOCAL app.current_organization_id = '${organizationId}'`
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
export const setupOrganizationContext = cache(async (): Promise<OrganizationContext> => {
  const context = await requireOrganizationContext();
  
  // Set database session variable for RLS policies
  await setRLSOrganizationContext(context.organization.id);
  
  return context;
});