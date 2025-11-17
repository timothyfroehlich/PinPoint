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
import { issues, userProfiles } from "~/server/db/schema";
import {
  createIssueSchema,
  updateIssueStatusSchema,
  updateIssueSeveritySchema,
  assignIssueSchema,
} from "./schemas";
import { setFlash } from "~/lib/flash";
import {
  createTimelineEvent,
  formatStatusChange,
  formatSeverityChange,
  formatAssignment,
  formatUnassignment,
} from "~/lib/timeline/events";

/**
 * Create Issue Action
 *
 * Creates a new issue for a machine with validation.
 * Requires authentication (CORE-SEC-001).
 * Validates input with Zod (CORE-SEC-002).
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

  // Extract form data
  const rawData = {
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    machineId: formData.get("machineId"),
    severity: formData.get("severity"),
  };

  // Validate input (CORE-SEC-002)
  const validation = createIssueSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    await setFlash({
      type: "error",
      message: firstError?.message ?? "Invalid input",
    });
    redirect("/issues/new");
  }

  const { title, description, machineId, severity } = validation.data;

  // Insert issue (direct Drizzle query - no DAL)
  try {
    const [issue] = await db
      .insert(issues)
      .values({
        title,
        description,
        machineId,
        severity,
        reportedBy: user.id,
        status: "new", // Default status
      })
      .returning();

    if (!issue) throw new Error("Issue creation failed");

    // Set success flash message and revalidate
    await setFlash({
      type: "success",
      message: `Issue "${title}" created successfully`,
    });
    revalidatePath("/issues");
    revalidatePath(`/machines/${machineId}`);

    // Redirect to issue detail page
    redirect(`/issues/${issue.id}`);
  } catch {
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
 * Updates an issue's status and creates a timeline event.
 * Requires authentication (CORE-SEC-001).
 *
 * @param issueId - The issue ID to update
 * @param newStatus - The new status value
 */
export async function updateIssueStatusAction(
  issueId: string,
  newStatus: "new" | "in_progress" | "resolved"
): Promise<void> {
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

  // Validate input
  const validation = updateIssueStatusSchema.safeParse({
    issueId,
    status: newStatus,
  });

  if (!validation.success) {
    await setFlash({
      type: "error",
      message: "Invalid status update",
    });
    redirect(`/issues/${issueId}`);
  }

  try {
    // Get current issue to compare old status
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
    });

    if (!currentIssue) {
      await setFlash({
        type: "error",
        message: "Issue not found",
      });
      redirect("/issues");
    }

    const oldStatus = currentIssue.status;

    // Update status
    await db
      .update(issues)
      .set({
        status: newStatus,
        resolvedAt: newStatus === "resolved" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId));

    // Create timeline event
    const eventMessage = formatStatusChange(oldStatus, newStatus);
    await createTimelineEvent(issueId, eventMessage);

    // Revalidate paths
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    await setFlash({
      type: "success",
      message: "Issue status updated successfully",
    });
  } catch {
    await setFlash({
      type: "error",
      message: "Failed to update issue status",
    });
  }

  redirect(`/issues/${issueId}`);
}

/**
 * Update Issue Severity Action
 *
 * Updates an issue's severity and creates a timeline event.
 * Requires authentication (CORE-SEC-001).
 *
 * @param issueId - The issue ID to update
 * @param newSeverity - The new severity value
 */
export async function updateIssueSeverityAction(
  issueId: string,
  newSeverity: "minor" | "playable" | "unplayable"
): Promise<void> {
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

  // Validate input
  const validation = updateIssueSeveritySchema.safeParse({
    issueId,
    severity: newSeverity,
  });

  if (!validation.success) {
    await setFlash({
      type: "error",
      message: "Invalid severity update",
    });
    redirect(`/issues/${issueId}`);
  }

  try {
    // Get current issue to compare old severity
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
    });

    if (!currentIssue) {
      await setFlash({
        type: "error",
        message: "Issue not found",
      });
      redirect("/issues");
    }

    const oldSeverity = currentIssue.severity;

    // Update severity
    await db
      .update(issues)
      .set({
        severity: newSeverity,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId));

    // Create timeline event
    const eventMessage = formatSeverityChange(oldSeverity, newSeverity);
    await createTimelineEvent(issueId, eventMessage);

    // Revalidate paths
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    await setFlash({
      type: "success",
      message: "Issue severity updated successfully",
    });
  } catch {
    await setFlash({
      type: "error",
      message: "Failed to update issue severity",
    });
  }

  redirect(`/issues/${issueId}`);
}

/**
 * Assign Issue Action
 *
 * Assigns an issue to a user (or unassigns if null) and creates a timeline event.
 * Requires authentication (CORE-SEC-001).
 *
 * @param issueId - The issue ID to update
 * @param assigneeId - The user ID to assign (or null to unassign)
 */
export async function assignIssueAction(
  issueId: string,
  assigneeId: string | null
): Promise<void> {
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

  // Validate input
  const validation = assignIssueSchema.safeParse({
    issueId,
    assigneeId,
  });

  if (!validation.success) {
    await setFlash({
      type: "error",
      message: "Invalid assignment",
    });
    redirect(`/issues/${issueId}`);
  }

  try {
    // Get current issue
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
    });

    if (!currentIssue) {
      await setFlash({
        type: "error",
        message: "Issue not found",
      });
      redirect("/issues");
    }

    // Update assignment
    await db
      .update(issues)
      .set({
        assignedTo: assigneeId,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId));

    // Create timeline event
    if (assigneeId) {
      // Get assignee name for timeline event
      const assignee = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, assigneeId),
      });

      const eventMessage = formatAssignment(assignee?.name ?? "Unknown User");
      await createTimelineEvent(issueId, eventMessage);
    } else {
      // Unassigned
      const eventMessage = formatUnassignment();
      await createTimelineEvent(issueId, eventMessage);
    }

    // Revalidate paths
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath(`/machines/${currentIssue.machineId}`);

    await setFlash({
      type: "success",
      message: assigneeId
        ? "Issue assigned successfully"
        : "Issue unassigned successfully",
    });
  } catch {
    await setFlash({
      type: "error",
      message: "Failed to update assignment",
    });
  }

  redirect(`/issues/${issueId}`);
}
