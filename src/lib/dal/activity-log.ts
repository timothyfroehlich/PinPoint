/**
 * Activity Log Data Access Layer
 * Phase 4B.4: Activity tracking and audit trail functionality
 */

import { cache } from "react";
import { desc, eq, and, between } from "drizzle-orm";
import { getDb } from "./shared";
import { withOrgRLS } from "~/server/db/utils/rls";
import { activityLog } from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";

// Type definitions for activity log (aligned with database schema)
export interface ActivityLogEntry {
  id: string;
  created_at: Date; // was timestamp
  action: string;
  entity_type: string; // was entity
  entity_id: string | null; // was entityId
  user_id: string | null; // was userId
  userName: string;
  userEmail: string;
  details: string;
  ip_address: string | null; // was ipAddress
  user_agent: string | null; // was userAgent
  severity: "info" | "warning" | "error";
  organization_id: string; // was organizationId
}

export interface ActivityLogFilters {
  user_id?: string; // was userId
  userId?: string; // Keep old name for backwards compatibility
  action?: string;
  entity_type?: string; // was entity
  entity?: string; // Keep old name for backwards compatibility
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
export const getActivityLog = cache(
  async (
    organizationId: string,
    filters: ActivityLogFilters = {},
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
        user_id,
        action,
        entity,
        entity_type,
        severity,
        dateFrom,
        dateTo,
        page = 1,
        limit = 50,
      } = filters;

      // Support both old and new parameter names
      const actualUserId = user_id ?? userId;
      const actualEntity = entity_type ?? entity;

      // Build where conditions
      const whereConditions = [eq(activityLog.organization_id, organizationId)];

      if (actualUserId) {
        whereConditions.push(eq(activityLog.user_id, actualUserId));
      }

      if (action) {
        whereConditions.push(eq(activityLog.action, action));
      }

      if (actualEntity) {
        whereConditions.push(eq(activityLog.entity_type, actualEntity));
      }

      if (severity) {
        whereConditions.push(eq(activityLog.severity, severity));
      }

      if (dateFrom || dateTo) {
        const fromDate = dateFrom ? new Date(dateFrom) : new Date("1970-01-01");
        const toDate = dateTo ? new Date(dateTo) : new Date();
        whereConditions.push(between(activityLog.created_at, fromDate, toDate));
      }

      const whereClause =
        whereConditions.length > 1
          ? and(...whereConditions)
          : whereConditions[0];

      // Get total count for pagination
      const totalResult = await withOrgRLS(
        getDb(),
        organizationId,
        async (tx) =>
          tx
            .select({ count: activityLog.id })
            .from(activityLog)
            .where(whereClause),
      );

      const totalCount = totalResult.length;
      const totalPages = Math.ceil(totalCount / limit);
      const offset = (page - 1) * limit;

      // Get activity log entries with user information
      const entries = await withOrgRLS(getDb(), organizationId, async (tx) =>
        tx.query.activityLog.findMany({
          where: whereClause,
          with: {
            user: {
              columns: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: [desc(activityLog.created_at)],
          limit,
          offset,
        }),
      );

      // Map to expected format
      const mappedEntries: ActivityLogEntry[] = entries.map((entry) => ({
        id: entry.id,
        created_at: entry.created_at,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        user_id: entry.user_id,
        userName: entry.user?.name ?? "Unknown User",
        userEmail: entry.user?.email ?? "unknown@example.com",
        details:
          typeof entry.details === "string"
            ? entry.details
            : JSON.stringify(entry.details ?? {}),
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        severity: entry.severity as "info" | "warning" | "error",
        organization_id: entry.organization_id,
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
  },
);

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

    await withOrgRLS(getDb(), organizationId, async (tx) =>
      tx.insert(activityLog).values({
        id: generatePrefixedId("activity"),
        organization_id: organizationId,
        user_id: userId,
        action,
        entity_type: entity,
        entity_id: entityId,
        details: JSON.stringify(details),
        severity,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date(),
      }),
    );
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw error to avoid breaking main functionality
    // Activity logging should be non-blocking
  }
}

/**
 * Get activity statistics for organization
 */
export const getActivityStats = cache(
  async (
    organizationId: string,
  ): Promise<{
    totalEvents: number;
    userActions: number;
    securityEvents: number;
    errorEvents: number;
  }> => {
    try {
      if (!organizationId) {
        throw new Error("Organization ID is required");
      }

      const stats = await withOrgRLS(getDb(), organizationId, async (tx) =>
        tx.query.activityLog.findMany({
          where: eq(activityLog.organization_id, organizationId),
          columns: {
            action: true,
            severity: true,
          },
        }),
      );

      const totalEvents = stats.length;

      const userActions = stats.filter(
        (entry) =>
          entry.action.includes("USER") || entry.action.includes("ISSUE"),
      ).length;

      const securityEvents = stats.filter(
        (entry) =>
          entry.action.includes("LOGIN") || entry.action.includes("ROLE"),
      ).length;

      const errorEvents = stats.filter(
        (entry) => entry.severity === "error",
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
  },
);

/**
 * Get recent activity for dashboard or summary views
 */
export const getRecentActivity = cache(
  async (organizationId: string, limit = 10): Promise<ActivityLogEntry[]> => {
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
  },
);

/**
 * Export activity log to CSV format
 */
export const exportActivityLog = cache(
  async (
    organizationId: string,
    filters: ActivityLogFilters = {},
  ): Promise<string> => {
    try {
      const result = await getActivityLog(organizationId, {
        ...filters,
        limit: 10000,
      });

      const csvHeader =
        "Timestamp,Action,Entity,Entity ID,User Name,User Email,Details,Severity,IP Address\n";

      const csvRows = result.entries
        .map(
          (entry) =>
            `"${entry.created_at.toISOString()}","${entry.action}","${entry.entity_type}","${entry.entity_id ?? ""}","${entry.userName}","${entry.userEmail}","${entry.details}","${entry.severity}","${entry.ip_address ?? ""}"`,
        )
        .join("\n");

      return csvHeader + csvRows;
    } catch (error) {
      console.error("Error exporting activity log:", error);
      throw new Error("Failed to export activity log");
    }
  },
);
