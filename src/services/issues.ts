import { eq, and, type InferSelectModel, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
  issues,
  issueWatchers,
  machines,
  issueComments,
  userProfiles,
  issueImages,
} from "~/server/db/schema";
import { createTimelineEvent } from "~/lib/timeline/events";
import { createNotification } from "~/lib/notifications";
import { log } from "~/lib/logger";
import { formatIssueId } from "~/lib/issues/utils";
import {
  type IssueSeverity,
  type IssuePriority,
  type IssueFrequency,
  type IssueStatus,
} from "~/lib/types";
import {
  CLOSED_STATUSES,
  getIssueFrequencyLabel,
  getIssuePriorityLabel,
  getIssueSeverityLabel,
  getIssueStatusLabel,
} from "~/lib/issues/status";

// --- Types ---

export interface CreateIssueParams {
  title: string;
  description?: string | null;
  machineInitials: string;
  severity: IssueSeverity;
  priority?: IssuePriority | undefined;
  frequency?: IssueFrequency | undefined;
  status?: IssueStatus | undefined;
  reportedBy?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
  assignedTo?: string | null;
  autoWatchReporter?: boolean | undefined;
}

export interface UpdateIssueStatusParams {
  issueId: string;
  status: IssueStatus;
  userId: string;
}

export interface AddIssueCommentParams {
  issueId: string;
  content: string;
  userId: string;
  imagesMetadata?: {
    blobUrl: string;
    blobPathname: string;
    originalFilename: string;
    fileSizeBytes: number;
    mimeType: string;
  }[];
}

export interface AssignIssueParams {
  issueId: string;
  assignedTo: string | null;
  actorId: string;
}

export interface UpdateIssueSeverityParams {
  issueId: string;
  severity: IssueSeverity;
  userId: string;
}

export interface UpdateIssuePriorityParams {
  issueId: string;
  priority: IssuePriority;
  userId: string;
}

export interface UpdateIssueFrequencyParams {
  issueId: string;
  frequency: IssueFrequency;
  userId: string;
}

export interface UpdateIssueCommentParams {
  commentId: string;
  content: string;
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
  frequency,
  status,
  reportedBy,
  reporterName,
  reporterEmail,
  assignedTo,
  autoWatchReporter = true,
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
        severity,
        priority: priority ?? "medium",
        frequency: frequency ?? "intermittent",
        reportedBy: reportedBy ?? null,
        reporterName: reporterName ?? null,
        reporterEmail: reporterEmail ?? null,
        status: status ?? "new",
        assignedTo: assignedTo ?? null,
      })
      .returning();

    if (!issue) throw new Error("Issue creation failed");

    log.info(
      {
        issueId: issue.id,
        machineInitials,
        issueNumber,
        reportedBy,
        assignedTo,
        action: "createIssue",
      },
      "Issue created successfully"
    );

    // 3. Assignment Logic (if applicable)
    if (assignedTo) {
      // Create timeline event
      const assignee = await tx.query.userProfiles.findFirst({
        where: eq(userProfiles.id, assignedTo),
        columns: { name: true },
      });
      const assigneeName = assignee?.name ?? "Unknown User";
      await createTimelineEvent(issue.id, `Assigned to ${assigneeName}`, tx);

      // Auto-watch for assignee
      await tx
        .insert(issueWatchers)
        .values({ issueId: issue.id, userId: assignedTo })
        .onConflictDoNothing();
    }

    // 4. Auto-Watch Logic
    // Reporter
    if (autoWatchReporter && reportedBy) {
      await tx
        .insert(issueWatchers)
        .values({ issueId: issue.id, userId: reportedBy })
        .onConflictDoNothing();
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
          issueTitle: title,
          machineName: updatedMachine.name,
          formattedIssueId: formatIssueId(machineInitials, issueNumber),
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

    // No-op: skip if status hasn't changed
    if (oldStatus === status) {
      return { issueId, oldStatus, newStatus: status };
    }

    // 1. Update Status
    const isClosed = (CLOSED_STATUSES as readonly string[]).includes(status);
    await tx
      .update(issues)
      .set({
        status,
        updatedAt: new Date(),
        closedAt: isClosed ? new Date() : null,
      })
      .where(eq(issues.id, issueId));

    // 2. Create Timeline Event
    const oldLabel = getIssueStatusLabel(oldStatus);
    const newLabel = getIssueStatusLabel(status);
    await createTimelineEvent(
      issueId,
      `Status changed from ${oldLabel} to ${newLabel}`,
      tx,
      userId
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
          issueTitle: currentIssue.title,
          machineName: currentIssue.machine.name,
          formattedIssueId: formatIssueId(
            currentIssue.machineInitials,
            currentIssue.issueNumber
          ),
          newStatus: status,
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
  imagesMetadata = [],
}: AddIssueCommentParams): Promise<IssueComment> {
  return await db.transaction(async (tx) => {
    // 1. Insert Comment
    const [comment] = await tx
      .insert(issueComments)
      .values({
        issueId,
        authorId: userId,
        content,
        isSystem: false,
      })
      .returning();

    if (!comment) throw new Error("Failed to create comment");

    // 2. Link Images
    if (imagesMetadata.length > 0) {
      await tx.insert(issueImages).values(
        imagesMetadata.map((img) => ({
          issueId,
          commentId: comment.id,
          uploadedBy: userId,
          fullImageUrl: img.blobUrl,
          fullBlobPathname: img.blobPathname,
          fileSizeBytes: img.fileSizeBytes,
          mimeType: img.mimeType,
          originalFilename: img.originalFilename,
        }))
      );
    }

    // 3. Auto-watch for commenter
    await tx
      .insert(issueWatchers)
      .values({ issueId, userId })
      .onConflictDoNothing();

    // 4. Trigger Notification
    try {
      const issue = await tx.query.issues.findFirst({
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

      await createNotification(
        {
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
        },
        tx
      );
    } catch (error) {
      log.error(
        { error, action: "addIssueComment.notifications" },
        "Failed to send notification"
      );
    }
    return comment;
  });
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
        assignedTo: true,
      },
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

    // No-op: skip if assignment hasn't changed
    if (currentIssue.assignedTo === assignedTo) {
      return;
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
    await createTimelineEvent(issueId, eventMessage, tx, actorId);

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
            includeActor: false,
            additionalRecipientIds: [assignedTo],
            issueTitle: currentIssue.title,
            machineName: currentIssue.machine.name,
            formattedIssueId: formatIssueId(
              currentIssue.machineInitials,
              currentIssue.issueNumber
            ),
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
  userId,
}: UpdateIssueSeverityParams): Promise<{
  issueId: string;
  oldSeverity: string;
  newSeverity: string;
}> {
  // Get current issue to check old severity
  const currentIssue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { severity: true, machineInitials: true },
  });

  if (!currentIssue) {
    throw new Error("Issue not found");
  }

  const oldSeverity = currentIssue.severity;

  // No-op: skip if severity hasn't changed
  if (oldSeverity === severity) {
    return { issueId, oldSeverity, newSeverity: severity };
  }

  // Update severity
  await db
    .update(issues)
    .set({
      severity,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId));

  // Create timeline event
  const oldLabel = getIssueSeverityLabel(oldSeverity as IssueSeverity);
  const newLabel = getIssueSeverityLabel(severity);
  await createTimelineEvent(
    issueId,
    `Severity changed from ${oldLabel} to ${newLabel}`,
    db,
    userId
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
  userId,
}: UpdateIssuePriorityParams): Promise<{
  issueId: string;
  oldPriority: string;
  newPriority: string;
}> {
  // Get current issue to check old priority
  const currentIssue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { priority: true, machineInitials: true },
  });

  if (!currentIssue) {
    throw new Error("Issue not found");
  }

  const oldPriority = currentIssue.priority;

  // No-op: skip if priority hasn't changed
  if (oldPriority === priority) {
    return { issueId, oldPriority, newPriority: priority };
  }

  // Update priority
  await db
    .update(issues)
    .set({
      priority,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId));

  // Create timeline event
  const oldLabel = getIssuePriorityLabel(oldPriority as IssuePriority);
  const newLabel = getIssuePriorityLabel(priority);
  await createTimelineEvent(
    issueId,
    `Priority changed from ${oldLabel} to ${newLabel}`,
    db,
    userId
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

/**
 * Update issue frequency
 */
export async function updateIssueFrequency({
  issueId,
  frequency,
  userId,
}: UpdateIssueFrequencyParams): Promise<{
  issueId: string;
  oldFrequency: string;
  newFrequency: string;
}> {
  // Get current issue to check old frequency
  const currentIssue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { frequency: true, machineInitials: true },
  });

  if (!currentIssue) {
    throw new Error("Issue not found");
  }

  const oldFrequency = currentIssue.frequency;

  // No-op: skip if frequency hasn't changed
  if (oldFrequency === frequency) {
    return { issueId, oldFrequency, newFrequency: frequency };
  }

  // Update frequency
  await db
    .update(issues)
    .set({
      frequency,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId));

  // Create timeline event
  const oldLabel = getIssueFrequencyLabel(oldFrequency as IssueFrequency);
  const newLabel = getIssueFrequencyLabel(frequency);
  await createTimelineEvent(
    issueId,
    `Frequency changed from ${oldLabel} to ${newLabel}`,
    db,
    userId
  );

  log.info(
    {
      issueId,
      oldFrequency,
      newFrequency: frequency,
      action: "updateIssueFrequency",
    },
    "Issue frequency updated"
  );

  return { issueId, oldFrequency, newFrequency: frequency };
}

/**
 * Update a comment on an issue
 */
export async function updateIssueComment({
  commentId,
  content,
}: UpdateIssueCommentParams): Promise<IssueComment> {
  const [updatedComment] = await db
    .update(issueComments)
    .set({
      content,
      updatedAt: new Date(),
    })
    .where(eq(issueComments.id, commentId))
    .returning();

  if (!updatedComment) {
    throw new Error("Comment not found or update failed");
  }

  log.info({ commentId, action: "updateIssueComment" }, "Comment updated");

  return updatedComment;
}
