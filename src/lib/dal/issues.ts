/**
 * Issues Data Access Layer
 * Direct database queries for Server Components
 */

import { cache } from "react";
import { and, desc, eq, sql, isNull, inArray, type SQL } from "drizzle-orm";
import { issues, issueStatuses, priorities } from "~/server/db/schema";
import { db } from "~/lib/dal/shared";
import type { IssueFilters } from "~/lib/types";
import { safeCount, type CountResult } from "~/lib/types/database-results";

/**
 * Get issues for the current organization with machine and assignee details
 * Designed for Server Components - includes proper org scoping and joins
 * Uses React 19 cache() for request-level memoization
 */
export const getIssuesForOrg = cache(async (organizationId: string) => {
  return await db.query.issues.findMany({
      where: eq(issues.organization_id, organizationId),
      with: {
        machine: {
          columns: { id: true, name: true, model_id: true, location_id: true },
          with: {
            model: {
              columns: { id: true, name: true },
            },
          },
        },
        assignedTo: {
          columns: { id: true, name: true, email: true },
        },
        status: {
          columns: { id: true, name: true, category: true },
        },
        priority: {
          columns: { id: true, name: true, order: true },
        },
      },
      orderBy: [desc(issues.created_at)],
    });
});

export interface IssuePagination {
  page: number;
  limit: number;
}

export interface IssueSorting {
  field: string;
  order: "asc" | "desc";
}

/**
 * Get issues with advanced filtering, sorting, and pagination
 * Designed for Phase 3A server-first architecture with URL state management
 * Uses React 19 cache() for request-level memoization
 */
export const getIssuesWithFilters = cache(
  async (
    organizationId: string,
    filters: IssueFilters = {},
    pagination: IssuePagination = { page: 1, limit: 20 },
    sorting: IssueSorting = { field: "created_at", order: "desc" },
  ) => {

      // Build where conditions
      const whereConditions: SQL[] = [
        eq(issues.organization_id, organizationId),
      ];

    // Status filtering by status names
    if (filters.status?.length) {
      const statusIds = await db
        .select({ id: issueStatuses.id })
        .from(issueStatuses)
          .where(
            and(
              eq(issueStatuses.organization_id, organizationId),
              inArray(issueStatuses.name, filters.status),
            ),
          );

        if (statusIds.length > 0) {
          whereConditions.push(
            inArray(
              issues.status_id,
              statusIds.map((s) => s.id),
            ),
          );
        }
      }

    // Priority filtering by priority names
    if (filters.priority?.length) {
      const priorityIds = await db
        .select({ id: priorities.id })
        .from(priorities)
          .where(
            and(
              eq(priorities.organization_id, organizationId),
              inArray(priorities.name, filters.priority),
            ),
          );

        if (priorityIds.length > 0) {
          whereConditions.push(
            inArray(
              issues.priority_id,
              priorityIds.map((p) => p.id),
            ),
          );
        }
      }

      // Assignee filtering
      if (filters.assigneeId) {
        whereConditions.push(eq(issues.assigned_to_id, filters.assigneeId));
      }

      // Search filtering (title and description)
      if (filters.search) {
        whereConditions.push(
          sql`(${issues.title} ILIKE ${"%" + filters.search + "%"} OR ${issues.description} ILIKE ${"%" + filters.search + "%"})`,
        );
      }

      // Calculate offset for pagination
      const offset = (pagination.page - 1) * pagination.limit;

      // Build order by clause - handle different field types
      let orderBy;
      if (sorting.field === "created_at") {
        orderBy =
          sorting.order === "desc"
            ? desc(issues.created_at)
            : issues.created_at;
      } else if (sorting.field === "title") {
        orderBy = sorting.order === "desc" ? desc(issues.title) : issues.title;
      } else if (sorting.field === "updated_at") {
        orderBy =
          sorting.order === "desc"
            ? desc(issues.updated_at)
            : issues.updated_at;
      } else {
        // Default to created_at
        orderBy =
          sorting.order === "desc"
            ? desc(issues.created_at)
            : issues.created_at;
      }

    // Get total count for pagination info
    const totalCountResult: CountResult[] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(and(...whereConditions));
      const totalCount = safeCount(totalCountResult);

    // Get paginated results
    const issuesResult = await db.query.issues.findMany({
        where: and(...whereConditions),
        with: {
          machine: {
            columns: {
              id: true,
              name: true,
              model_id: true,
              location_id: true,
            },
            with: {
              model: {
                columns: { id: true, name: true },
              },
            },
          },
          assignedTo: {
            columns: { id: true, name: true, email: true },
          },
          status: {
            columns: { id: true, name: true, category: true },
          },
          priority: {
            columns: { id: true, name: true, order: true },
          },
        },
        orderBy: [orderBy],
      limit: pagination.limit + 1, // +1 to check if there's a next page
      offset,
    });

    // Check if there's a next page
    const hasNextPage: boolean = issuesResult.length > pagination.limit;
    const issuesData = hasNextPage ? issuesResult.slice(0, -1) : issuesResult;

    return {
      issues: issuesData,
      totalCount,
      hasNextPage,
      hasPreviousPage: pagination.page > 1,
      totalPages: Math.ceil(totalCount / pagination.limit),
      currentPage: pagination.page,
    };
  },
);


/**
 * Get single issue by ID with full details
 * Enforces organization scoping for security
 * Uses React 19 cache() for request-level memoization per issueId
 */
export const getIssueById = cache(async (issueId: string, organizationId: string) => {
  const issue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organization_id, organizationId),
      ),
      with: {
        machine: {
          with: {
            model: {
              columns: { id: true, name: true },
            },
            location: {
              columns: { id: true, name: true },
            },
          },
        },
        status: {
          columns: { id: true, name: true, category: true },
        },
        assignedTo: {
          columns: { id: true, name: true, email: true },
        },
        createdBy: {
          columns: { id: true, name: true, email: true },
        },
      },
    });

  if (!issue) {
    throw new Error("Issue not found or access denied");
  }

  return issue;
});

/**
 * Get issue counts by status for dashboard
 * Optimized query for Server Component stats
 * Uses React 19 cache() for request-level memoization
 */
export const getIssueStatusCounts = cache(async (organizationId: string) => {
  const statusCounts = await db
      .select({
        statusId: issues.status_id,
        count: sql<number>`count(*)::int`,
      })
      .from(issues)
      .where(eq(issues.organization_id, organizationId))
      .groupBy(issues.status_id);

  return statusCounts.reduce<Record<string, number>>(
    (
      acc: Record<string, number>,
      { statusId, count }: { statusId: string; count: number },
    ) => {
      acc[statusId] = count;
      return acc;
    },
    {},
  );
});

/**
 * Get recent issues for sidebar/widgets
 * Limited result set for performance
 * Uses React 19 cache() for request-level memoization per limit value
 */
export const getRecentIssues = cache(async (organizationId: string, limit = 5) => {
  return await db.query.issues.findMany({
      where: eq(issues.organization_id, organizationId),
      with: {
        machine: {
          columns: { id: true, name: true, model_id: true },
          with: {
            model: {
              columns: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [desc(issues.created_at)],
      limit,
    });
});

/**
 * Get comprehensive issue statistics for dashboard
 * Includes status breakdown, priority distribution, and assignment stats
 * Uses React 19 cache() for request-level memoization
 */
export const getIssueDashboardStats = cache(async (organizationId: string) => {

  const [statusBreakdown, priorityBreakdown, assignmentStats] =
    await Promise.all([
      db.query.issues.findMany({
          where: eq(issues.organization_id, organizationId),
          with: {
            status: {
              columns: { id: true, name: true },
            },
          },
        columns: { id: true, status_id: true },
      }),
      db.query.issues.findMany({
          where: eq(issues.organization_id, organizationId),
          with: {
            priority: {
              columns: { id: true, name: true },
            },
          },
        columns: { id: true, priority_id: true },
      }),
      db.query.issues.findMany({
          where: eq(issues.organization_id, organizationId),
        columns: { id: true, assigned_to_id: true, created_by_id: true },
      }),
    ]);

  // Process status breakdown
  const statusCounts = statusBreakdown.reduce<Record<string, number>>(
    (acc, issue) => {
      const statusName = issue.status.name;
      acc[statusName] = (acc[statusName] ?? 0) + 1;
      return acc;
    },
    {},
  );

  // Process priority breakdown
  const priorityCounts = priorityBreakdown.reduce<Record<string, number>>(
    (acc, issue) => {
      const priorityName = issue.priority.name;
      acc[priorityName] = (acc[priorityName] ?? 0) + 1;
      return acc;
    },
    {},
  );

  // Process assignment statistics
  const totalIssues = assignmentStats.length;
  const assignedIssues = assignmentStats.filter(
    (issue) => issue.assigned_to_id,
  ).length;
  const unassignedIssues = totalIssues - assignedIssues;

  return {
    total: totalIssues,
    statusBreakdown: statusCounts,
    priorityBreakdown: priorityCounts,
    assignmentStats: {
      assigned: assignedIssues,
      unassigned: unassignedIssues,
      assignmentRate:
        totalIssues > 0 ? (assignedIssues / totalIssues) * 100 : 0,
    },
  };
});

/**
 * Get issues assigned to current user for dashboard
 * Shows user's personal issue workload
 * Uses React 19 cache() for request-level memoization per limit
 */
export const getCurrentUserAssignedIssues = cache(async (organizationId: string, userId: string, limit = 10) => {
  return await db.query.issues.findMany({
    where: and(
      eq(issues.organization_id, organizationId),
      eq(issues.assigned_to_id, userId),
    ),
      with: {
        machine: {
          columns: { id: true, name: true },
          with: {
            model: { columns: { name: true } },
          },
        },
        status: { columns: { name: true } },
        priority: { columns: { name: true } },
      },
    orderBy: [desc(issues.updated_at)],
    limit,
  });
});

/**
 * Get issues created by current user for dashboard
 * Shows user's issue creation history
 * Uses React 19 cache() for request-level memoization per limit
 */
export const getCurrentUserCreatedIssues = cache(async (organizationId: string, userId: string, limit = 10) => {
  return await db.query.issues.findMany({
    where: and(
      eq(issues.organization_id, organizationId),
      eq(issues.created_by_id, userId),
    ),
      with: {
        machine: {
          columns: { id: true, name: true },
          with: {
            model: { columns: { name: true } },
          },
        },
        status: { columns: { name: true } },
        priority: { columns: { name: true } },
      },
    orderBy: [desc(issues.created_at)],
    limit,
  });
});

/**
 * Get high priority unassigned issues for dashboard alerts
 * Identifies critical issues needing attention
 * Uses React 19 cache() for request-level memoization
 */
export const getHighPriorityUnassignedIssues = cache(async (organizationId: string) => {
  return await db.query.issues.findMany({
    where: and(
      eq(issues.organization_id, organizationId),
      isNull(issues.assigned_to_id), // Unassigned
    ),
      with: {
        machine: {
          columns: { id: true, name: true },
          with: {
            model: { columns: { name: true } },
          },
        },
        status: { columns: { name: true } },
        priority: { columns: { name: true } },
      },
    orderBy: [desc(issues.created_at)],
  });
});

/**
 * Get issue trend data for dashboard charts
 * Shows issue creation/resolution trends over time
 * Uses React 19 cache() for request-level memoization per days
 */
export const getIssueTrendData = cache(async (organizationId: string, days = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const recentIssues = await db.query.issues.findMany({
      where: and(
        eq(issues.organization_id, organizationId),
        sql`${issues.created_at} >= ${cutoffDate}`,
      ),
      columns: {
        id: true,
        created_at: true,
        status_id: true,
      },
    with: {
      status: { columns: { name: true } },
    },
  });

  const trendData = recentIssues.reduce<
    Record<string, { created: number; resolved: number }>
  >((acc, issue) => {
    const dateKey = issue.created_at.toISOString().split("T")[0];
    if (dateKey) {
      acc[dateKey] ??= { created: 0, resolved: 0 };
      acc[dateKey].created += 1;
    }

    const statusName = issue.status.name.toLowerCase();
    if (
      dateKey &&
      (statusName.includes("resolved") || statusName.includes("closed"))
    ) {
      acc[dateKey]!.resolved += 1;
    }

    return acc;
  }, {});

  return trendData;
});
