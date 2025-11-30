import { eq, inArray } from "drizzle-orm";
import { db } from "~/server/db";
import {
  notifications,
  notificationPreferences,
  authUsers,
  issues,
  issueWatchers,
  machines,
} from "~/server/db/schema";
import { sendEmail } from "~/lib/email/client";
import { log } from "~/lib/logger";

export type NotificationType =
  | "issue_assigned"
  | "issue_status_changed"
  | "new_comment"
  | "new_issue";

type ResourceType = "issue" | "machine";

interface CreateNotificationProps {
  type: NotificationType;
  resourceId: string;
  resourceType: ResourceType;
  actorId: string; // User who triggered the notification (to exclude them)
  // Context data for emails
  issueTitle?: string | undefined;
  machineName?: string | undefined;
  commentContent?: string | undefined;
  newStatus?: string | undefined;
}

export async function createNotification(
  {
    type,
    resourceId,
    resourceType,
    actorId,
    issueTitle,
    machineName,
    commentContent,
    newStatus,
  }: CreateNotificationProps,
  tx = db
): Promise<void> {
  // 1. Determine recipients
  let recipientIds: string[] = [];

  if (type === "new_issue") {
    // Notify Machine Owner (if opted in)
    // Notify Global Subscribers

    // Get machine owner
    // If resourceId is issue, fetch issue to get machine
    let ownerId: string | null = null;

    if (resourceType === "issue") {
      const issue = await tx.query.issues.findFirst({
        where: eq(issues.id, resourceId),
        with: {
          machine: true,
        },
      });
      if (issue?.machine.ownerId) {
        ownerId = issue.machine.ownerId;
      }
    } else {
      // If resource is machine directly (unlikely for new_issue but possible)
      const machine = await tx.query.machines.findFirst({
        where: eq(machines.id, resourceId),
        columns: { ownerId: true },
      });
      if (machine?.ownerId) {
        ownerId = machine.ownerId;
      }
    }

    // Get Global Subscribers
    // We want anyone who has EITHER email OR in-app global watch enabled
    const globalSubscribers = await tx.query.notificationPreferences.findMany({
      where: (prefs, { or, eq }) =>
        or(
          eq(prefs.emailWatchNewIssuesGlobal, true),
          eq(prefs.inAppWatchNewIssuesGlobal, true)
        ),
    });

    const globalSubscriberIds = globalSubscribers.map((p) => p.userId);
    recipientIds.push(...globalSubscriberIds);

    // Add Owner if not already included and not the actor
    if (ownerId && !recipientIds.includes(ownerId)) {
      // Check owner preference
      const ownerPref = await tx.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, ownerId),
      });
      // Check if owner wants notifications for new issues (via either channel)
      if (
        ownerPref?.emailNotifyOnNewIssue ||
        ownerPref?.inAppNotifyOnNewIssue
      ) {
        recipientIds.push(ownerId);
      }
    }
  } else {
    // For other events, notify Watchers
    // Watchers are on the ISSUE
    if (resourceType === "issue") {
      const watchers = await tx.query.issueWatchers.findMany({
        where: eq(issueWatchers.issueId, resourceId),
      });
      recipientIds.push(...watchers.map((w) => w.userId));
    }
  }

  // Exclude actor
  recipientIds = recipientIds.filter((id) => id !== actorId);

  // Deduplicate
  recipientIds = [...new Set(recipientIds)];

  if (recipientIds.length === 0) return;

  // 2. Fetch Preferences for all recipients
  const preferences = await tx.query.notificationPreferences.findMany({
    where: inArray(notificationPreferences.userId, recipientIds),
  });

  const prefsMap = new Map(preferences.map((p) => [p.userId, p]));

  // 3. Fetch Emails for all recipients (to avoid N+1 in loop)
  const users = await tx
    .select({ id: authUsers.id, email: authUsers.email })
    .from(authUsers)
    .where(inArray(authUsers.id, recipientIds));

  const emailMap = new Map(users.map((u) => [u.id, u.email]));

  // 3. Create Notifications and Send Emails
  const notificationsToInsert = [];
  const emailsToSend = [];

  for (const userId of recipientIds) {
    const prefs = prefsMap.get(userId);
    if (!prefs) continue; // Should have prefs if in recipient list (or default)

    // Check specific toggle
    let emailNotify = false;
    let inAppNotify = false;

    switch (type) {
      case "issue_assigned":
        emailNotify = prefs.emailNotifyOnAssigned;
        inAppNotify = prefs.inAppNotifyOnAssigned;
        break;
      case "issue_status_changed":
        emailNotify = prefs.emailNotifyOnStatusChange;
        inAppNotify = prefs.inAppNotifyOnStatusChange;
        break;
      case "new_comment":
        emailNotify = prefs.emailNotifyOnNewComment;
        inAppNotify = prefs.inAppNotifyOnNewComment;
        break;
      case "new_issue": {
        // For new issues, we have two sources: Owned Machine vs Global Watch
        // If they are the owner, check owned preference
        // If they are a global watcher, check global preference
        // If both, either being true is sufficient (union)

        // Check if owner
        // Note: We don't have easy access to "is owner" here without passing it in or re-checking
        // But we can check if they have the "notify on new issue" pref enabled, which implies they want it for owned machines
        // AND check if they have global watch enabled.

        // However, the caller logic (createNotification) already filtered recipients based on these roles.
        // So if they are in the list, we just need to check which channel they want.

        // Simplified approach: Check if EITHER preference is on for the channel
        const isOwnerPref = prefs.emailNotifyOnNewIssue; // "New Issues" (Owned)
        const isGlobalPref = prefs.emailWatchNewIssuesGlobal;
        emailNotify = isOwnerPref || isGlobalPref;

        const isInAppOwnerPref = prefs.inAppNotifyOnNewIssue;
        const isInAppGlobalPref = prefs.inAppWatchNewIssuesGlobal;
        inAppNotify = isInAppOwnerPref || isInAppGlobalPref;
        break;
      }
    }

    // In-App
    if (prefs.inAppEnabled && inAppNotify) {
      notificationsToInsert.push({
        userId,
        type,
        resourceId,
        resourceType,
      });
    }

    // Email
    if (prefs.emailEnabled && emailNotify) {
      const email = emailMap.get(userId);

      if (email) {
        emailsToSend.push({
          to: email,
          subject: getEmailSubject(type, issueTitle, machineName),
          html: getEmailHtml(
            type,
            issueTitle,
            machineName,
            commentContent,
            newStatus
          ),
        });
      }
    }
  }

  // Batch Insert Notifications
  if (notificationsToInsert.length > 0) {
    await tx.insert(notifications).values(notificationsToInsert);
  }

  // Send Emails (fire and forget)
  emailsToSend.forEach((email) => {
    sendEmail(email).catch((err: unknown) => {
      log.error({ err }, "Failed to send email notification");
    });
  });
}

function getEmailSubject(
  type: NotificationType,
  issueTitle?: string,
  machineName?: string
): string {
  const prefix = machineName ? `[${machineName}] ` : "";
  switch (type) {
    case "new_issue":
      return `${prefix}New Issue: ${issueTitle}`;
    case "issue_assigned":
      return `${prefix}Issue Assigned: ${issueTitle}`;
    case "issue_status_changed":
      return `${prefix}Status Changed: ${issueTitle}`;
    case "new_comment":
      return `${prefix}New Comment on: ${issueTitle}`;
    default:
      return "PinPoint Notification";
  }
}

function getEmailHtml(
  type: NotificationType,
  issueTitle?: string,
  machineName?: string,
  commentContent?: string,
  newStatus?: string
): string {
  // Basic HTML for MVP
  let body = "";
  switch (type) {
    case "new_issue":
      body = `A new issue has been reported.`;
      break;
    case "issue_assigned":
      body = `You have been assigned to this issue.`;
      break;
    case "issue_status_changed":
      body = `Status changed to: <strong>${newStatus}</strong>`;
      break;
    case "new_comment":
      body = `New comment:<br/><blockquote>${commentContent}</blockquote>`;
      break;
  }

  const port = process.env["PORT"] ?? "3000";
  const siteUrl =
    process.env["NEXT_PUBLIC_SITE_URL"] ?? `http://localhost:${port}`;
  const machinePrefix = machineName ? `[${machineName}] ` : "";

  return `
      <h2>${machinePrefix}${issueTitle}</h2>
      <p>${body}</p>
      <p><a href="${siteUrl}/issues">View Issue</a></p>
    `;
}
