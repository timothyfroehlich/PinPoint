import { eq, and, type InferSelectModel } from "drizzle-orm";
import { db } from "~/server/db";
import {
  issues,
  issueWatchers,
  machines,
  notificationPreferences,
  issueComments,
} from "~/server/db/schema";
import { createTimelineEvent } from "~/lib/timeline/events";
import { createNotification } from "~/lib/notifications";
import { log } from "~/lib/logger";

// --- Types ---

export interface CreateIssueParams {
  title: string;
  description?: string | null;
  machineId: string;
  severity: string;
  priority?: string;
  reportedBy?: string | null; // Null for anonymous
}

export interface UpdateIssueStatusParams {
  issueId: string;
  status: "new" | "in_progress" | "resolved";
  userId: string;
}

export interface AddIssueCommentParams {
  issueId: string;
  content: string;
  userId: string;
}

export type Issue = InferSelectModel<typeof issues>;
export type IssueComment = InferSelectModel<typeof issueComments>;

// --- Service Functions ---

/**
 * Create a new issue
 * Handles DB insert, timeline event, watchers, and notifications.
 */
export async function createIssue({
  title,
  description,
  machineId,
  severity,
  priority,
  reportedBy,
}: CreateIssueParams): Promise<Issue> {
  // 1. Insert Issue
  const [issue] = await db
    .insert(issues)
    .values({
      machineId,
      title,
      description: description ?? null,
      severity: severity as "minor" | "playable" | "unplayable",
      priority: (priority ?? "low") as "low" | "medium" | "high",
      reportedBy: reportedBy ?? null,
      status: "new",
    })
    .returning();

  if (!issue) throw new Error("Issue creation failed");

  // 2. Create Timeline Event
  await createTimelineEvent(
    issue.id,
    reportedBy ? "Issue created" : "Issue reported via public form"
  );

  log.info(
    {
      issueId: issue.id,
      machineId,
      reportedBy,
      action: "createIssue",
    },
    "Issue created successfully"
  );

  // 3. Setup Watchers & Notifications
  try {
    const watcherIds = new Set<string>();

    // A. Reporter (always watches if authenticated)
    if (reportedBy) {
      watcherIds.add(reportedBy);
    }

    // B. Machine Owner (if auto-watch enabled)
    const machine = await db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      with: { owner: true },
    });

    if (machine?.ownerId) {
      const ownerPrefs = await db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, machine.ownerId),
      });
      if (ownerPrefs?.autoWatchOwnedMachines) {
        watcherIds.add(machine.ownerId);
      }
    }

    // C. Global Subscribers
    const globalSubs = await db.query.notificationPreferences.findMany({
      where: (prefs, { or, eq }) =>
        or(
          eq(prefs.emailWatchNewIssuesGlobal, true),
          eq(prefs.inAppWatchNewIssuesGlobal, true)
        ),
    });
    globalSubs.forEach((sub) => watcherIds.add(sub.userId));

    // Insert Watchers
    if (watcherIds.size > 0) {
      await db
        .insert(issueWatchers)
        .values(
          Array.from(watcherIds).map((userId) => ({
            issueId: issue.id,
            userId,
          }))
        )
        .onConflictDoNothing();
    }

    // Trigger Notification
    // Note: actorId is optional for public reports
    await createNotification({
      type: "new_issue",
      resourceId: issue.id,
      resourceType: "issue",
      ...(reportedBy ? { actorId: reportedBy } : {}),
      issueTitle: title,
      machineName: machine?.name ?? undefined,
    });
  } catch (error) {
    log.error(
      { error, action: "createIssue.notifications" },
      "Failed to process notifications"
    );
    // Don't fail the action if notifications fail
  }

  return issue;
}

/**
 * Update issue status
 * Handles DB update, timeline event, and notifications.
 */
export async function updateIssueStatus({
  issueId,
  status,
  userId,
}: UpdateIssueStatusParams): Promise<{
  issueId: string;
  oldStatus: string;
  newStatus: string;
}> {
  // Get current issue to check old status
  const currentIssue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { status: true, machineId: true, title: true },
    with: { machine: true },
  });

  if (!currentIssue) {
    throw new Error("Issue not found");
  }

  const oldStatus = currentIssue.status;

  // 1. Update Status
  await db
    .update(issues)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId));

  // 2. Create Timeline Event
  await createTimelineEvent(
    issueId,
    `Status changed from ${oldStatus} to ${status}`
  );

  log.info(
    { issueId, oldStatus, newStatus: status, action: "updateIssueStatus" },
    "Issue status updated"
  );

  // 3. Trigger Notification
  try {
    await createNotification({
      type: "issue_status_changed",
      resourceId: issueId,
      resourceType: "issue",
      actorId: userId,
      issueTitle: currentIssue.title,
      machineName: currentIssue.machine.name,
      newStatus: status,
    });
  } catch (error) {
    log.error(
      { error, action: "updateIssueStatus.notifications" },
      "Failed to send notification"
    );
  }

  return { issueId, oldStatus, newStatus: status };
}

/**
 * Add a comment to an issue
 * Handles DB insert, watcher addition, and notifications.
 */
export async function addIssueComment({
  issueId,
  content,
  userId,
}: AddIssueCommentParams): Promise<IssueComment> {
  // 1. Insert Comment
  const [comment] = await db
    .insert(issueComments)
    .values({
      issueId,
      authorId: userId,
      content,
      isSystem: false,
    })
    .returning();

  if (!comment) throw new Error("Failed to create comment");

  // 2. Add Author as Watcher (Auto-watch on comment)
  await db
    .insert(issueWatchers)
    .values({
      issueId,
      userId,
    })
    .onConflictDoNothing();

  // 3. Trigger Notification
  try {
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { title: true },
      with: { machine: true },
    });

    await createNotification({
      type: "new_comment",
      resourceId: issueId,
      resourceType: "issue",
      actorId: userId,
      issueTitle: issue?.title ?? undefined,
      machineName: issue?.machine.name ?? undefined,
      commentContent: content,
    });
  } catch (error) {
    log.error(
      { error, action: "addIssueComment.notifications" },
      "Failed to send notification"
    );
  }

  return comment;
}

/**
 * Toggle watcher status for a user on an issue
 */
export async function toggleIssueWatcher({
  issueId,
  userId,
}: {
  issueId: string;
  userId: string;
}): Promise<{ isWatching: boolean }> {
  // Check if already watching
  const existing = await db.query.issueWatchers.findFirst({
    where: and(
      eq(issueWatchers.issueId, issueId),
      eq(issueWatchers.userId, userId)
    ),
  });

  if (existing) {
    // Unwatch
    await db
      .delete(issueWatchers)
      .where(
        and(
          eq(issueWatchers.issueId, issueId),
          eq(issueWatchers.userId, userId)
        )
      );
    return { isWatching: false };
  } else {
    // Watch
    await db.insert(issueWatchers).values({
      issueId,
      userId,
    });
    return { isWatching: true };
  }
}
