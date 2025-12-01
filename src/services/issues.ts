import { eq, and, type InferSelectModel } from "drizzle-orm";
import { db } from "~/server/db";
import {
  issues,
  issueWatchers,
  machines,
  issueComments,
  userProfiles,
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

export interface AssignIssueParams {
  issueId: string;
  assignedTo: string | null;
  actorId: string;
}

export interface UpdateIssueSeverityParams {
  issueId: string;
  severity: string;
}

export interface UpdateIssuePriorityParams {
  issueId: string;
  priority: string;
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

  // 3. Notifications
  try {
    const machine = await db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      columns: { name: true, ownerId: true },
    });

    // Trigger Notification (actorId optional for public reports)
    await createNotification({
      type: "new_issue",
      resourceId: issue.id,
      resourceType: "issue",
      ...(reportedBy ? { actorId: reportedBy } : {}),
      includeActor: true,
      issueTitle: title,
      machineName: machine?.name ?? undefined,
      issueContext: { machineOwnerId: machine?.ownerId ?? null },
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
    columns: {
      status: true,
      machineId: true,
      title: true,
      assignedTo: true,
      reportedBy: true,
    },
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
      includeActor: true,
      issueTitle: currentIssue.title,
      machineName: currentIssue.machine.name,
      newStatus: status,
      issueContext: {
        assignedToId: currentIssue.assignedTo ?? null,
        reportedById: currentIssue.reportedBy ?? null,
      },
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

  // 2. Trigger Notification
  try {
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { title: true, assignedTo: true, reportedBy: true },
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
      issueContext: {
        assignedToId: issue?.assignedTo ?? null,
        reportedById: issue?.reportedBy ?? null,
      },
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

/**
 * Assign an issue to a user
 */
export async function assignIssue({
  issueId,
  assignedTo,
  actorId,
}: AssignIssueParams): Promise<void> {
  // Get current issue
  const currentIssue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { machineId: true, title: true, reportedBy: true },
    with: {
      machine: true,
      assignedToUser: {
        columns: { name: true },
      },
    },
  });

  if (!currentIssue) {
    throw new Error("Issue not found");
  }

  // Get new assignee name if assigning to someone
  let assigneeName = "Unassigned";
  if (assignedTo) {
    const assignee = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, assignedTo),
      columns: { name: true },
    });
    assigneeName = assignee?.name ?? "Unknown User";
  }

  // Update assignment
  await db
    .update(issues)
    .set({
      assignedTo,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId));

  // Create timeline event
  const eventMessage = assignedTo
    ? `Assigned to ${assigneeName}`
    : "Unassigned";
  await createTimelineEvent(issueId, eventMessage);

  log.info(
    { issueId, assignedTo, assigneeName, action: "assignIssue" },
    "Issue assignment updated"
  );

  // Trigger Notification
  try {
    if (assignedTo) {
      // Notify
      await createNotification({
        type: "issue_assigned",
        resourceId: issueId,
        resourceType: "issue",
        actorId,
        includeActor: true,
        issueTitle: currentIssue.title,
        machineName: currentIssue.machine.name,
        issueContext: {
          assignedToId: assignedTo,
          reportedById: currentIssue.reportedBy ?? null,
        },
      });
    }
  } catch (error) {
    log.error(
      { error, action: "assignIssue.notifications" },
      "Failed to process notifications"
    );
  }
}

/**
 * Update issue severity
 */
export async function updateIssueSeverity({
  issueId,
  severity,
}: UpdateIssueSeverityParams): Promise<{
  issueId: string;
  oldSeverity: string;
  newSeverity: string;
}> {
  // Get current issue to check old severity
  const currentIssue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { severity: true, machineId: true },
  });

  if (!currentIssue) {
    throw new Error("Issue not found");
  }

  const oldSeverity = currentIssue.severity;

  // Update severity
  await db
    .update(issues)
    .set({
      severity: severity as "minor" | "playable" | "unplayable",
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId));

  // Create timeline event
  await createTimelineEvent(
    issueId,
    `Severity changed from ${oldSeverity} to ${severity}`
  );

  log.info(
    {
      issueId,
      oldSeverity,
      newSeverity: severity,
      action: "updateIssueSeverity",
    },
    "Issue severity updated"
  );

  return { issueId, oldSeverity, newSeverity: severity };
}

/**
 * Update issue priority
 */
export async function updateIssuePriority({
  issueId,
  priority,
}: UpdateIssuePriorityParams): Promise<{
  issueId: string;
  oldPriority: string;
  newPriority: string;
}> {
  // Get current issue to check old priority
  const currentIssue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { priority: true, machineId: true },
  });

  if (!currentIssue) {
    throw new Error("Issue not found");
  }

  const oldPriority = currentIssue.priority;

  // Update priority
  await db
    .update(issues)
    .set({
      priority: priority as "low" | "medium" | "high",
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId));

  // Create timeline event
  await createTimelineEvent(
    issueId,
    `Priority changed from ${oldPriority} to ${priority}`
  );

  log.info(
    {
      issueId,
      oldPriority,
      newPriority: priority,
      action: "updateIssuePriority",
    },
    "Issue priority updated"
  );

  return { issueId, oldPriority, newPriority: priority };
}
