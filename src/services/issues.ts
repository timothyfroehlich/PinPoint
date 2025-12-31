import { eq, and, type InferSelectModel, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
  issues,
  issueWatchers,
  machines,
  issueComments,
  userProfiles,
  notificationPreferences,
} from "~/server/db/schema";
import { createTimelineEvent } from "~/lib/timeline/events";
import { createNotification } from "~/lib/notifications";
import { log } from "~/lib/logger";
import { formatIssueId } from "~/lib/issues/utils";

// --- Types ---

export interface CreateIssueParams {
  title: string;
  description?: string | null;
  machineInitials: string;
  severity: string;
  priority?: string | undefined;
  reportedBy?: string | null;
  unconfirmedReportedBy?: string | null;
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
 * Handles DB insert (with sequential numbering), timeline event, watchers, and notifications.
 */
export async function createIssue({
  title,
  description,
  machineInitials,
  severity,
  priority,
  reportedBy,
  unconfirmedReportedBy,
}: CreateIssueParams): Promise<Issue> {
  return await db.transaction(async (tx) => {
    // 1. Lock machine row and get next number (Atomic increment)
    const [updatedMachine] = await tx
      .update(machines)
      .set({ nextIssueNumber: sql`${machines.nextIssueNumber} + 1` })
      .where(eq(machines.initials, machineInitials))
      .returning({
        nextIssueNumber: machines.nextIssueNumber,
        name: machines.name,
        ownerId: machines.ownerId,
      });

    if (!updatedMachine) {
      throw new Error(`Machine not found: ${machineInitials}`);
    }

    // The number we just reserved is (nextIssueNumber - 1) because we incremented it
    const issueNumber = updatedMachine.nextIssueNumber - 1;

    // 2. Insert Issue
    const [issue] = await tx
      .insert(issues)
      .values({
        machineInitials,
        issueNumber,
        title,
        description: description ?? null,
        severity: severity as "minor" | "playable" | "unplayable",
        priority: (priority ?? "low") as "low" | "medium" | "high",
        reportedBy: reportedBy ?? null,
        unconfirmedReportedBy: unconfirmedReportedBy ?? null,
        status: "new",
      })
      .returning();

    if (!issue) throw new Error("Issue creation failed");

    // 3. Create Timeline Event
    await createTimelineEvent(
      issue.id,
      reportedBy || unconfirmedReportedBy
        ? "Issue created"
        : "Issue reported via public form",
      tx
    );

    log.info(
      {
        issueId: issue.id,
        machineInitials,
        issueNumber,
        reportedBy,
        action: "createIssue",
      },
      "Issue created successfully"
    );

    // 4. Auto-Watch Logic
    // Reporter
    if (reportedBy) {
      await tx
        .insert(issueWatchers)
        .values({ issueId: issue.id, userId: reportedBy })
        .onConflictDoNothing();
    }

    // Machine Owner (if prefs enabled)
    if (updatedMachine.ownerId) {
      const ownerPrefs = await tx.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, updatedMachine.ownerId),
      });

      // If owner wants notifications for new issues, auto-watch this specific issue
      if (
        ownerPrefs?.emailNotifyOnNewIssue ||
        ownerPrefs?.inAppNotifyOnNewIssue
      ) {
        await tx
          .insert(issueWatchers)
          .values({ issueId: issue.id, userId: updatedMachine.ownerId })
          .onConflictDoNothing();
      }
    }

    // 5. Notifications
    try {
      // Trigger Notification (actorId optional for public reports)
      await createNotification(
        {
          type: "new_issue",
          resourceId: issue.id,
          resourceType: "issue",
          ...(reportedBy ? { actorId: reportedBy } : {}),
          includeActor: true,
          issueTitle: title,
          machineName: updatedMachine.name,
          formattedIssueId: formatIssueId(machineInitials, issueNumber),
          issueContext: { machineOwnerId: updatedMachine.ownerId ?? null },
        },
        tx
      );
    } catch (error) {
      log.error(
        { error, action: "createIssue.notifications" },
        "Failed to process notifications"
      );
      // Don't fail the action if notifications fail
    }

    return issue;
  });
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
  return await db.transaction(async (tx) => {
    // Get current issue to check old status
    const currentIssue = await tx.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: {
        status: true,
        machineInitials: true, // Changed from machineId
        issueNumber: true,
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
    await tx
      .update(issues)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId));

    // 2. Create Timeline Event
    await createTimelineEvent(
      issueId,
      `Status changed from ${oldStatus} to ${status}`,
      tx
    );

    log.info(
      { issueId, oldStatus, newStatus: status, action: "updateIssueStatus" },
      "Issue status updated"
    );

    // 3. Trigger Notification
    try {
      await createNotification(
        {
          type: "issue_status_changed",
          resourceId: issueId,
          resourceType: "issue",
          actorId: userId,
          includeActor: true,
          issueTitle: currentIssue.title,
          machineName: currentIssue.machine.name,
          formattedIssueId: formatIssueId(
            currentIssue.machineInitials,
            currentIssue.issueNumber
          ),
          newStatus: status,
          issueContext: {
            assignedToId: currentIssue.assignedTo ?? null,
            reportedById: currentIssue.reportedBy ?? null,
          },
        },
        tx
      );
    } catch (error) {
      log.error(
        { error, action: "updateIssueStatus.notifications" },
        "Failed to send notification"
      );
    }

    return { issueId, oldStatus, newStatus: status };
  });
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

  // 2. Auto-watch for commenter
  await db
    .insert(issueWatchers)
    .values({ issueId, userId })
    .onConflictDoNothing();

  // 3. Trigger Notification
  try {
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: {
        title: true,
        assignedTo: true,
        reportedBy: true,
        machineInitials: true,
        issueNumber: true,
      },
      with: { machine: true },
    });

    await createNotification({
      type: "new_comment",
      resourceId: issueId,
      resourceType: "issue",
      actorId: userId,
      issueTitle: issue?.title ?? undefined,
      machineName: issue?.machine.name ?? undefined,
      formattedIssueId: issue
        ? formatIssueId(issue.machineInitials, issue.issueNumber)
        : undefined,
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
  await db.transaction(async (tx) => {
    // Get current issue
    const currentIssue = await tx.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: {
        machineInitials: true,
        issueNumber: true,
        title: true,
        reportedBy: true,
      }, // Changed from machineId
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
      const assignee = await tx.query.userProfiles.findFirst({
        where: eq(userProfiles.id, assignedTo),
        columns: { name: true },
      });
      assigneeName = assignee?.name ?? "Unknown User";
    }

    // Update assignment
    await tx
      .update(issues)
      .set({
        assignedTo,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId));

    // Auto-watch for assignee
    if (assignedTo) {
      await tx
        .insert(issueWatchers)
        .values({ issueId, userId: assignedTo })
        .onConflictDoNothing();
    }

    // Create timeline event
    const eventMessage = assignedTo
      ? `Assigned to ${assigneeName}`
      : "Unassigned";
    await createTimelineEvent(issueId, eventMessage, tx);

    log.info(
      { issueId, assignedTo, assigneeName, action: "assignIssue" },
      "Issue assignment updated"
    );

    // Trigger Notification
    try {
      if (assignedTo) {
        // Notify
        await createNotification(
          {
            type: "issue_assigned",
            resourceId: issueId,
            resourceType: "issue",
            actorId,
            includeActor: true,
            issueTitle: currentIssue.title,
            machineName: currentIssue.machine.name,
            formattedIssueId: formatIssueId(
              currentIssue.machineInitials,
              currentIssue.issueNumber
            ),
            issueContext: {
              assignedToId: assignedTo,
              reportedById: currentIssue.reportedBy ?? null,
            },
          },
          tx
        );
      }
    } catch (error) {
      log.error(
        { error, action: "assignIssue.notifications" },
        "Failed to process notifications"
      );
    }
  });
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
    columns: { severity: true, machineInitials: true }, // Changed from machineId
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
    columns: { priority: true, machineInitials: true }, // Changed from machineId
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
