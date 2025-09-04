/**
 * Organizations Data Access Layer
 * Direct database queries for Server Components
 * Includes organization statistics and management queries
 */

import { cache } from "react";
import { eq, sql, count, and } from "drizzle-orm";
import {
  organizations,
  issues,
  machines,
  memberships,
  roles,
  issueStatuses,
  priorities,
} from "~/server/db/schema";
import { db } from "./shared";
import { ensureOrgContextAndBindRLS } from "~/lib/organization-context";
import { withOrgRLS } from "~/server/db/utils/rls";
import { safeCount, type CountResult } from "~/lib/types/database-results";

/**
 * Get organization by ID with caching
 * Enforces organization access through membership validation
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationById = cache(async (organizationId: string) => {
  return withOrgRLS(db, organizationId, async (tx) => {
    const organization = await tx.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: {
        id: true,
        name: true,
        subdomain: true,
        logo_url: true,
        // Phase 4B.1: Organization profile fields
        description: true,
        website: true,
        phone: true,
        address: true,
  allow_anonymous_issues: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!organization) {
      throw new Error("Organization not found");
    }

    return organization;
  });
});

/**
 * Get current user's organization
 * Uses authenticated context to get organization with automatic scoping
 * Uses React 19 cache() for request-level memoization
 */
export const getCurrentOrganization = cache(async () => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;
    const org = await tx.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: {
        id: true,
        name: true,
        subdomain: true,
        logo_url: true,
        description: true,
        website: true,
        phone: true,
        address: true,
  allow_anonymous_issues: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!org) throw new Error("Organization not found");
    return org;
  });
});

/**
 * Get comprehensive organization statistics for dashboard
 * Includes issues, machines, and member counts with parallel queries
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationStats = cache(async () => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;

    const [issueStats, machineCount, memberCount] = await Promise.all([
      tx
        .select({
          total: count(issues.id),
          new: sql<number>`count(*) filter (where ${issueStatuses.category} = 'NEW')`,
          inProgress: sql<number>`count(*) filter (where ${issueStatuses.category} = 'IN_PROGRESS')`,
          resolved: sql<number>`count(*) filter (where ${issueStatuses.category} = 'RESOLVED')`,
        })
        .from(issues)
        .innerJoin(issueStatuses, eq(issues.status_id, issueStatuses.id))
        .where(eq(issues.organization_id, organizationId)),

      tx
        .select({ count: count() })
        .from(machines)
        .where(eq(machines.organization_id, organizationId)),

      tx
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
        total: safeCount(machineCount),
      },
      members: {
        total: safeCount(memberCount),
      },
    };
  });
});

/**
 * Get organization members with user and role information
 * Includes pagination support for large organizations
 * Uses React 19 cache() for request-level memoization per page
 */
export const getOrganizationMembers = cache(async (page = 1, limit = 20) => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;
    const offset = (page - 1) * limit;

    return await tx.query.memberships.findMany({
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
  });
});

/**
 * Get organization member count for pagination
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationMemberCount = cache(async () => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;
    const result: CountResult[] = await tx
      .select({ count: count() })
      .from(memberships)
      .where(eq(memberships.organization_id, organizationId));
    return safeCount(result);
  });
});

/**
 * Get organization roles for role management
 * Includes system vs custom role identification
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationRoles = cache(async () => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;
    return await tx.query.roles.findMany({
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
});

/**
 * Validate user membership in organization
 * Returns membership with role information if valid
 * Uses React 19 cache() for request-level memoization per userId
 */
export const validateUserMembership = cache(async (userId: string) => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;
    return await tx.query.memberships.findFirst({
      where: and(
        eq(memberships.user_id, userId),
        eq(memberships.organization_id, organizationId),
      ),
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
  });
});

/**
 * Get organization dashboard summary data
 * Optimized query combining key statistics for dashboard display
 * Uses React 19 cache() for request-level memoization
 */
export const getOrganizationDashboardData = cache(async () => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;

    const [organization, stats] = await Promise.all([
      tx.query.organizations
        .findFirst({
          where: eq(organizations.id, organizationId),
          columns: { id: true, name: true, subdomain: true, logo_url: true },
        })
        .then((o) => {
          if (!o) throw new Error("Organization not found");
          return o;
        }),
      getOrganizationStats(),
    ]);

    return { organization, stats };
  });
});

/**
 * Get available issue statuses for organization
 * Returns statuses that can be used for issue status updates
 * Uses React 19 cache() for request-level memoization
 */
export const getAvailableStatuses = cache(async () => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;

    return await tx.query.issueStatuses.findMany({
      where: eq(issueStatuses.organization_id, organizationId),
      columns: {
        id: true,
        name: true,
        category: true,
      },
      orderBy: [issueStatuses.name],
    });
  });
});

/**
 * Get available priorities for organization
 * Returns priorities that can be used for issue creation and updates
 * Uses React 19 cache() for request-level memoization
 */
export const getAvailablePriorities = cache(async () => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;

    return await tx.query.priorities.findMany({
      where: eq(priorities.organization_id, organizationId),
      columns: {
        id: true,
        name: true,
        order: true,
      },
      orderBy: [priorities.order],
    });
  });
});
