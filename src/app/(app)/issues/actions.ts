/**
 * Issue Server Actions
 *
 * Server-side mutations for issue CRUD operations.
 * All actions require authentication (CORE-SEC-001).
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, userProfiles, issueComments } from "~/server/db/schema";
import { setFlash } from "~/lib/flash";
import { createTimelineEvent } from "~/lib/timeline/events";
import { log } from "~/lib/logger";
import {
  createIssueSchema,
  updateIssueStatusSchema,
  updateIssueSeveritySchema,
  updateIssuePrioritySchema,
  assignIssueSchema,
  addCommentSchema,
} from "./schemas";

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
export async function createIssueAction(formData: FormData): Promise<void> {
  // Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({
      type: "error",
      message: "Unauthorized. Please log in.",
    });
    redirect("/login");
  }

  // Extract and validate form data (CORE-SEC-002)
  const rawData = {
    title: toOptionalString(formData.get("title")),
    description: toOptionalString(formData.get("description")),
    machineId: toOptionalString(formData.get("machineId")),
    severity: toOptionalString(formData.get("severity")),
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
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    redirect("/issues/new");
  }

  const { title, description, machineId, severity } = validation.data;

  // Create issue (direct Drizzle query - no DAL)
  try {
    const [issue] = await db
      .insert(issues)
      .values({
        title,
        description: description ?? null,
        machineId,
        severity,
        reportedBy: user.id,
        status: "new",
      })
      .returning();

    if (!issue) throw new Error("Issue creation failed");

    // Create timeline event for issue creation
    await createTimelineEvent(issue.id, "Issue created");

    log.info(
      {
        issueId: issue.id,
        machineId,
        reportedBy: user.id,
        action: "createIssue",
      },
      "Issue created successfully"
    );

    await setFlash({
      type: "success",
      message: `Issue "${title}" created successfully`,
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
    await setFlash({
      type: "error",
      message: "Failed to create issue. Please try again.",
    });
    redirect("/issues/new");
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
  formData: FormData
): Promise<void> {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({ type: "error", message: "Unauthorized" });
    redirect("/login");
  }

  // Validate input
  const rawData = {
    issueId: toOptionalString(formData.get("issueId")),
    status: toOptionalString(formData.get("status")),
  };

  const validation = updateIssueStatusSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    redirect("/issues");
  }

  const { issueId, status } = validation.data;

  try {
    // Get current issue to check old status
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { status: true, machineId: true },
    });

    if (!currentIssue) {
      await setFlash({ type: "error", message: "Issue not found" });
      redirect("/issues");
    }

    const oldStatus = currentIssue.status;

    // Update status
    await db
      .update(issues)
      .set({
        status,
        updatedAt: new Date(),
        // Set resolvedAt if status is resolved
        ...(status === "resolved" && { resolvedAt: new Date() }),
      })
      .where(eq(issues.id, issueId));

    // Create timeline event
    await createTimelineEvent(
      issueId,
      `Status changed from ${oldStatus} to ${status}`
    );

    log.info(
      { issueId, oldStatus, newStatus: status, action: "updateIssueStatus" },
      "Issue status updated"
    );

    await setFlash({
      type: "success",
      message: "Issue status updated",
    });
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    redirect(`/issues/${issueId}`);
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
    await setFlash({
      type: "error",
      message: "Failed to update status",
    });
    redirect(`/issues/${issueId}`);
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
  formData: FormData
): Promise<void> {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({ type: "error", message: "Unauthorized" });
    redirect("/login");
  }

  // Validate input
  const rawData = {
    issueId: toOptionalString(formData.get("issueId")),
    severity: toOptionalString(formData.get("severity")),
  };

  const validation = updateIssueSeveritySchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    redirect("/issues");
  }

  const { issueId, severity } = validation.data;

  try {
    // Get current issue to check old severity
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { severity: true, machineId: true },
    });

    if (!currentIssue) {
      await setFlash({ type: "error", message: "Issue not found" });
      redirect("/issues");
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

    await setFlash({
      type: "success",
      message: "Issue severity updated",
    });
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    redirect(`/issues/${issueId}`);
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
    await setFlash({
      type: "error",
      message: "Failed to update severity",
    });
    redirect(`/issues/${issueId}`);
  }
}

/**
 * Update Issue Priority Action
 *
 * Updates issue priority and creates timeline event.
 *
 * @param formData - Form data with issueId and priority
 */
export async function updateIssuePriorityAction(
  formData: FormData
): Promise<void> {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({ type: "error", message: "Unauthorized" });
    redirect("/login");
  }

  // Validate input
  const rawData = {
    issueId: toOptionalString(formData.get("issueId")),
    priority: toOptionalString(formData.get("priority")),
  };

  const validation = updateIssuePrioritySchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    redirect("/issues");
  }

  const { issueId, priority } = validation.data;

  try {
    // Get current issue to check old priority
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { priority: true, machineId: true },
    });

    if (!currentIssue) {
      await setFlash({ type: "error", message: "Issue not found" });
      redirect("/issues");
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

    await setFlash({
      type: "success",
      message: "Issue priority updated",
    });
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    redirect(`/issues/${issueId}`);
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
    await setFlash({
      type: "error",
      message: "Failed to update priority",
    });
    redirect(`/issues/${issueId}`);
  }
}

/**
 * Assign Issue Action
 *
 * Assigns issue to a user and creates timeline event.
 *
 * @param formData - Form data with issueId and assignedTo
 */
export async function assignIssueAction(formData: FormData): Promise<void> {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({ type: "error", message: "Unauthorized" });
    redirect("/login");
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
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    redirect("/issues");
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
      await setFlash({ type: "error", message: "Issue not found" });
      redirect("/issues");
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

    await setFlash({
      type: "success",
      message: assignedTo ? `Assigned to ${assigneeName}` : "Issue unassigned",
    });
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    redirect(`/issues/${issueId}`);
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
    await setFlash({
      type: "error",
      message: "Failed to assign issue",
    });
    redirect(`/issues/${issueId}`);
  }
}

/**
 * Adds a comment to an issue.
 */
export async function addCommentAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash({ type: "error", message: "Unauthorized" });
    redirect("/login");
  }

  const validation = addCommentSchema.safeParse({
    issueId: toOptionalString(formData.get("issueId")),
    comment: toOptionalString(formData.get("comment")),
  });

  if (!validation.success) {
    const issueId = toOptionalString(formData.get("issueId")) ?? "";
    await setFlash({
      type: "error",
      message: validation.error.issues[0]?.message ?? "Invalid input",
    });
    redirect(`/issues/${issueId}`);
  }

  const { issueId, comment } = validation.data;

  try {
    await db.insert(issueComments).values({
      issueId,
      authorId: user.id,
      content: comment,
      isSystem: false,
    });
    await setFlash({ type: "success", message: "Comment added" });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "addComment",
      },
      "Failed to add issue comment"
    );
    await setFlash({ type: "error", message: "Failed to add comment" });
  }

  revalidatePath(`/issues/${issueId}`);
  redirect(`/issues/${issueId}`);
}
