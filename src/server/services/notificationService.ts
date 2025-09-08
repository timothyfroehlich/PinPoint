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

interface NotificationData {
  userId: string;
  organizationId: string;
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
   *
   * RLS automatically scopes notifications to the user's organization
   * via database trigger that sets organizationId from auth.jwt()
   */
  async createNotification(data: NotificationData): Promise<void> {
    const notificationData: typeof notifications.$inferInsert = {
      id: generatePrefixedId("notification"),
      user_id: data.userId,
      organization_id: data.organizationId,
      type: data.type,
      message: data.message,
      entity_type: data.entityType ?? null,
      entity_id: data.entityId ?? null,
      action_url: data.actionUrl ?? null,
    };

    await this.db.insert(notifications).values(notificationData);
  }

  /**
   * Notify machine owner of new issue
   *
   * RLS automatically ensures only machines and issues from the same
   * organization are accessible via database-level policies
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
      !machine.owner_notifications_enabled ||
      !machine.notify_on_new_issues
    ) {
      return; // No owner, notifications disabled, or new issue notifications disabled
    }

    const issue = await this.db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { title: true, organization_id: true },
    });

    if (!issue) return;

    await this.createNotification({
      userId: machine.owner.id,
      organizationId: issue.organization_id,
      type: NotificationType.ISSUE_CREATED,
      message: `New issue reported on your ${machine.model.name}: "${issue.title}"`,
      entityType: NotificationEntity.ISSUE,
      entityId: issueId,
      actionUrl: `/issues/${issueId}`,
    });
  }

  /**
   * Notify machine owner of issue status change
   *
   * RLS automatically ensures only issues from the same organization
   * are accessible, providing cross-organizational security
   */
  async notifyMachineOwnerOfStatusChange(
    issueId: string,
    oldStatus: string,
    newStatus: string,
  ): Promise<void> {
    const issue = await this.db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: {
        organization_id: true,
        title: true,
      },
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
      !issue.machine.owner_notifications_enabled ||
      !issue.machine.notify_on_status_changes
    ) {
      return;
    }

    await this.createNotification({
      userId: issue.machine.owner.id,
      organizationId: issue.organization_id,
      type: NotificationType.ISSUE_UPDATED,
      message: `Issue status changed on your ${issue.machine.model.name}: ${oldStatus} → ${newStatus}`,
      entityType: NotificationEntity.ISSUE,
      entityId: issueId,
      actionUrl: `/issues/${issueId}`,
    });
  }

  /**
   * Notify user of issue assignment
   *
   * RLS automatically ensures only issues from the same organization
   * are accessible, and notifications are scoped appropriately
   */
  async notifyUserOfAssignment(
    issueId: string,
    assignedUserId: string,
  ): Promise<void> {
    const issue = await this.db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: {
        organization_id: true,
        title: true,
      },
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
      organizationId: issue.organization_id,
      type: NotificationType.ISSUE_ASSIGNED,
      message: `You were assigned to issue: "${issue.title}" on ${issue.machine.model.name}`,
      entityType: NotificationEntity.ISSUE,
      entityId: issueId,
      actionUrl: `/issues/${issueId}`,
    });
  }

  /**
   * Get user's notifications
   *
   * RLS automatically filters notifications to only those belonging
   * to the user's organization via database-level policies
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
      ? and(eq(notifications.user_id, userId), eq(notifications.read, false))
      : eq(notifications.user_id, userId);

    const result = await this.db.query.notifications.findMany({
      where: whereConditions,
      orderBy: desc(notifications.created_at),
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    });

    return result;
  }

  /**
   * Mark notification as read
   *
   * RLS ensures the notification belongs to the user's organization.
   * User ownership validation prevents cross-user notification access.
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.user_id, userId), // Ensure user owns the notification
        ),
      );
  }

  /**
   * Mark all notifications as read for user
   *
   * RLS automatically scopes to the user's organization,
   * ensuring only their notifications are updated
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.user_id, userId), eq(notifications.read, false)),
      );
  }

  /**
   * Get unread notification count
   *
   * RLS automatically filters to notifications within the user's
   * organization, providing accurate organizational counts
   */
  async getUnreadCount(userId: string): Promise<number> {
    const [countResult] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(eq(notifications.user_id, userId), eq(notifications.read, false)),
      );

    return countResult?.count ?? 0;
  }
}
