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
import {
  createTimelineEvent,
  type TimelineEventData,
} from "~/lib/timeline/events";
import {
  emitIssueOpened,
  emitIssueClosed,
  emitIssueStatusChanged,
  emitIssueAssigned,
  emitIssueUnassigned,
  emitIssueReassignedOut,
  emitIssueReassignedIn,
} from "~/lib/timeline/issue-timeline-helpers";
import { createNotification, getChannels } from "~/lib/notifications";
import { reportError } from "~/lib/observability/report-error";
import { log } from "~/lib/logger";
import { formatIssueId } from "~/lib/issues/utils";
import {
  type IssueSeverity,
  type IssuePriority,
  type IssueFrequency,
  type IssueStatus,
} from "~/lib/types";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import {
  type ProseMirrorDoc,
  extractMentions,
  docToPlainText,
} from "~/lib/tiptap/types";

// --- Types ---

export interface CreateIssueParams {
  title: string;
  description?: ProseMirrorDoc | null;
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
  content: ProseMirrorDoc;
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

export interface UpdateIssueTitleParams {
  issueId: string;
  title: string;
  userId: string;
}

export interface ReassignIssueMachineParams {
  issueId: string;
  newMachineInitials: string;
  userId: string;
}

export interface ReassignIssueMachineResult {
  issueId: string;
  fromInitials: string;
  fromIssueNumber: number;
  fromMachineName: string;
  toInitials: string;
  toIssueNumber: number;
  toMachineName: string;
}

export interface UpdateIssueCommentParams {
  commentId: string;
  content: ProseMirrorDoc;
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
  // Resolve channels outside the transaction to avoid an HTTP round-trip
  // (Supabase Vault RPC) inside the DB connection window (PP-rfc).
  const channels = await getChannels();
  return await db.transaction(async (tx) => {
    // 1. Lock machine row and get next number (Atomic increment)
    const [updatedMachine] = await tx
      .update(machines)
      .set({ nextIssueNumber: sql`${machines.nextIssueNumber} + 1` })
      .where(eq(machines.initials, machineInitials))
      .returning({
        id: machines.id,
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
      await createTimelineEvent(
        issue.id,
        { type: "assigned", assigneeName },
        tx,
        reportedBy ?? null
      );

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

    // 5. Duplicate-write `issue_opened` to machine timeline (PP-0x98)
    //
    // Email privacy (AGENTS.md rule 10): never persist reporter email here.
    // Prefer the resolved user_profiles.name when `reportedBy` is set; fall
    // back to the freeform `reporterName` (public report); finally "Anonymous".
    let openedByName = "Anonymous";
    if (reportedBy) {
      const reporter = await tx.query.userProfiles.findFirst({
        where: eq(userProfiles.id, reportedBy),
        columns: { name: true },
      });
      if (reporter) {
        openedByName = reporter.name;
      } else if (reporterName) {
        openedByName = reporterName;
      }
    } else if (reporterName) {
      openedByName = reporterName;
    }

    await emitIssueOpened(tx, {
      machineId: updatedMachine.id,
      issueId: issue.id,
      issueNumber: issue.issueNumber,
      openedByName,
      title,
      // Snapshot at-open severity + frequency for the timeline row. Use the
      // post-insert values from the returning() row so they reflect the
      // applied defaults (frequency falls back to "intermittent" when the
      // caller omits it).
      severity: issue.severity,
      frequency: issue.frequency,
      ...(reportedBy ? { actorId: reportedBy } : {}),
    });

    // 6. Notifications
    try {
      const formattedId = formatIssueId(machineInitials, issueNumber);
      const plainDescription = description
        ? docToPlainText(description)
        : undefined;
      // Trigger Notification (actorId optional for public reports)
      await createNotification(
        {
          type: "new_issue",
          resourceId: issue.id,
          resourceType: "issue",
          ...(reportedBy ? { actorId: reportedBy } : {}),
          issueTitle: title,
          machineName: updatedMachine.name,
          formattedIssueId: formattedId,
          issueDescription: plainDescription,
        },
        tx,
        channels
      );

      // Extract and notify mentions — batch all mentioned users into one call
      // to avoid O(N) round-trips inside the transaction.
      if (description) {
        const mentions = extractMentions(description);
        if (mentions.length > 0) {
          const commentContent = plainDescription;
          await createNotification(
            {
              type: "mentioned",
              resourceId: issue.id,
              resourceType: "issue",
              actorId: reportedBy ?? undefined,
              includeActor: false,
              additionalRecipientIds: mentions,
              issueTitle: title,
              machineName: updatedMachine.name,
              formattedIssueId: formattedId,
              commentContent,
            },
            tx,
            channels
          );
        }
      }
    } catch (error) {
      reportError(error, {
        action: "createIssueNotifications",
        bestEffort: true,
        issueId: issue.id,
      });
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
  // Pre-transaction no-op check: avoid the cost of resolving channels (HTTP
  // round-trip via getDiscordConfig() Vault decrypt) AND opening a write
  // transaction when the status is unchanged (PP-rfc, Copilot follow-up).
  const preCheckIssue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { status: true },
  });

  if (!preCheckIssue) {
    throw new Error("Issue not found");
  }

  if (preCheckIssue.status === status) {
    return { issueId, oldStatus: preCheckIssue.status, newStatus: status };
  }

  // Resolve channels outside the transaction to avoid an HTTP round-trip
  // (Supabase Vault RPC) inside the DB connection window (PP-rfc).
  const channels = await getChannels();
  return await db.transaction(async (tx) => {
    // Re-read inside the transaction so that subsequent mutations and the
    // notification payload reflect the row's current state under the
    // transaction's snapshot (and handle the unlikely race where it was
    // deleted between the pre-check and the transaction).
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

    // Re-check inside the transaction in case of a race with another writer.
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
    await createTimelineEvent(
      issueId,
      { type: "status_changed", from: oldStatus, to: status },
      tx,
      userId
    );

    // 2b. Duplicate-write to machine timeline (atomic with status update, PP-0x98)
    //
    // Email privacy (AGENTS.md rule 10): closedByName resolves from
    // user_profiles.name, never from email. Falls back to "Unknown User" if
    // the profile row is missing (shouldn't happen given FK from authUsers).
    if (isClosed) {
      const actor = await tx.query.userProfiles.findFirst({
        where: eq(userProfiles.id, userId),
        columns: { name: true },
      });
      const closedByName = actor?.name ?? "Unknown User";
      await emitIssueClosed(tx, {
        machineId: currentIssue.machine.id,
        issueId,
        issueNumber: currentIssue.issueNumber,
        closedByName,
        title: currentIssue.title,
        // The "close reason" — which closed-group status the issue was
        // resolved to (fixed / wont_fix / wai / no_repro / duplicate).
        closedAsStatus: status,
        ...(userId ? { actorId: userId } : {}),
      });
    } else {
      await emitIssueStatusChanged(tx, {
        machineId: currentIssue.machine.id,
        issueId,
        issueNumber: currentIssue.issueNumber,
        from: oldStatus,
        to: status,
        title: currentIssue.title,
        ...(userId ? { actorId: userId } : {}),
      });
    }

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
        tx,
        channels
      );
    } catch (error) {
      reportError(error, {
        action: "updateIssueStatusNotifications",
        bestEffort: true,
        issueId,
      });
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
  // Resolve channels outside the transaction to avoid an HTTP round-trip
  // (Supabase Vault RPC) inside the DB connection window (PP-rfc).
  const channels = await getChannels();
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

      const formattedId = issue
        ? formatIssueId(issue.machineInitials, issue.issueNumber)
        : undefined;
      const plainTextContent = docToPlainText(content);

      await createNotification(
        {
          type: "new_comment",
          resourceId: issueId,
          resourceType: "issue",
          actorId: userId,
          issueTitle: issue?.title ?? undefined,
          machineName: issue?.machine.name ?? undefined,
          formattedIssueId: formattedId,
          commentContent: plainTextContent,
        },
        tx,
        channels
      );

      // Extract and notify mentions — batch all mentioned users into one call
      // to avoid O(N) round-trips inside the transaction.
      const mentions = extractMentions(content);
      if (mentions.length > 0) {
        await createNotification(
          {
            type: "mentioned",
            resourceId: issueId,
            resourceType: "issue",
            actorId: userId,
            includeActor: false,
            additionalRecipientIds: mentions,
            issueTitle: issue?.title ?? undefined,
            machineName: issue?.machine.name ?? undefined,
            formattedIssueId: formattedId,
            commentContent: plainTextContent,
          },
          tx,
          channels
        );
      }
    } catch (error) {
      reportError(error, {
        action: "addIssueCommentNotifications",
        bestEffort: true,
        issueId,
        commentId: comment.id,
      });
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
  // Pre-transaction no-op check: avoid the cost of resolving channels (HTTP
  // round-trip via getDiscordConfig() Vault decrypt) AND opening a write
  // transaction when the assignment is unchanged (PP-rfc, Copilot follow-up).
  const preCheckIssue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { assignedTo: true },
  });

  if (!preCheckIssue) {
    throw new Error("Issue not found");
  }

  if (preCheckIssue.assignedTo === assignedTo) {
    return;
  }

  // Only resolve channels when a notification will actually fire (a
  // notification is only sent when assignedTo is non-null below).
  const channels = assignedTo ? await getChannels() : undefined;
  await db.transaction(async (tx) => {
    // Re-read inside the transaction so that subsequent mutations and the
    // notification payload reflect the row's current state under the
    // transaction's snapshot (and handle the unlikely race where it was
    // deleted between the pre-check and the transaction).
    const currentIssue = await tx.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: {
        machineInitials: true,
        issueNumber: true,
        title: true,
        description: true,
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

    // Re-check inside the transaction in case of a race with another writer.
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
    const event: TimelineEventData = assignedTo
      ? { type: "assigned", assigneeName }
      : { type: "unassigned" };
    await createTimelineEvent(issueId, event, tx, actorId);

    // Duplicate-write to machine timeline (atomic with assignment update, PP-0x98)
    //
    // `assigneeName` was already resolved above (lines 639-646) from
    // `user_profiles.name` — never from email (AGENTS.md rule 10).
    if (assignedTo) {
      await emitIssueAssigned(tx, {
        machineId: currentIssue.machine.id,
        issueId,
        issueNumber: currentIssue.issueNumber,
        assigneeName,
        title: currentIssue.title,
        ...(actorId ? { actorId } : {}),
      });
    } else {
      await emitIssueUnassigned(tx, {
        machineId: currentIssue.machine.id,
        issueId,
        issueNumber: currentIssue.issueNumber,
        title: currentIssue.title,
        ...(actorId ? { actorId } : {}),
      });
    }

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
            issueDescription: currentIssue.description
              ? docToPlainText(currentIssue.description)
              : undefined,
            formattedIssueId: formatIssueId(
              currentIssue.machineInitials,
              currentIssue.issueNumber
            ),
          },
          tx,
          channels
        );
      }
    } catch (error) {
      reportError(error, {
        action: "assignIssueNotifications",
        bestEffort: true,
        issueId,
      });
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
  await createTimelineEvent(
    issueId,
    { type: "severity_changed", from: oldSeverity, to: severity },
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
  await createTimelineEvent(
    issueId,
    { type: "priority_changed", from: oldPriority, to: priority },
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
  await createTimelineEvent(
    issueId,
    { type: "frequency_changed", from: oldFrequency, to: frequency },
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
 * Update issue title
 */
export async function updateIssueTitle({
  issueId,
  title,
  userId,
}: UpdateIssueTitleParams): Promise<{
  issueId: string;
  oldTitle: string;
  newTitle: string;
}> {
  return await db.transaction(async (tx) => {
    const currentIssue = await tx.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { title: true },
    });

    if (!currentIssue) {
      throw new Error("Issue not found");
    }

    const oldTitle = currentIssue.title;

    if (oldTitle === title) {
      return { issueId, oldTitle, newTitle: title };
    }

    await tx
      .update(issues)
      .set({ title, updatedAt: new Date() })
      .where(eq(issues.id, issueId));

    await createTimelineEvent(
      issueId,
      { type: "title_changed", from: oldTitle, to: title },
      tx,
      userId
    );

    log.info(
      { issueId, oldTitle, newTitle: title, action: "updateIssueTitle" },
      "Issue title updated"
    );

    return { issueId, oldTitle, newTitle: title };
  });
}

/**
 * Reassign an issue to a different machine.
 *
 * Atomically updates `machineInitials` and reserves a fresh `issueNumber` on the
 * destination machine using the same counter pattern as `createIssue`. The old
 * issue number on the source machine is left as a permanent gap (the source's
 * `nextIssueNumber` does NOT decrement) — this is the only safe behavior given
 * the unique constraint on `(machineInitials, issueNumber)` and any external
 * references (URLs, notification deeplinks, comment cross-references) to the
 * old number.
 *
 * Throws if the destination machine does not exist or matches the current
 * machine (no-op).
 */
export async function reassignIssueMachine({
  issueId,
  newMachineInitials,
  userId,
}: ReassignIssueMachineParams): Promise<ReassignIssueMachineResult> {
  return await db.transaction(async (tx) => {
    const currentIssue = await tx.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: {
        machineInitials: true,
        issueNumber: true,
        title: true,
      },
      with: {
        machine: { columns: { id: true, name: true } },
      },
    });

    if (!currentIssue) {
      throw new Error("Issue not found");
    }

    if (currentIssue.machineInitials === newMachineInitials) {
      throw new Error("Issue is already on that machine");
    }

    // Atomically reserve a number on the destination using the same UPDATE …
    // RETURNING pattern as createIssue (services/issues.ts above). The
    // RETURNING clause both reserves the slot and verifies the machine exists.
    const [destinationMachine] = await tx
      .update(machines)
      .set({ nextIssueNumber: sql`${machines.nextIssueNumber} + 1` })
      .where(eq(machines.initials, newMachineInitials))
      .returning({
        id: machines.id,
        nextIssueNumber: machines.nextIssueNumber,
        name: machines.name,
      });

    if (!destinationMachine) {
      throw new Error(`Machine not found: ${newMachineInitials}`);
    }

    const newIssueNumber = destinationMachine.nextIssueNumber - 1;
    const fromInitials = currentIssue.machineInitials;
    const fromIssueNumber = currentIssue.issueNumber;
    const fromMachineName = currentIssue.machine.name;

    await tx
      .update(issues)
      .set({
        machineInitials: newMachineInitials,
        issueNumber: newIssueNumber,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId));

    await createTimelineEvent(
      issueId,
      {
        type: "machine_reassigned",
        fromInitials,
        fromIssueNumber,
        fromMachineName,
        toInitials: newMachineInitials,
        toIssueNumber: newIssueNumber,
        toMachineName: destinationMachine.name,
      },
      tx,
      userId
    );

    // Dual-write: source machine timeline gets "reassigned_out", destination
    // gets "reassigned_in". Both rows are atomic with the issue update (same
    // transaction → same created_at via Postgres now()).
    await emitIssueReassignedOut(tx, {
      machineId: currentIssue.machine.id,
      issueId,
      issueNumber: fromIssueNumber, // OLD number, as it existed on source
      toMachineId: destinationMachine.id,
      toMachineName: destinationMachine.name,
      title: currentIssue.title,
      ...(userId ? { actorId: userId } : {}),
    });

    await emitIssueReassignedIn(tx, {
      machineId: destinationMachine.id,
      issueId,
      issueNumber: newIssueNumber, // NEW number, as it now exists on destination
      fromMachineId: currentIssue.machine.id,
      fromMachineName: currentIssue.machine.name,
      title: currentIssue.title,
      ...(userId ? { actorId: userId } : {}),
    });

    log.info(
      {
        issueId,
        fromInitials,
        fromIssueNumber,
        toInitials: newMachineInitials,
        toIssueNumber: newIssueNumber,
        action: "reassignIssueMachine",
      },
      "Issue reassigned to a different machine"
    );

    return {
      issueId,
      fromInitials,
      fromIssueNumber,
      fromMachineName,
      toInitials: newMachineInitials,
      toIssueNumber: newIssueNumber,
      toMachineName: destinationMachine.name,
    };
  });
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
