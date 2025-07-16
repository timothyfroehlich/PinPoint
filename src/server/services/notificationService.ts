import {
  type PrismaClient,
  NotificationType,
  NotificationEntity,
  type Notification,
} from "@prisma/client";

export interface NotificationData {
  userId: string;
  type: NotificationType;
  message: string;
  entityType?: NotificationEntity;
  entityId?: string;
  actionUrl?: string;
}

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new notification
   */
  async createNotification(data: NotificationData): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
      },
    });
  }

  /**
   * Notify machine owner of new issue
   */
  async notifyMachineOwnerOfIssue(
    issueId: string,
    machineId: string,
  ): Promise<void> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        owner: true,
        model: true,
        issues: {
          where: { id: issueId },
          select: {
            title: true,
          },
        },
      },
    });

    if (
      !machine?.owner ||
      !machine.ownerNotificationsEnabled ||
      !machine.notifyOnNewIssues
    ) {
      return; // No owner, notifications disabled, or new issue notifications disabled
    }

    const issue = machine.issues[0];
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
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        machine: {
          include: {
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
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        machine: {
          include: {
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
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly && { read: false }),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: options.limit || 50,
      skip: options.offset || 0,
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns the notification
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }
}
