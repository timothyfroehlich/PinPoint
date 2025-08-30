/**
 * Public Organizations Data Access Layer
 * Organization queries that don't require authentication
 * Used for login flow organization selection and middleware subdomain mapping
 */

import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { organizations } from "~/server/db/schema";
import { getGlobalDatabaseProvider } from "~/server/db/provider";

/**
 * Database instance for public queries (no auth context required)
 */
const db = getGlobalDatabaseProvider().getClient();

/**
 * Organization option for login dropdown
 */
export interface OrganizationOption {
  id: string;
  name: string;
  subdomain: string;
}

/**
 * Get all organizations for login dropdown
 * No authentication required - public endpoint for organization selection
 * Uses React 19 cache() for request-level memoization
 */
export const getAllOrganizationsForLogin = cache(async (): Promise<OrganizationOption[]> => {
  const orgs = await db.query.organizations.findMany({
    columns: {
      id: true,
      name: true,
      subdomain: true,
    },
    orderBy: (organizations, { asc }) => [asc(organizations.name)],
  });

  return orgs;
});

/**
 * Map subdomain to organization ID
 * Used by middleware and tRPC context for organization resolution
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationBySubdomain = cache(async (subdomain: string) => {
  if (!subdomain) {
    return null;
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
    columns: {
      id: true,
      name: true,
      subdomain: true,
      logo_url: true,
    },
  });

  return organization || null;
});

/**
 * Get organization display information by ID
 * Public function that doesn't require auth context
 * Uses React 19 cache() for request-level memoization
 */
export const getPublicOrganizationById = cache(async (organizationId: string) => {
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      id: true,
      name: true,
      subdomain: true,
      logo_url: true,
    },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  return organization;
});

/**
 * Get formatted organization options for login dropdown
 * Includes sorting and default organization identification
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationSelectOptions = cache(async () => {
  const organizations = await getAllOrganizationsForLogin();

  // Find APC (default organization) by looking for the seed data organization
  const apcOrganization = organizations.find(org => 
    org.subdomain === 'apc' || org.id === 'test-org-pinpoint'
  );

  // Sort with APC first if found, then alphabetical
  const sortedOrgs = organizations.sort((a, b) => {
    if (apcOrganization && a.id === apcOrganization.id) return -1;
    if (apcOrganization && b.id === apcOrganization.id) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    organizations: sortedOrgs,
    defaultOrganizationId: apcOrganization?.id || sortedOrgs[0]?.id || null,
  };
});

/**
 * Validate that an organization exists and is accessible
 * Used for form validation and security checks
 * Uses React 19 cache() for request-level memoization
 */
export const validateOrganizationExists = cache(async (organizationId: string): Promise<boolean> => {
  try {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: {
        id: true,
      },
    });
    
    return !!organization;
  } catch (error) {
    console.error('Error validating organization:', error);
    return false;
  }
});

/**
 * Get organization subdomain by ID
 * Used for post-auth redirect URL construction
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationSubdomainById = cache(async (organizationId: string): Promise<string | null> => {
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      subdomain: true,
    },
  });

  return organization?.subdomain || null;
});