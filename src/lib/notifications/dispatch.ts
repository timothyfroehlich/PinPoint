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
import { log } from "~/lib/logger";
import { getChannels } from "./channels/registry";
import type { ChannelContext, DeliveryResult } from "./channels/types";

type NotificationPreferences = typeof notificationPreferences.$inferSelect;

export type NotificationType =
  | "issue_assigned"
  | "issue_status_changed"
  | "new_comment"
  | "new_issue"
  | "machine_ownership_changed"
  | "mentioned";

type ResourceType = "issue" | "machine";

export interface CreateNotificationProps {
  type: NotificationType;
  resourceId: string;
  resourceType: ResourceType;
  actorId?: string | undefined;
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
  includeActor?: boolean | undefined;
  issueTitle?: string | undefined;
  machineName?: string | undefined;
  formattedIssueId?: string | undefined;
  commentContent?: string | undefined;
  newStatus?: string | undefined;
  issueDescription?: string | undefined;
  additionalRecipientIds?: string[] | undefined;
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
    issueDescription,
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

    if (resourceType === "issue") {
      const issue = await tx.query.issues.findFirst({
        where: eq(issues.id, resourceId),
        with: { machine: true },
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

    if (!resolvedFormattedIssueId && resourceType === "issue") {
      const issue = await tx.query.issues.findFirst({
        where: eq(issues.id, resourceId),
        columns: { issueNumber: true, machineInitials: true },
      });
      if (issue) {
        resolvedFormattedIssueId = `${issue.machineInitials}-${String(issue.issueNumber).padStart(2, "0")}`;
      }
    }

    const globalSubscribers = await tx.query.notificationPreferences.findMany({
      where: (prefs, { or, eq }) =>
        or(
          eq(prefs.emailWatchNewIssuesGlobal, true),
          eq(prefs.inAppWatchNewIssuesGlobal, true)
        ),
    });

    addRecipients(...globalSubscribers.map((p) => p.userId));

    if (machineId) {
      const watchersList = await tx.query.machineWatchers.findMany({
        where: eq(machineWatchers.machineId, machineId),
      });

      addRecipients(...watchersList.map((w) => w.userId));

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
  } else if (
    resourceType === "issue" &&
    type !== "issue_assigned" &&
    type !== "mentioned"
  ) {
    const watchers = await tx.query.issueWatchers.findMany({
      where: eq(issueWatchers.issueId, resourceId),
    });

    addRecipients(...watchers.map((w: IssueWatcher) => w.userId));
  }

  if (includeActor && actorId) {
    recipientIds.add(actorId);
  }
  if (actorId && !includeActor) {
    recipientIds.delete(actorId);
  }

  if (recipientIds.size === 0) return;

  // 2. Fetch preferences
  const preferences = await tx.query.notificationPreferences.findMany({
    where: inArray(notificationPreferences.userId, [...recipientIds]),
  });
  const prefsMap = new Map(preferences.map((p) => [p.userId, p]));

  // 3. Fetch emails (avoid N+1)
  const users = await tx
    .select({ id: userProfiles.id, email: userProfiles.email })
    .from(userProfiles)
    .where(inArray(userProfiles.id, [...recipientIds]));
  const emailMap = new Map(users.map((u) => [u.id, u.email]));

  // 4. Fan-out per recipient using the channel registry.
  //    See src/lib/notifications/channels/registry.ts.
  const channels = getChannels();

  // Rows for batched in-app insert (preserves historical single-INSERT).
  const notificationsToInsert: {
    userId: string;
    type: NotificationType;
    resourceId: string;
    resourceType: ResourceType;
  }[] = [];

  // Email dispatch is concurrent via Promise.allSettled so one slow/failed
  // email doesn't block others (spec: "Promise.allSettled concurrent dispatch
  // preserved").
  const deferredDeliveries: (() => Promise<DeliveryResult>)[] = [];

  for (const userId of recipientIds) {
    const prefs =
      (prefsMap.get(userId) as NotificationPreferences | undefined) ??
      buildDefaultPrefs(userId);

    // Cross-channel pre-dispatch rule: skip own actions entirely.
    // (Spec decision: suppressOwnActions stays at the top of the recipient
    // loop — it is NOT per-channel.)
    if (actorId && userId === actorId && prefs.suppressOwnActions) {
      continue;
    }

    const ctx: ChannelContext = {
      userId,
      type,
      resourceId,
      resourceType,
      email: emailMap.get(userId) ?? null,
      issueTitle: resolvedIssueTitle,
      machineName: resolvedMachineName,
      formattedIssueId: resolvedFormattedIssueId,
      commentContent,
      newStatus,
      issueDescription,
      tx,
    };

    for (const channel of channels) {
      if (!channel.shouldDeliver(prefs, type)) continue;

      if (channel.key === "in_app") {
        // Batched insert — collect, don't deliver individually.
        notificationsToInsert.push({
          userId,
          type,
          resourceId,
          resourceType,
        });
      } else {
        // Email (and future Discord): deferred until after the in-app insert
        // succeeds. Pushing a thunk (not the promise itself) prevents deliver()
        // from starting mid-loop, which would send side-effects before the DB
        // write completes and on insert failure leave emails sent without rows.
        deferredDeliveries.push(() => channel.deliver(ctx));
      }
    }
  }

  if (notificationsToInsert.length > 0) {
    log.debug(
      { count: notificationsToInsert.length, action: "createNotification" },
      "Inserting notifications"
    );
    await tx.insert(notifications).values(notificationsToInsert);
  }

  if (deferredDeliveries.length > 0) {
    const results = await Promise.allSettled(
      deferredDeliveries.map((fn) => fn())
    );
    for (const r of results) {
      if (r.status === "rejected") {
        // Channel.deliver() is expected to catch its own errors and return
        // {ok:false}. A rejection here means a bug — log at error level.
        const err: unknown = r.reason;
        log.error({ err }, "Notification channel delivery rejected");
      }
    }
  }
}

/**
 * Fallback prefs used within this module when a user has no row in
 * notification_preferences.
 */
function buildDefaultPrefs(userId: string): NotificationPreferences {
  return {
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
    emailNotifyOnMentioned: true,
    inAppNotifyOnMentioned: true,
    emailNotifyOnNewIssue: true,
    inAppNotifyOnNewIssue: false,
    emailWatchNewIssuesGlobal: false,
    inAppWatchNewIssuesGlobal: false,
    emailNotifyOnMachineOwnershipChange: false,
    inAppNotifyOnMachineOwnershipChange: false,
  };
}
