/**
 * Notification Generation Service
 * Automatically creates notifications for issue events, comments, and assignments
 */

import { db } from "~/lib/dal/shared";
import { notifications, issues } from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import { createNotificationActionUrl } from "~/lib/dal/notifications";
import { eq, and } from "drizzle-orm";

/**
 * Notification types that can be generated
 */
export type NotificationType =
  | "ISSUE_CREATED"
  | "ISSUE_UPDATED"
  | "ISSUE_ASSIGNED"
  | "ISSUE_COMMENTED"
  | "MACHINE_ASSIGNED"
  | "SYSTEM_ANNOUNCEMENT";

/**
 * Entity types for notifications
 */
export type NotificationEntityType =
  | "ISSUE"
  | "MACHINE"
  | "COMMENT"
  | "ORGANIZATION";

/**
 * Notification generation context
 */
interface NotificationContext {
  organizationId: string;
  actorId: string; // Who triggered the notification
  actorName: string;
}

/**
 * Base notification data
 */
interface BaseNotificationData {
  type: NotificationType;
  entityType: NotificationEntityType;
  entityId: string;
  message: string;
  actionUrl?: string;
}

/**
 * Create a notification for a specific user
 */
async function createNotificationForUser(
  userId: string,
  notificationData: BaseNotificationData,
  context: NotificationContext,
) {
  // Don't notify the actor of their own actions
  if (userId === context.actorId) {
    return null;
  }

  const notificationId = generatePrefixedId("notification");

  await db.insert(notifications).values({
    id: notificationId,
    user_id: userId,
    organization_id: context.organizationId,
    type: notificationData.type,
    entity_type: notificationData.entityType,
    entity_id: notificationData.entityId,
    message: notificationData.message,
    action_url:
      notificationData.actionUrl ??
      createNotificationActionUrl(
        notificationData.entityType,
        notificationData.entityId,
      ),
    read: false,
  });

  return notificationId;
}

/**
 * Get users who should be notified about an issue
 */
async function getIssueStakeholders(issueId: string, organizationId: string) {
  const issue = await db.query.issues.findFirst({
    where: and(
      eq(issues.id, issueId),
      eq(issues.organization_id, organizationId),
    ),
    with: {
      assignedTo: {
        columns: { id: true, name: true, email: true },
      },
      createdBy: {
        columns: { id: true, name: true, email: true },
      },
      machine: {
        columns: { id: true, name: true },
        with: {
          owner: {
            columns: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!issue) return [];

  const stakeholders: {
    id: string;
    name: string;
    email: string;
    role: string;
  }[] = [];

  // Add assignee
  if (issue.assignedTo) {
    stakeholders.push({
      ...issue.assignedTo,
      name: issue.assignedTo.name ?? issue.assignedTo.email ?? "Unknown User",
      email: issue.assignedTo.email ?? "",
      role: "assignee",
    });
  }

  // Add issue creator
  if (issue.createdBy) {
    stakeholders.push({
      ...issue.createdBy,
      name: issue.createdBy.name ?? issue.createdBy.email ?? "Unknown User",
      email: issue.createdBy.email ?? "",
      role: "creator",
    });
  }

  // Add machine owner
  if (issue.machine?.owner) {
    stakeholders.push({
      ...issue.machine.owner,
      name:
        issue.machine.owner.name ?? issue.machine.owner.email ?? "Unknown User",
      email: issue.machine.owner.email ?? "",
      role: "machine_owner",
    });
  }

  // Remove duplicates by user ID
  const uniqueStakeholders = stakeholders.reduce<typeof stakeholders>(
    (acc, stakeholder) => {
      if (!acc.find((s) => s.id === stakeholder.id)) {
        acc.push(stakeholder);
      }
      return acc;
    },
    [],
  );

  return uniqueStakeholders;
}

/**
 * Generate notifications for new comment on issue
 */
export async function generateCommentNotifications(
  issueId: string,
  _commentId: string,
  context: NotificationContext,
) {
  try {
    // Get issue details and stakeholders
    const issue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organization_id, context.organizationId),
      ),
      columns: { id: true, title: true },
      with: {
        machine: {
          columns: { name: true },
        },
      },
    });

    if (!issue) {
      console.error(`Issue ${issueId} not found for comment notification`);
      return [];
    }

    const stakeholders = await getIssueStakeholders(
      issueId,
      context.organizationId,
    );
    const notificationIds: string[] = [];

    const message = `${context.actorName} commented on issue "${issue.title}" (${issue.machine?.name ?? "Unknown Machine"})`;

    // Create notifications for all stakeholders
    for (const stakeholder of stakeholders) {
      const notificationId = await createNotificationForUser(
        stakeholder.id,
        {
          type: "ISSUE_COMMENTED",
          entityType: "ISSUE",
          entityId: issueId,
          message,
          actionUrl: `/issues/${issueId}#comments`,
        },
        context,
      );

      if (notificationId) {
        notificationIds.push(notificationId);
      }
    }

    console.log(
      `Generated ${notificationIds.length} comment notifications for issue ${issueId}`,
    );
    return notificationIds;
  } catch (error) {
    console.error("Failed to generate comment notifications:", error);
    return [];
  }
}

/**
 * Generate notifications for issue assignment
 */
export async function generateAssignmentNotifications(
  issueId: string,
  newAssigneeId: string | null,
  _previousAssigneeId: string | null,
  context: NotificationContext,
) {
  try {
    const issue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organization_id, context.organizationId),
      ),
      columns: { id: true, title: true },
      with: {
        machine: {
          columns: { name: true },
        },
      },
    });

    if (!issue) {
      console.error(`Issue ${issueId} not found for assignment notification`);
      return [];
    }

    const notificationIds: string[] = [];
    const message = `${context.actorName} assigned you to issue "${issue.title}" (${issue.machine?.name ?? "Unknown Machine"})`;

    // Notify new assignee (if different from actor)
    if (newAssigneeId && newAssigneeId !== context.actorId) {
      const notificationId = await createNotificationForUser(
        newAssigneeId,
        {
          type: "ISSUE_ASSIGNED",
          entityType: "ISSUE",
          entityId: issueId,
          message,
        },
        context,
      );

      if (notificationId) {
        notificationIds.push(notificationId);
      }
    }

    console.log(
      `Generated ${notificationIds.length} assignment notifications for issue ${issueId}`,
    );
    return notificationIds;
  } catch (error) {
    console.error("Failed to generate assignment notifications:", error);
    return [];
  }
}

/**
 * Generate notifications for issue status changes
 */
export async function generateStatusChangeNotifications(
  issueId: string,
  newStatusName: string,
  context: NotificationContext,
) {
  try {
    const issue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organization_id, context.organizationId),
      ),
      columns: { id: true, title: true },
      with: {
        machine: {
          columns: { name: true },
        },
      },
    });

    if (!issue) {
      console.error(
        `Issue ${issueId} not found for status change notification`,
      );
      return [];
    }

    const stakeholders = await getIssueStakeholders(
      issueId,
      context.organizationId,
    );
    const notificationIds: string[] = [];

    const message = `${context.actorName} updated the status of "${issue.title}" to ${newStatusName} (${issue.machine?.name ?? "Unknown Machine"})`;

    // Create notifications for all stakeholders
    for (const stakeholder of stakeholders) {
      const notificationId = await createNotificationForUser(
        stakeholder.id,
        {
          type: "ISSUE_UPDATED",
          entityType: "ISSUE",
          entityId: issueId,
          message,
        },
        context,
      );

      if (notificationId) {
        notificationIds.push(notificationId);
      }
    }

    console.log(
      `Generated ${notificationIds.length} status change notifications for issue ${issueId}`,
    );
    return notificationIds;
  } catch (error) {
    console.error("Failed to generate status change notifications:", error);
    return [];
  }
}

/**
 * Generate notifications for new issue creation
 */
export async function generateIssueCreationNotifications(
  issueId: string,
  context: NotificationContext,
) {
  try {
    const issue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organization_id, context.organizationId),
      ),
      columns: { id: true, title: true },
      with: {
        machine: {
          columns: { name: true },
          with: {
            owner: {
              columns: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!issue) {
      console.error(`Issue ${issueId} not found for creation notification`);
      return [];
    }

    const notificationIds: string[] = [];
    const message = `New issue "${issue.title}" reported for ${issue.machine?.name ?? "Unknown Machine"}`;

    // Notify machine owner (if different from creator)
    if (issue.machine?.owner && issue.machine.owner.id !== context.actorId) {
      const notificationId = await createNotificationForUser(
        issue.machine.owner.id,
        {
          type: "ISSUE_CREATED",
          entityType: "ISSUE",
          entityId: issueId,
          message,
        },
        context,
      );

      if (notificationId) {
        notificationIds.push(notificationId);
      }
    }

    console.log(
      `Generated ${notificationIds.length} issue creation notifications for issue ${issueId}`,
    );
    return notificationIds;
  } catch (error) {
    console.error("Failed to generate issue creation notifications:", error);
    return [];
  }
}
