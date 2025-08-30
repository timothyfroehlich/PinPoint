/**
 * Notifications Data Access Layer
 * Direct database queries for Server Components with React 19 cache() optimization
 */

import { cache } from "react";
import { and, desc, eq, sql } from "drizzle-orm";
import { notifications } from "~/server/db/schema";
import { db, requireAuthContext } from "./shared";

/**
 * Get notifications for the current user with pagination
 * Ordered by creation date (newest first) and includes read status
 * Uses React 19 cache() for request-level memoization
 */
export const getUserNotifications = cache(
  async (limit = 20, includeRead = true) => {
    const { user, organizationId } = await requireAuthContext();

    const whereConditions = [
      eq(notifications.user_id, user.id),
      eq(notifications.organization_id, organizationId),
    ];

    // Filter out read notifications if requested
    if (!includeRead) {
      whereConditions.push(eq(notifications.read, false));
    }

    return await db.query.notifications.findMany({
      where: and(...whereConditions),
      orderBy: [desc(notifications.created_at)],
      limit,
      // Omit user relation since we're filtering by user_id already
      columns: {
        id: true,
        message: true,
        read: true,
        created_at: true,
        type: true,
        entity_type: true,
        entity_id: true,
        action_url: true,
      },
    });
  },
);

/**
 * Get unread notification count for the current user
 * Critical for notification bell badge display
 */
export const getUnreadNotificationCount = cache(async () => {
  const { user, organizationId } = await requireAuthContext();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.user_id, user.id),
        eq(notifications.organization_id, organizationId),
        eq(notifications.read, false),
      ),
    );

  return result[0]?.count ?? 0;
});

/**
 * Get recent unread notifications for real-time display
 * Limited count to prevent performance issues
 */
export const getRecentUnreadNotifications = cache(async (limit = 5) => {
  const { user, organizationId } = await requireAuthContext();

  return await db.query.notifications.findMany({
    where: and(
      eq(notifications.user_id, user.id),
      eq(notifications.organization_id, organizationId),
      eq(notifications.read, false),
    ),
    orderBy: [desc(notifications.created_at)],
    limit,
    columns: {
      id: true,
      message: true,
      created_at: true,
      type: true,
      entity_type: true,
      entity_id: true,
      action_url: true,
    },
  });
});

/**
 * Get notifications by type for specific filtering
 * Useful for showing only specific types of notifications
 */
export const getNotificationsByType = cache(
  async (
    notificationType: "ISSUE_CREATED" | "ISSUE_UPDATED" | "ISSUE_ASSIGNED" | "ISSUE_COMMENTED" | "MACHINE_ASSIGNED" | "SYSTEM_ANNOUNCEMENT",
    limit = 10,
  ) => {
    const { user, organizationId } = await requireAuthContext();

    return await db.query.notifications.findMany({
      where: and(
        eq(notifications.user_id, user.id),
        eq(notifications.organization_id, organizationId),
        eq(notifications.type, notificationType),
      ),
      orderBy: [desc(notifications.created_at)],
      limit,
      columns: {
        id: true,
        message: true,
        read: true,
        created_at: true,
        type: true,
        entity_type: true,
        entity_id: true,
        action_url: true,
      },
    });
  },
);

/**
 * Get notification by ID with access control
 * Ensures user can only access their own notifications
 */
export const getNotificationById = cache(async (notificationId: string) => {
  const { user, organizationId } = await requireAuthContext();

  return await db.query.notifications.findFirst({
    where: and(
      eq(notifications.id, notificationId),
      eq(notifications.user_id, user.id),
      eq(notifications.organization_id, organizationId),
    ),
    columns: {
      id: true,
      message: true,
      read: true,
      created_at: true,
      type: true,
      entity_type: true,
      entity_id: true,
      action_url: true,
    },
  });
});

/**
 * Check if user has any unread notifications
 * Quick boolean check for UI state management
 */
export const hasUnreadNotifications = cache(async () => {
  const count = await getUnreadNotificationCount();
  return count > 0;
});

/**
 * Get notification statistics for dashboard/analytics
 * Shows breakdown by type and read status
 */
export const getNotificationStats = cache(async () => {
  const { user, organizationId } = await requireAuthContext();

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.user_id, user.id),
        eq(notifications.organization_id, organizationId),
      ),
    );

  const unreadResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.user_id, user.id),
        eq(notifications.organization_id, organizationId),
        eq(notifications.read, false),
      ),
    );

  const todayResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.user_id, user.id),
        eq(notifications.organization_id, organizationId),
        sql`DATE(created_at) = CURRENT_DATE`,
      ),
    );

  return {
    total: totalResult[0]?.count ?? 0,
    unread: unreadResult[0]?.count ?? 0,
    read: (totalResult[0]?.count ?? 0) - (unreadResult[0]?.count ?? 0),
    today: todayResult[0]?.count ?? 0,
  };
});

/**
 * Helper function to create notification URLs
 * Generates proper action URLs based on entity type and ID
 */
export function createNotificationActionUrl(
  entityType: "ISSUE" | "MACHINE" | "COMMENT" | "ORGANIZATION",
  entityId: string,
): string {
  switch (entityType) {
    case "ISSUE":
      return `/issues/${entityId}`;
    case "MACHINE":
      return `/machines/${entityId}`;
    case "COMMENT":
      // For comments, we need to navigate to the issue that contains the comment
      // This would require a lookup, for now return issue URL pattern
      return `/issues/${entityId}#comments`;
    case "ORGANIZATION":
      return `/organization/${entityId}`;
    default:
      return "/";
  }
}

/**
 * Type definitions for notification data
 */
export type UserNotification = Awaited<
  ReturnType<typeof getUserNotifications>
>[0];

export type NotificationStats = Awaited<ReturnType<typeof getNotificationStats>>;

export type RecentNotification = Awaited<
  ReturnType<typeof getRecentUnreadNotifications>
>[0];