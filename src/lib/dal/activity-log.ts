/**
 * Activity Log Data Access Layer
 * Phase 4B.4: Activity tracking and audit trail functionality
 */

import { cache } from "react";
import { desc, eq, and, like, between } from "drizzle-orm";
import { db } from "./shared";
import { activityLog, users } from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";

// Type definitions for activity log
export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  userName: string;
  userEmail: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  severity: "info" | "warning" | "error";
  organizationId: string;
}

export interface ActivityLogFilters {
  userId?: string;
  action?: string;
  entity?: string;
  severity?: "info" | "warning" | "error";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// Common activity actions
export const ACTIVITY_ACTIONS = {
  // User actions
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  USER_LOGIN_FAILED: "LOGIN_FAILED",
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  
  // Role actions
  ROLE_CHANGED: "ROLE_CHANGED",
  ROLE_CREATED: "ROLE_CREATED",
  ROLE_UPDATED: "ROLE_UPDATED",
  ROLE_DELETED: "ROLE_DELETED",
  
  // Issue actions
  ISSUE_CREATED: "ISSUE_CREATED",
  ISSUE_UPDATED: "ISSUE_UPDATED",
  ISSUE_DELETED: "ISSUE_DELETED",
  ISSUE_STATUS_CHANGED: "ISSUE_STATUS_CHANGED",
  
  // Machine actions
  MACHINE_CREATED: "MACHINE_CREATED",
  MACHINE_UPDATED: "MACHINE_UPDATED",
  MACHINE_DELETED: "MACHINE_DELETED",
  
  // Organization actions
  ORGANIZATION_UPDATED: "ORGANIZATION_UPDATED",
  ORGANIZATION_SETTINGS_CHANGED: "ORGANIZATION_SETTINGS_CHANGED",
  
  // System actions
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
  INVITATION_SENT: "INVITATION_SENT",
  EXPORT_GENERATED: "EXPORT_GENERATED",
} as const;

// Common entities
export const ACTIVITY_ENTITIES = {
  USER: "USER",
  ROLE: "ROLE",
  ISSUE: "ISSUE",
  MACHINE: "MACHINE",
  ORGANIZATION: "ORGANIZATION",
  SETTINGS: "SETTINGS",
  INVITATION: "INVITATION",
  EXPORT: "EXPORT",
} as const;

/**
 * Get activity log entries with filtering and pagination
 */
export const getActivityLog = cache(async (
  organizationId: string,
  filters: ActivityLogFilters = {}
): Promise<{
  entries: ActivityLogEntry[];
  totalCount: number;
  totalPages: number;
}> => {
  try {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const {
      userId,
      action,
      entity,
      severity,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
    } = filters;

    // Build where conditions
    const whereConditions = [
      eq(activityLog.organization_id, organizationId)
    ];

    if (userId) {
      whereConditions.push(eq(activityLog.user_id, userId));
    }

    if (action) {
      whereConditions.push(eq(activityLog.action, action));
    }

    if (entity) {
      whereConditions.push(eq(activityLog.entity, entity));
    }

    if (severity) {
      whereConditions.push(eq(activityLog.severity, severity));
    }

    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? new Date(dateFrom) : new Date('1970-01-01');
      const toDate = dateTo ? new Date(dateTo) : new Date();
      whereConditions.push(between(activityLog.timestamp, fromDate, toDate));
    }

    const whereClause = whereConditions.length > 1 
      ? and(...whereConditions)
      : whereConditions[0];

    // Get total count for pagination
    const totalResult = await db
      .select({ count: activityLog.id })
      .from(activityLog)
      .where(whereClause);

    const totalCount = totalResult.length;
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;

    // Get activity log entries with user information
    const entries = await db.query.activityLog.findMany({
      where: whereClause,
      with: {
        user: {
          columns: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [desc(activityLog.timestamp)],
      limit,
      offset,
    });

    // Map to expected format
    const mappedEntries: ActivityLogEntry[] = entries.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entity_id,
      userId: entry.user_id,
      userName: entry.user.name || 'Unknown User',
      userEmail: entry.user.email || 'unknown@example.com',
      details: entry.details,
      ipAddress: entry.ip_address || '0.0.0.0',
      userAgent: entry.user_agent || 'Unknown',
      severity: entry.severity as "info" | "warning" | "error",
      organizationId: entry.organization_id,
    }));

    return {
      entries: mappedEntries,
      totalCount,
      totalPages,
    };
  } catch (error) {
    console.error("Error fetching activity log:", error);
    return {
      entries: [],
      totalCount: 0,
      totalPages: 0,
    };
  }
});

/**
 * Create a new activity log entry
 */
export async function logActivity(params: {
  organizationId: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  severity?: "info" | "warning" | "error";
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const {
      organizationId,
      userId,
      action,
      entity,
      entityId,
      details,
      severity = "info",
      ipAddress = "0.0.0.0",
      userAgent = "Unknown",
    } = params;

    if (!organizationId || !userId || !action || !entity || !entityId) {
      throw new Error("Required parameters missing for activity logging");
    }

    await db.insert(activityLog).values({
      id: generatePrefixedId("activity"),
      organization_id: organizationId,
      user_id: userId,
      action,
      entity,
      entity_id: entityId,
      details,
      severity,
      ip_address: ipAddress,
      user_agent: userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw error to avoid breaking main functionality
    // Activity logging should be non-blocking
  }
}

/**
 * Get activity statistics for organization
 */
export const getActivityStats = cache(async (organizationId: string): Promise<{
  totalEvents: number;
  userActions: number;
  securityEvents: number;
  errorEvents: number;
}> => {
  try {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const stats = await db.query.activityLog.findMany({
      where: eq(activityLog.organization_id, organizationId),
      columns: {
        action: true,
        severity: true,
      },
    });

    const totalEvents = stats.length;
    
    const userActions = stats.filter(entry => 
      entry.action.includes("USER") || entry.action.includes("ISSUE")
    ).length;

    const securityEvents = stats.filter(entry =>
      entry.action.includes("LOGIN") || entry.action.includes("ROLE")
    ).length;

    const errorEvents = stats.filter(entry =>
      entry.severity === "error"
    ).length;

    return {
      totalEvents,
      userActions,
      securityEvents,
      errorEvents,
    };
  } catch (error) {
    console.error("Error fetching activity stats:", error);
    return {
      totalEvents: 0,
      userActions: 0,
      securityEvents: 0,
      errorEvents: 0,
    };
  }
});

/**
 * Get recent activity for dashboard or summary views
 */
export const getRecentActivity = cache(async (
  organizationId: string,
  limit: number = 10
): Promise<ActivityLogEntry[]> => {
  try {
    if (!organizationId) {
      return [];
    }

    const result = await getActivityLog(organizationId, { limit, page: 1 });
    return result.entries;
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return [];
  }
});

/**
 * Export activity log to CSV format
 */
export async function exportActivityLog(
  organizationId: string,
  filters: ActivityLogFilters = {}
): Promise<string> {
  try {
    const result = await getActivityLog(organizationId, { ...filters, limit: 10000 });
    
    const csvHeader = "Timestamp,Action,Entity,Entity ID,User Name,User Email,Details,Severity,IP Address\n";
    
    const csvRows = result.entries.map(entry => 
      `"${entry.timestamp.toISOString()}","${entry.action}","${entry.entity}","${entry.entityId}","${entry.userName}","${entry.userEmail}","${entry.details}","${entry.severity}","${entry.ipAddress}"`
    ).join("\n");

    return csvHeader + csvRows;
  } catch (error) {
    console.error("Error exporting activity log:", error);
    throw new Error("Failed to export activity log");
  }
}