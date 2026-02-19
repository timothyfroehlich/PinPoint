import { eq, inArray } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import {
  notifications,
  notificationPreferences,
  userProfiles,
  issues,
  issueWatchers,
  machines,
  machineWatchers,
} from "~/server/db/schema";
import type { IssueWatcher } from "~/lib/types/database";
import { sendEmail } from "~/lib/email/client";
import { log } from "~/lib/logger";
import { isInternalAccount } from "~/lib/auth/internal-accounts";
import { getEmailHtml, getEmailSubject } from "~/lib/notification-formatting";

export type NotificationType =
  | "issue_assigned"
  | "issue_status_changed"
  | "new_comment"
  | "new_issue"
  | "machine_ownership_changed";

type ResourceType = "issue" | "machine";

export interface CreateNotificationProps {
  type: NotificationType;
  resourceId: string;
  resourceType: ResourceType;
  actorId?: string; // User who triggered the notification (optional for anonymous)
  /**
   * Whether to include the actor in the recipient set (default: true).
   *
   * Two separate layers control actor self-notification:
   * - `includeActor: false` — Business rule override. The actor is structurally
   *   excluded from the recipient set regardless of user preferences. Use for
   *   notifications where the actor is not a valid recipient (e.g., assigner
   *   in issue_assigned, admin performing machine ownership changes).
   * - `suppressOwnActions` (user pref) — The actor can globally opt out of
   *   receiving notifications for their own actions. Only evaluated when
   *   includeActor is true (default).
   */
  includeActor?: boolean;
  // Context data for emails
  issueTitle?: string | undefined;
  machineName?: string | undefined;
  formattedIssueId?: string | undefined;
  commentContent?: string | undefined;
  newStatus?: string | undefined;
  additionalRecipientIds?: string[];
}

export async function createNotification(
  {
    type,
    resourceId,
    resourceType,
    actorId,
    includeActor = true,
    issueTitle,
    machineName,
    formattedIssueId,
    commentContent,
    newStatus,
    additionalRecipientIds,
  }: CreateNotificationProps,
  tx: DbTransaction = db
): Promise<void> {
  log.debug(
    { type, resourceId, actorId, action: "createNotification" },
    "Creating notification"
  );

  // 1. Determine recipients
  const recipientIds = new Set<string>();

  const addRecipients = (...ids: (string | null | undefined)[]): void => {
    ids.forEach((id) => {
      if (id) recipientIds.add(id);
    });
  };

  addRecipients(...(additionalRecipientIds ?? []));

  let resolvedIssueTitle = issueTitle;
  let resolvedMachineName = machineName;
  let resolvedFormattedIssueId = formattedIssueId;

  if (type === "new_issue") {
    let machineId: string | null;

    // Resolve machineId and metadata
    if (resourceType === "issue") {
      const issue = await tx.query.issues.findFirst({
        where: eq(issues.id, resourceId),
        with: {
          machine: true,
        },
      });

      machineId = issue?.machine.id ?? null;
      resolvedIssueTitle = resolvedIssueTitle ?? issue?.title;
      resolvedMachineName = resolvedMachineName ?? issue?.machine.name;
    } else {
      const machine = await tx.query.machines.findFirst({
        where: eq(machines.id, resourceId),
        columns: { id: true, name: true },
      });
      machineId = machine?.id ?? null;
      resolvedMachineName = resolvedMachineName ?? machine?.name;
    }

    // Resolve formatted ID if missing
    if (!resolvedFormattedIssueId && resourceType === "issue") {
      const issue = await tx.query.issues.findFirst({
        where: eq(issues.id, resourceId),
        columns: { issueNumber: true, machineInitials: true },
      });
      if (issue) {
        resolvedFormattedIssueId = `${issue.machineInitials}-${String(issue.issueNumber).padStart(2, "0")}`;
      }
    }

    // 1. Global subscribers (email or in-app)
    const globalSubscribers = await tx.query.notificationPreferences.findMany({
      where: (prefs, { or, eq }) =>
        or(
          eq(prefs.emailWatchNewIssuesGlobal, true),
          eq(prefs.inAppWatchNewIssuesGlobal, true)
        ),
    });

    addRecipients(...globalSubscribers.map((p) => p.userId));

    // 2. Machine watchers (consolidated - includes owners)
    if (machineId) {
      const watchersList = await tx.query.machineWatchers.findMany({
        where: eq(machineWatchers.machineId, machineId),
      });

      addRecipients(...watchersList.map((w) => w.userId));

      // 3. Auto-subscribe full subscribers to issue watchers
      if (resourceType === "issue") {
        const fullSubscribers = watchersList.filter(
          (w) => w.watchMode === "subscribe"
        );

        if (fullSubscribers.length > 0) {
          await tx
            .insert(issueWatchers)
            .values(
              fullSubscribers.map((w) => ({
                issueId: resourceId,
                userId: w.userId,
              }))
            )
            .onConflictDoNothing();
        }
      }
    }
  } else if (resourceType === "issue" && type !== "issue_assigned") {
    const watchers = await tx.query.issueWatchers.findMany({
      where: eq(issueWatchers.issueId, resourceId),
    });

    addRecipients(...watchers.map((w: IssueWatcher) => w.userId));
  }

  if (includeActor && actorId) {
    recipientIds.add(actorId);
  }

  // Exclude actor and dedupe
  if (actorId && !includeActor) {
    recipientIds.delete(actorId);
  }

  if (recipientIds.size === 0) return;

  // 2. Fetch Preferences for all recipients
  const preferences = await tx.query.notificationPreferences.findMany({
    where: inArray(notificationPreferences.userId, [...recipientIds]),
  });

  const prefsMap = new Map(preferences.map((p) => [p.userId, p]));

  // 3. Fetch Emails for all recipients (to avoid N+1 in loop)
  const users = await tx
    .select({ id: userProfiles.id, email: userProfiles.email })
    .from(userProfiles)
    .where(inArray(userProfiles.id, [...recipientIds]));

  const emailMap = new Map(users.map((u) => [u.id, u.email]));

  // 3. Create Notifications and Send Emails
  const notificationsToInsert = [];
  const emailsToSend = [];

  for (const userId of recipientIds) {
    const prefs = prefsMap.get(userId) ?? {
      // Fallback defaults if no prefs found (e.g. trigger failed)
      userId,
      emailEnabled: true,
      inAppEnabled: true,
      suppressOwnActions: false,
      emailNotifyOnAssigned: true,
      inAppNotifyOnAssigned: true,
      emailNotifyOnStatusChange: false,
      inAppNotifyOnStatusChange: false,
      emailNotifyOnNewComment: false,
      inAppNotifyOnNewComment: false,
      emailNotifyOnNewIssue: true,
      inAppNotifyOnNewIssue: false,
      emailWatchNewIssuesGlobal: false,
      inAppWatchNewIssuesGlobal: false,
      emailNotifyOnMachineOwnershipChange: false,
      inAppNotifyOnMachineOwnershipChange: false,
    };

    // Skip this recipient entirely if they triggered the action and have suppressOwnActions enabled
    if (actorId && userId === actorId && prefs.suppressOwnActions) {
      continue;
    }

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
        const isOwnerPref = prefs.emailNotifyOnNewIssue;
        const isGlobalPref = prefs.emailWatchNewIssuesGlobal;
        emailNotify = isOwnerPref || isGlobalPref;

        const isInAppOwnerPref = prefs.inAppNotifyOnNewIssue;
        const isInAppGlobalPref = prefs.inAppWatchNewIssuesGlobal;
        inAppNotify = isInAppOwnerPref || isInAppGlobalPref;
        break;
      }
      case "machine_ownership_changed":
        // Always notify for ownership changes — this is critical information
        // for both old and new owners. Only main switches can suppress.
        emailNotify = true;
        inAppNotify = true;
        break;
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

    // Email (skip internal accounts — they have no real email)
    if (prefs.emailEnabled && emailNotify) {
      const email = emailMap.get(userId);

      if (email && !isInternalAccount(email)) {
        emailsToSend.push({
          to: email,
          subject: getEmailSubject(
            type,
            resolvedIssueTitle,
            resolvedMachineName,
            resolvedFormattedIssueId,
            newStatus
          ),
          html: getEmailHtml(
            type,
            resolvedIssueTitle,
            resolvedMachineName,
            resolvedFormattedIssueId,
            commentContent,
            newStatus,
            userId
          ),
        });
      }
    }
  }

  // Batch Insert Notifications
  if (notificationsToInsert.length > 0) {
    log.debug(
      { count: notificationsToInsert.length, action: "createNotification" },
      "Inserting notifications"
    );
    await tx.insert(notifications).values(notificationsToInsert);
  }

  // Send Emails (await all promises)
  if (emailsToSend.length > 0) {
    await Promise.all(
      emailsToSend.map((email) =>
        sendEmail(email).catch((err: unknown) => {
          log.error({ err }, "Failed to send email notification");
        })
      )
    );
  }
}
