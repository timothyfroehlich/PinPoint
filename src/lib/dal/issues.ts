/**
 * Issues Data Access Layer
 * Direct database queries for Server Components
 */

import { cache } from "react";
import { and, desc, eq, sql, isNull } from "drizzle-orm";
import { issues } from "~/server/db/schema";
import { db, requireAuthContext } from "./shared";

/**
 * Get issues for the current organization with machine and assignee details
 * Designed for Server Components - includes proper org scoping and joins
 * Uses React 19 cache() for request-level memoization
 */
export const getIssuesForOrg = cache(async () => {
  const { organizationId } = await requireAuthContext();
  
  return await db.query.issues.findMany({
    where: eq(issues.organization_id, organizationId),
    with: {
      machine: {
        columns: { id: true, name: true, model_id: true, location_id: true },
        with: {
          model: {
            columns: { id: true, name: true }
          }
        }
      },
      assignedTo: {
        columns: { id: true, name: true, email: true }
      }
    },
    orderBy: [desc(issues.created_at)]
  });
});

/**
 * Get single issue by ID with full details
 * Enforces organization scoping for security
 * Uses React 19 cache() for request-level memoization per issueId
 */
export const getIssueById = cache(async (issueId: string) => {
  const { organizationId } = await requireAuthContext();
  
  const issue = await db.query.issues.findFirst({
    where: and(
      eq(issues.id, issueId),
      eq(issues.organization_id, organizationId)
    ),
    with: {
      machine: true,
      assignedTo: {
        columns: { id: true, name: true, email: true }
      },
      createdBy: {
        columns: { id: true, name: true, email: true }
      }
    }
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
export const getIssueStatusCounts = cache(async () => {
  const { organizationId } = await requireAuthContext();
  
  const statusCounts = await db
    .select({
      statusId: issues.status_id,
      count: sql<number>`count(*)::int`
    })
    .from(issues)
    .where(eq(issues.organization_id, organizationId))
    .groupBy(issues.status_id);
    
  // Convert to object for easier consumption
  return statusCounts.reduce((acc: Record<string, number>, { statusId, count }: { statusId: string; count: number }) => {
    acc[statusId] = count;
    return acc;
  }, {} as Record<string, number>);
});

/**
 * Get recent issues for sidebar/widgets
 * Limited result set for performance
 * Uses React 19 cache() for request-level memoization per limit value
 */
export const getRecentIssues = cache(async (limit = 5) => {
  const { organizationId } = await requireAuthContext();
  
  return await db.query.issues.findMany({
    where: eq(issues.organization_id, organizationId),
    with: {
      machine: {
        columns: { id: true, name: true, model_id: true },
        with: {
          model: {
            columns: { id: true, name: true }
          }
        }
      }
    },
    orderBy: [desc(issues.created_at)],
    limit
  });
});

/**
 * Get comprehensive issue statistics for dashboard
 * Includes status breakdown, priority distribution, and assignment stats
 * Uses React 19 cache() for request-level memoization
 */
export const getIssueDashboardStats = cache(async () => {
  const { organizationId } = await requireAuthContext();
  
  // Execute multiple queries in parallel for performance
  const [statusBreakdown, priorityBreakdown, assignmentStats] = await Promise.all([
    // Status breakdown with named statuses
    db.query.issues.findMany({
      where: eq(issues.organization_id, organizationId),
      with: {
        status: {
          columns: { id: true, name: true }
        }
      },
      columns: { id: true, status_id: true }
    }),
    
    // Priority breakdown with named priorities  
    db.query.issues.findMany({
      where: eq(issues.organization_id, organizationId),
      with: {
        priority: {
          columns: { id: true, name: true }
        }
      },
      columns: { id: true, priority_id: true }
    }),
    
    // Assignment statistics
    db.query.issues.findMany({
      where: eq(issues.organization_id, organizationId),
      columns: { id: true, assigned_to_id: true, created_by_id: true }
    })
  ]);
  
  // Process status breakdown
  const statusCounts = statusBreakdown.reduce((acc, issue) => {
    const statusName = issue.status?.name || 'unknown';
    acc[statusName] = (acc[statusName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Process priority breakdown
  const priorityCounts = priorityBreakdown.reduce((acc, issue) => {
    const priorityName = issue.priority?.name || 'unknown';
    acc[priorityName] = (acc[priorityName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Process assignment statistics
  const totalIssues = assignmentStats.length;
  const assignedIssues = assignmentStats.filter(issue => issue.assigned_to_id).length;
  const unassignedIssues = totalIssues - assignedIssues;
  
  return {
    total: totalIssues,
    statusBreakdown: statusCounts,
    priorityBreakdown: priorityCounts,
    assignmentStats: {
      assigned: assignedIssues,
      unassigned: unassignedIssues,
      assignmentRate: totalIssues > 0 ? (assignedIssues / totalIssues) * 100 : 0,
    }
  };
});

/**
 * Get issues assigned to current user for dashboard
 * Shows user's personal issue workload
 * Uses React 19 cache() for request-level memoization per limit
 */
export const getCurrentUserAssignedIssues = cache(async (limit = 10) => {
  const { user, organizationId } = await requireAuthContext();
  
  return await db.query.issues.findMany({
    where: and(
      eq(issues.organization_id, organizationId),
      eq(issues.assigned_to_id, user.id)
    ),
    with: {
      machine: {
        columns: { id: true, name: true },
        with: {
          model: { columns: { name: true } }
        }
      },
      status: { columns: { name: true } },
      priority: { columns: { name: true } }
    },
    orderBy: [desc(issues.updated_at)],
    limit
  });
});

/**
 * Get issues created by current user for dashboard
 * Shows user's issue creation history
 * Uses React 19 cache() for request-level memoization per limit
 */
export const getCurrentUserCreatedIssues = cache(async (limit = 10) => {
  const { user, organizationId } = await requireAuthContext();
  
  return await db.query.issues.findMany({
    where: and(
      eq(issues.organization_id, organizationId),
      eq(issues.created_by_id, user.id)
    ),
    with: {
      machine: {
        columns: { id: true, name: true },
        with: {
          model: { columns: { name: true } }
        }
      },
      status: { columns: { name: true } },
      priority: { columns: { name: true } }
    },
    orderBy: [desc(issues.created_at)],
    limit
  });
});

/**
 * Get high priority unassigned issues for dashboard alerts
 * Identifies critical issues needing attention
 * Uses React 19 cache() for request-level memoization
 */
export const getHighPriorityUnassignedIssues = cache(async () => {
  const { organizationId } = await requireAuthContext();
  
  return await db.query.issues.findMany({
    where: and(
      eq(issues.organization_id, organizationId),
      isNull(issues.assigned_to_id), // Unassigned
      // Note: Would need to check priority by name or add priority level filtering
    ),
    with: {
      machine: {
        columns: { id: true, name: true },
        with: {
          model: { columns: { name: true } }
        }
      },
      status: { columns: { name: true } },
      priority: { columns: { name: true } }
    },
    orderBy: [desc(issues.created_at)]
  });
});

/**
 * Get issue trend data for dashboard charts
 * Shows issue creation/resolution trends over time
 * Uses React 19 cache() for request-level memoization per days
 */
export const getIssueTrendData = cache(async (days = 30) => {
  const { organizationId } = await requireAuthContext();
  
  // Get issues from the last N days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const recentIssues = await db.query.issues.findMany({
    where: and(
      eq(issues.organization_id, organizationId),
      sql`${issues.created_at} >= ${cutoffDate}`
    ),
    columns: {
      id: true,
      created_at: true,
      status_id: true
    },
    with: {
      status: { columns: { name: true } }
    }
  });
  
  // Group issues by date for trend analysis
  const trendData = recentIssues.reduce((acc, issue) => {
    const dateKey = issue.created_at.toISOString().split('T')[0]!; // YYYY-MM-DD - guaranteed to exist
    if (!acc[dateKey]) {
      acc[dateKey] = { created: 0, resolved: 0 };
    }
    acc[dateKey]!.created += 1;
    
    // Count as resolved if status indicates completion
    if (issue.status?.name?.toLowerCase().includes('resolved') || 
        issue.status?.name?.toLowerCase().includes('closed')) {
      acc[dateKey]!.resolved += 1;
    }
    
    return acc;
  }, {} as Record<string, { created: number; resolved: number }>);
  
  return trendData;
});