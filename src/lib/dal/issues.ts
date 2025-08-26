/**
 * Issues Data Access Layer
 * Direct database queries for Server Components
 */

import { cache } from "react";
import { and, desc, eq, sql } from "drizzle-orm";
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