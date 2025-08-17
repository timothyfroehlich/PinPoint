import { eq, and, count, desc } from "drizzle-orm";

import { generatePrefixedId } from "~/lib/utils/id-generation";
import { type DrizzleClient } from "~/server/db/drizzle";
import type {
  notificationTypeEnum,
  notificationEntityEnum,
} from "~/server/db/schema";
import { notifications, machines, issues } from "~/server/db/schema";

// Define types from Drizzle schema
type Notification = typeof notifications.$inferSelect;
type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
type NotificationEntity = (typeof notificationEntityEnum.enumValues)[number];

// Notification type constants for direct usage
export const NotificationType = {
  ISSUE_CREATED: "ISSUE_CREATED" as const,
  ISSUE_UPDATED: "ISSUE_UPDATED" as const,
  ISSUE_ASSIGNED: "ISSUE_ASSIGNED" as const,
  ISSUE_COMMENTED: "ISSUE_COMMENTED" as const,
  MACHINE_ASSIGNED: "MACHINE_ASSIGNED" as const,
  SYSTEM_ANNOUNCEMENT: "SYSTEM_ANNOUNCEMENT" as const,
} as const;

export const NotificationEntity = {
  ISSUE: "ISSUE" as const,
  MACHINE: "MACHINE" as const,
  COMMENT: "COMMENT" as const,
  ORGANIZATION: "ORGANIZATION" as const,
} as const;

export interface NotificationData {
  userId: string;
  type: NotificationType;
  message: string;
  entityType?: NotificationEntity;
  entityId?: string;
  actionUrl?: string;
}

export class NotificationService {
  constructor(private db: DrizzleClient) {}

  /**
   * Create a new notification
   */
  async createNotification(data: NotificationData): Promise<void> {
    const notificationData: typeof notifications.$inferInsert = {
      id: generatePrefixedId("notification"),
      userId: data.userId,
      type: data.type,
      message: data.message,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      actionUrl: data.actionUrl ?? null,
    };

    await this.db.insert(notifications).values(notificationData);
  }

  /**
   * Notify machine owner of new issue
   */
  async notifyMachineOwnerOfIssue(
    issueId: string,
    machineId: string,
  ): Promise<void> {
    const machine = await this.db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      with: {
        owner: true,
        model: true,
      },
    });

    if (
      !machine?.owner ||
      !machine.ownerNotificationsEnabled ||
      !machine.notifyOnNewIssues
    ) {
      return; // No owner, notifications disabled, or new issue notifications disabled
    }

    const issue = await this.db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { title: true },
    });

    if (!issue) return;

    await this.createNotification({
      userId: machine.owner.id,
      type: NotificationType.ISSUE_CREATED,
      message: `New issue reported on your ${machine.model.name}: "${issue.title}"`,
      entityType: NotificationEntity.ISSUE,
      entityId: issueId,
      actionUrl: `/issues/${issueId}`,
    });
  }

  /**
   * Notify machine owner of issue status change
   */
  async notifyMachineOwnerOfStatusChange(
    issueId: string,
    oldStatus: string,
    newStatus: string,
  ): Promise<void> {
    const issue = await this.db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        machine: {
          with: {
            owner: true,
            model: true,
          },
        },
      },
    });

    if (
      !issue?.machine.owner ||
      !issue.machine.ownerNotificationsEnabled ||
      !issue.machine.notifyOnStatusChanges
    ) {
      return;
    }

    await this.createNotification({
      userId: issue.machine.owner.id,
      type: NotificationType.ISSUE_UPDATED,
      message: `Issue status changed on your ${issue.machine.model.name}: ${oldStatus} → ${newStatus}`,
      entityType: NotificationEntity.ISSUE,
      entityId: issueId,
      actionUrl: `/issues/${issueId}`,
    });
  }

  /**
   * Notify user of issue assignment
   */
  async notifyUserOfAssignment(
    issueId: string,
    assignedUserId: string,
  ): Promise<void> {
    const issue = await this.db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        machine: {
          with: {
            model: true,
          },
        },
      },
    });

    if (!issue) return;

    await this.createNotification({
      userId: assignedUserId,
      type: NotificationType.ISSUE_ASSIGNED,
      message: `You were assigned to issue: "${issue.title}" on ${issue.machine.model.name}`,
      entityType: NotificationEntity.ISSUE,
      entityId: issueId,
      actionUrl: `/issues/${issueId}`,
    });
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<Notification[]> {
    const whereConditions = options.unreadOnly
      ? and(eq(notifications.userId, userId), eq(notifications.read, false))
      : eq(notifications.userId, userId);

    const result = await this.db.query.notifications.findMany({
      where: whereConditions,
      orderBy: desc(notifications.createdAt),
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    });

    return result;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId), // Ensure user owns the notification
        ),
      );
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.read, false)),
      );
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const [countResult] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.read, false)),
      );

    return countResult?.count ?? 0;
  }
}
