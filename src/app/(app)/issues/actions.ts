/**
 * Issue Server Actions
 *
 * Server-side mutations for issue CRUD operations.
 * All actions require authentication (CORE-SEC-001).
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, issueWatchers, userProfiles } from "~/server/db/schema";
import { log } from "~/lib/logger";
import {
  createIssueSchema,
  updateIssueStatusSchema,
  updateIssueSeveritySchema,
  updateIssuePrioritySchema,
  assignIssueSchema,
  addCommentSchema,
} from "./schemas";
import { type Result, ok, err } from "~/lib/result";
import {
  createIssue,
  updateIssueStatus,
  addIssueComment,
} from "~/services/issues";
import { createNotification } from "~/lib/notifications";
import { createTimelineEvent } from "~/lib/timeline/events";

const NEXT_REDIRECT_DIGEST_PREFIX = "NEXT_REDIRECT;";

const toOptionalString = (value: FormDataEntryValue | null): string | null =>
  typeof value === "string" ? value : null;

const isNextRedirectError = (error: unknown): error is { digest: string } => {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const { digest } = error as { digest?: unknown };
  return (
    typeof digest === "string" && digest.startsWith(NEXT_REDIRECT_DIGEST_PREFIX)
  );
};

export type CreateIssueResult = Result<
  { issueId: string },
  "VALIDATION" | "UNAUTHORIZED" | "SERVER"
>;

export type UpdateIssueStatusResult = Result<
  { issueId: string },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

export type UpdateIssueSeverityResult = Result<
  { issueId: string },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

export type UpdateIssuePriorityResult = Result<
  { issueId: string },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

export type AssignIssueResult = Result<
  { issueId: string },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

export type AddCommentResult = Result<
  { issueId: string },
  "VALIDATION" | "UNAUTHORIZED" | "SERVER"
>;

/**
 * Create Issue Action
 *
 * Creates a new issue with validation and timeline event.
 * Requires authentication (CORE-SEC-001).
 * Validates input with Zod (CORE-SEC-002).
 * Enforces machine requirement (CORE-ARCH-004).
 *
 * @param formData - Form data from issue creation form
 */
export async function createIssueAction(
  _prevState: CreateIssueResult | undefined,
  formData: FormData
): Promise<CreateIssueResult> {
  // Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized. Please log in.");
  }

  // Extract and validate form data (CORE-SEC-002)
  const rawData = {
    title: toOptionalString(formData.get("title")),
    description: toOptionalString(formData.get("description")),
    machineId: toOptionalString(formData.get("machineId")),
    severity: toOptionalString(formData.get("severity")),
    priority: toOptionalString(formData.get("priority")),
  };

  const validation = createIssueSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    log.warn(
      {
        errors: validation.error.issues,
        action: "createIssue",
        rawMachineId: rawData.machineId,
      },
      "Issue creation validation failed"
    );
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { title, description, machineId, severity, priority } = validation.data;

  // Create issue via service
  try {
    const issue = await createIssue({
      title,
      description: description ?? null,
      machineId,
      severity,
      priority,
      reportedBy: user.id,
    });

    revalidatePath("/issues");
    revalidatePath(`/machines/${machineId}`);

    redirect(`/issues/${issue.id}`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
        action: "createIssue",
      },
      "Issue creation server error"
    );
    return err("SERVER", "Failed to create issue. Please try again.");
  }
}

/**
 * Update Issue Status Action
 *
 * Updates issue status and creates timeline event.
 *
 * @param formData - Form data with issueId and status
 */
export async function updateIssueStatusAction(
  _prevState: UpdateIssueStatusResult | undefined,
  formData: FormData
): Promise<UpdateIssueStatusResult> {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  // Validate input
  const rawData = {
    issueId: toOptionalString(formData.get("issueId")),
    status: toOptionalString(formData.get("status")),
  };

  const validation = updateIssueStatusSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { issueId, status } = validation.data;

  try {
    // Get current issue to check old status
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { status: true, machineId: true },
    });

    if (!currentIssue) {
      return err("NOT_FOUND", "Issue not found");
    }

    // Update status
    await updateIssueStatus({
      issueId,
      status,
      userId: user.id,
    });

    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    return ok({ issueId });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "updateIssueStatus",
      },
      "Update issue status error"
    );
    return err("SERVER", "Failed to update status");
  }
}

/**
 * Update Issue Severity Action
 *
 * Updates issue severity and creates timeline event.
 *
 * @param formData - Form data with issueId and severity
 */
export async function updateIssueSeverityAction(
  _prevState: UpdateIssueSeverityResult | undefined,
  formData: FormData
): Promise<UpdateIssueSeverityResult> {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  // Validate input
  const rawData = {
    issueId: toOptionalString(formData.get("issueId")),
    severity: toOptionalString(formData.get("severity")),
  };

  const validation = updateIssueSeveritySchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { issueId, severity } = validation.data;

  try {
    // Get current issue to check old severity
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { severity: true, machineId: true },
    });

    if (!currentIssue) {
      return err("NOT_FOUND", "Issue not found");
    }

    const oldSeverity = currentIssue.severity;

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

    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    return ok({ issueId });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "updateIssueSeverity",
      },
      "Update issue severity error"
    );
    return err("SERVER", "Failed to update severity");
  }
}

/**
 * Update Issue Priority Action
 *
 * Updates issue priority and creates timeline event.
 *
 * @param _prevState - Previous action state (unused, required for useActionState)
 * @param formData - Form data with issueId and priority
 */
export async function updateIssuePriorityAction(
  _prevState: UpdateIssuePriorityResult | undefined,
  formData: FormData
): Promise<UpdateIssuePriorityResult> {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  // Validate input
  const rawData = {
    issueId: toOptionalString(formData.get("issueId")),
    priority: toOptionalString(formData.get("priority")),
  };

  const validation = updateIssuePrioritySchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { issueId, priority } = validation.data;

  try {
    // Get current issue to check old priority
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { priority: true, machineId: true },
    });

    if (!currentIssue) {
      return err("NOT_FOUND", "Issue not found");
    }

    const oldPriority = currentIssue.priority;

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

    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    return ok({ issueId });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "updateIssuePriority",
      },
      "Update issue priority error"
    );
    return err("SERVER", "Failed to update priority");
  }
}

/**
 * Assign Issue Action
 *
 * Assigns issue to a user and creates timeline event.
 *
 * @param formData - Form data with issueId and assignedTo
 */
export async function assignIssueAction(
  _prevState: AssignIssueResult | undefined,
  formData: FormData
): Promise<AssignIssueResult> {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  // Validate input
  const assignedToValue = toOptionalString(formData.get("assignedTo"));
  const rawData = {
    issueId: toOptionalString(formData.get("issueId")),
    assignedTo:
      assignedToValue && assignedToValue.length > 0 ? assignedToValue : null,
  };

  const validation = assignIssueSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { issueId, assignedTo } = validation.data;

  try {
    // Get current issue
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { machineId: true },
      with: {
        assignedToUser: {
          columns: { name: true },
        },
      },
    });

    if (!currentIssue) {
      return err("NOT_FOUND", "Issue not found");
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

    // Trigger Notification & Add Watcher
    try {
      const issue = await db.query.issues.findFirst({
        where: eq(issues.id, issueId),
        with: { machine: true },
      });

      if (assignedTo) {
        // Add assignee as watcher
        await db
          .insert(issueWatchers)
          .values({
            issueId,
            userId: assignedTo,
          })
          .onConflictDoNothing();

        // Notify
        await createNotification({
          type: "issue_assigned",
          resourceId: issueId,
          resourceType: "issue",
          actorId: user.id,
          issueTitle: issue?.title ?? undefined,
          machineName: issue?.machine.name ?? undefined,
        });
      }
    } catch (error) {
      log.error(
        { error, action: "assignIssue.notifications" },
        "Failed to process notifications"
      );
    }

    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    return ok({ issueId });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "assignIssue",
      },
      "Assign issue error"
    );
    return err("SERVER", "Failed to assign issue");
  }
}

/**
 * Adds a comment to an issue.
 */
export async function addCommentAction(
  _prevState: AddCommentResult | undefined,
  formData: FormData
): Promise<AddCommentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  const validation = addCommentSchema.safeParse({
    issueId: toOptionalString(formData.get("issueId")),
    comment: toOptionalString(formData.get("comment")),
  });

  if (!validation.success) {
    return err(
      "VALIDATION",
      validation.error.issues[0]?.message ?? "Invalid input"
    );
  }

  const { issueId, comment } = validation.data;

  try {
    await addIssueComment({
      issueId,
      content: comment,
      userId: user.id,
    });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "addComment",
      },
      "Failed to add issue comment"
    );
    return err("SERVER", "Failed to add comment");
  }

  revalidatePath(`/issues/${issueId}`);
  return ok({ issueId });
}
