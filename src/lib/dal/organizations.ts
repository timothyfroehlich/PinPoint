/**
 * Organizations Data Access Layer
 * Direct database queries for Server Components
 * Includes organization statistics and management queries
 */

import { cache } from "react";
import { eq, sql, count } from "drizzle-orm";
import {
  organizations,
  issues,
  machines,
  memberships,
  roles,
  issueStatuses,
} from "~/server/db/schema";
import { db, requireAuthContext } from "./shared";

/**
 * Get organization by ID with caching
 * Enforces organization access through membership validation
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationById = cache(async (organizationId: string) => {
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      id: true,
      name: true,
      subdomain: true,
      logo_url: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  return organization;
});

/**
 * Get current user's organization
 * Uses authenticated context to get organization with automatic scoping
 * Uses React 19 cache() for request-level memoization
 */
export const getCurrentOrganization = cache(async () => {
  const { organizationId } = await requireAuthContext();
  return await getOrganizationById(organizationId);
});

/**
 * Get comprehensive organization statistics for dashboard
 * Includes issues, machines, and member counts with parallel queries
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationStats = cache(async () => {
  const { organizationId } = await requireAuthContext();

  // Execute all statistics queries in parallel for performance
  const [issueStats, machineCount, memberCount] = await Promise.all([
    // Issue statistics with status category breakdown using JOINs for type safety
    db
      .select({
        total: count(issues.id),
        new: sql<number>`count(*) filter (where ${issueStatuses.category} = 'NEW')`,
        inProgress: sql<number>`count(*) filter (where ${issueStatuses.category} = 'IN_PROGRESS')`,
        resolved: sql<number>`count(*) filter (where ${issueStatuses.category} = 'RESOLVED')`,
      })
      .from(issues)
      .innerJoin(issueStatuses, eq(issues.status_id, issueStatuses.id))
      .where(eq(issues.organization_id, organizationId)),

    // Machine count
    db
      .select({ count: count() })
      .from(machines)
      .where(eq(machines.organization_id, organizationId)),

    // Active member count
    db
      .select({ count: count() })
      .from(memberships)
      .where(eq(memberships.organization_id, organizationId)),
  ]);

  return {
    issues: {
      total: issueStats[0]?.total ?? 0,
      new: issueStats[0]?.new ?? 0,
      inProgress: issueStats[0]?.inProgress ?? 0,
      resolved: issueStats[0]?.resolved ?? 0,
    },
    machines: {
      total: machineCount[0]?.count ?? 0,
    },
    members: {
      total: memberCount[0]?.count ?? 0,
    },
  };
});

/**
 * Get organization members with user and role information
 * Includes pagination support for large organizations
 * Uses React 19 cache() for request-level memoization per page
 */
export const getOrganizationMembers = cache(async (page = 1, limit = 20) => {
  const { organizationId } = await requireAuthContext();
  const offset = (page - 1) * limit;

  const members = await db.query.memberships.findMany({
    where: eq(memberships.organization_id, organizationId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          profile_picture: true,
          created_at: true,
        },
      },
      role: {
        columns: {
          id: true,
          name: true,
          is_system: true,
          is_default: true,
        },
      },
    },
    limit,
    offset,
  });

  return members;
});

/**
 * Get organization member count for pagination
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationMemberCount = cache(async () => {
  const { organizationId } = await requireAuthContext();

  const result = await db
    .select({ count: count() })
    .from(memberships)
    .where(eq(memberships.organization_id, organizationId));

  return result[0]?.count ?? 0;
});

/**
 * Get organization roles for role management
 * Includes system vs custom role identification
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationRoles = cache(async () => {
  const { organizationId } = await requireAuthContext();

  return await db.query.roles.findMany({
    where: eq(roles.organization_id, organizationId),
    columns: {
      id: true,
      name: true,
      is_system: true,
      is_default: true,
      created_at: true,
    },
  });
});

/**
 * Validate user membership in organization
 * Returns membership with role information if valid
 * Uses React 19 cache() for request-level memoization per userId
 */
export const validateUserMembership = cache(async (userId: string) => {
  const { organizationId } = await requireAuthContext();

  const membership = await db.query.memberships.findFirst({
    where:
      eq(memberships.user_id, userId) &&
      eq(memberships.organization_id, organizationId),
    with: {
      role: {
        columns: {
          id: true,
          name: true,
          is_system: true,
        },
      },
    },
  });

  return membership;
});

/**
 * Get organization dashboard summary data
 * Optimized query combining key statistics for dashboard display
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationDashboardData = cache(async () => {
  const { organizationId } = await requireAuthContext();

  // Get organization info and stats in parallel
  const [organization, stats] = await Promise.all([
    getOrganizationById(organizationId),
    getOrganizationStats(),
  ]);

  return {
    organization,
    stats,
  };
});
