/**
 * Issue Server Actions
 *
 * Server-side mutations for issue CRUD operations.
 * All actions require authentication (CORE-SEC-001).
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type z } from "zod";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { log } from "~/lib/logger";
import {
  createIssueSchema,
  updateIssueStatusSchema,
  updateIssueSeveritySchema,
  updateIssuePrioritySchema,
  updateIssueFrequencySchema,
  assignIssueSchema,
  addCommentSchema,
  editCommentSchema,
  deleteCommentSchema,
  imagesMetadataArraySchema,
} from "./schemas";
import { type Result, ok, err } from "~/lib/result";
import {
  createIssue,
  updateIssueStatus,
  addIssueComment,
  assignIssue,
  updateIssueSeverity,
  updateIssuePriority,
  updateIssueFrequency,
  updateIssueComment,
  deleteIssueComment,
} from "~/services/issues";
import { canUpdateIssue } from "~/lib/permissions";
import { userProfiles, issueComments } from "~/server/db/schema";

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

export type UpdateIssueFrequencyResult = Result<
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

export type EditCommentResult = Result<
  { commentId: string },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

export type DeleteCommentResult = Result<
  { commentId: string },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
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
    machineInitials: toOptionalString(formData.get("machineInitials")),
    severity: toOptionalString(formData.get("severity")),
    priority: toOptionalString(formData.get("priority")),
    frequency: toOptionalString(formData.get("frequency")),
  };

  const validation = createIssueSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    log.warn(
      {
        errors: validation.error.issues,
        action: "createIssue",
        rawMachineInitials: rawData.machineInitials,
      },
      "Issue creation validation failed"
    );
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { title, description, machineInitials, severity, priority, frequency } =
    validation.data;

  // Create issue via service
  try {
    const issue = await createIssue({
      title,
      description: description ?? null,
      machineInitials,
      severity,
      priority,
      frequency,
      reportedBy: user.id,
    });

    // Revalidate machine issues list
    // Note: URL changed to /m/[initials]
    revalidatePath(`/m/${machineInitials}`);
    revalidatePath(`/m/${machineInitials}/i`);

    // Redirect to new issue page
    redirect(`/m/${machineInitials}/i/${issue.issueNumber}`);
  } catch (error: unknown) {
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
      columns: {
        status: true,
        machineInitials: true,
        issueNumber: true,
        reportedBy: true,
        assignedTo: true,
      },
      with: {
        machine: {
          columns: { ownerId: true },
        },
      },
    });

    if (!currentIssue) {
      return err("NOT_FOUND", "Issue not found");
    }

    // Permission check
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });

    if (
      !canUpdateIssue(
        { id: user.id, role: userProfile?.role ?? "guest" },
        currentIssue,
        currentIssue.machine
      )
    ) {
      return err(
        "UNAUTHORIZED",
        "You do not have permission to update this issue"
      );
    }

    // Update status
    await updateIssueStatus({
      issueId,
      status,
      userId: user.id,
    });

    const issuePath = `/m/${currentIssue.machineInitials}/i/${currentIssue.issueNumber}`;
    revalidatePath(issuePath);
    revalidatePath(`/m/${currentIssue.machineInitials}`);

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
      columns: {
        severity: true,
        machineInitials: true,
        issueNumber: true,
        reportedBy: true,
        assignedTo: true,
      },
      with: {
        machine: {
          columns: { ownerId: true },
        },
      },
    });

    if (!currentIssue) {
      return err("NOT_FOUND", "Issue not found");
    }

    // Permission check
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });

    if (
      !canUpdateIssue(
        { id: user.id, role: userProfile?.role ?? "guest" },
        currentIssue,
        currentIssue.machine
      )
    ) {
      return err(
        "UNAUTHORIZED",
        "You do not have permission to update this issue"
      );
    }

    // Update severity
    await updateIssueSeverity({
      issueId,
      severity,
    });

    const issuePath = `/m/${currentIssue.machineInitials}/i/${currentIssue.issueNumber}`;
    revalidatePath(issuePath);
    revalidatePath(`/m/${currentIssue.machineInitials}`);

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
 * Update Issue Frequency Action
 */
export async function updateIssueFrequencyAction(
  _prevState: UpdateIssueFrequencyResult | undefined,
  formData: FormData
): Promise<UpdateIssueFrequencyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Unauthorized");

  const rawData = {
    issueId: toOptionalString(formData.get("issueId")),
    frequency: toOptionalString(formData.get("frequency")),
  };

  const validation = updateIssueFrequencySchema.safeParse(rawData);
  if (!validation.success) {
    return err(
      "VALIDATION",
      validation.error.issues[0]?.message ?? "Invalid input"
    );
  }

  const { issueId, frequency } = validation.data;

  try {
    const currentIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: {
        machineInitials: true,
        issueNumber: true,
        reportedBy: true,
        assignedTo: true,
      },
      with: {
        machine: {
          columns: { ownerId: true },
        },
      },
    });

    if (!currentIssue) return err("NOT_FOUND", "Issue not found");

    // Permission check
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });

    if (
      !canUpdateIssue(
        { id: user.id, role: userProfile?.role ?? "guest" },
        currentIssue,
        currentIssue.machine
      )
    ) {
      return err(
        "UNAUTHORIZED",
        "You do not have permission to update this issue"
      );
    }

    // Update frequency
    await updateIssueFrequency({
      issueId,
      frequency,
    });

    revalidatePath(
      `/m/${currentIssue.machineInitials}/i/${currentIssue.issueNumber}`
    );
    return ok({ issueId });
  } catch (error: unknown) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "updateIssueFrequency",
      },
      "Update issue frequency error"
    );
    return err("SERVER", "Failed to update frequency");
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
      columns: {
        priority: true,
        machineInitials: true,
        issueNumber: true,
        reportedBy: true,
        assignedTo: true,
      },
      with: {
        machine: {
          columns: { ownerId: true },
        },
      },
    });

    if (!currentIssue) {
      return err("NOT_FOUND", "Issue not found");
    }

    // Permission check
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });

    if (
      !canUpdateIssue(
        { id: user.id, role: userProfile?.role ?? "guest" },
        currentIssue,
        currentIssue.machine
      )
    ) {
      return err(
        "UNAUTHORIZED",
        "You do not have permission to update this issue"
      );
    }

    // Update priority
    await updateIssuePriority({
      issueId,
      priority,
    });

    const issuePath = `/m/${currentIssue.machineInitials}/i/${currentIssue.issueNumber}`;
    revalidatePath(issuePath);
    revalidatePath(`/m/${currentIssue.machineInitials}`);

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
      columns: {
        machineInitials: true,
        issueNumber: true,
        reportedBy: true,
        assignedTo: true,
      },
      with: {
        machine: {
          columns: { ownerId: true },
        },
      },
    });

    if (!currentIssue) {
      return err("NOT_FOUND", "Issue not found");
    }

    // Permission check
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });

    if (
      !canUpdateIssue(
        { id: user.id, role: userProfile?.role ?? "guest" },
        currentIssue,
        currentIssue.machine
      )
    ) {
      return err(
        "UNAUTHORIZED",
        "You do not have permission to update this issue"
      );
    }

    // Assign issue via service
    await assignIssue({
      issueId,
      assignedTo,
      actorId: user.id,
    });

    const issuePath = `/m/${currentIssue.machineInitials}/i/${currentIssue.issueNumber}`;
    revalidatePath(issuePath);
    revalidatePath(`/m/${currentIssue.machineInitials}`);

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
    imagesMetadata: toOptionalString(formData.get("imagesMetadata")),
  });

  if (!validation.success) {
    return err(
      "VALIDATION",
      validation.error.issues[0]?.message ?? "Invalid input"
    );
  }

  const {
    issueId,
    comment,
    imagesMetadata: imagesMetadataStr,
  } = validation.data;

  let imagesMetadata: z.infer<typeof imagesMetadataArraySchema> = [];
  if (imagesMetadataStr) {
    try {
      imagesMetadata = imagesMetadataArraySchema.parse(
        JSON.parse(imagesMetadataStr)
      );
    } catch (e) {
      log.error(
        { error: e, issueId },
        "Failed to parse comment images metadata"
      );
      // Non-blocking, but log it
    }
  }

  try {
    await addIssueComment({
      issueId,
      content: comment,
      userId: user.id,
      imagesMetadata,
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

  // We need issue context for revalidation
  // This is a bit inefficient, but necessary for correct revalidation paths
  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { machineInitials: true, issueNumber: true },
  });

  if (issue) {
    revalidatePath(`/m/${issue.machineInitials}/i/${issue.issueNumber}`);
  }
  return ok({ issueId });
}

/**
 * Edits a comment on an issue.
 */
export async function editCommentAction(
  _prevState: EditCommentResult | undefined,
  formData: FormData
): Promise<EditCommentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  const validation = editCommentSchema.safeParse({
    commentId: toOptionalString(formData.get("commentId")),
    comment: toOptionalString(formData.get("comment")),
  });

  if (!validation.success) {
    return err(
      "VALIDATION",
      validation.error.issues[0]?.message ?? "Invalid input"
    );
  }

  const { commentId, comment } = validation.data;

  try {
    const existingComment = await db.query.issueComments.findFirst({
      where: eq(issueComments.id, commentId),
    });

    if (!existingComment) {
      return err("NOT_FOUND", "Comment not found");
    }

    if (existingComment.authorId !== user.id) {
      return err("UNAUTHORIZED", "You can only edit your own comments");
    }

    await updateIssueComment({
      commentId,
      content: comment,
    });

    // Revalidate the issue page
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, existingComment.issueId),
      columns: { machineInitials: true, issueNumber: true },
    });
    if (issue) {
      revalidatePath(`/m/${issue.machineInitials}/i/${issue.issueNumber}`);
    }

    return ok({ commentId });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "editComment",
      },
      "Failed to edit issue comment"
    );
    return err("SERVER", "Failed to edit comment");
  }
}

/**
 * Deletes a comment from an issue.
 */
export async function deleteCommentAction(
  _prevState: DeleteCommentResult | undefined,
  formData: FormData
): Promise<DeleteCommentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  const validation = deleteCommentSchema.safeParse({
    commentId: toOptionalString(formData.get("commentId")),
  });

  if (!validation.success) {
    return err(
      "VALIDATION",
      validation.error.issues[0]?.message ?? "Invalid input"
    );
  }

  const { commentId } = validation.data;

  try {
    const existingComment = await db.query.issueComments.findFirst({
      where: eq(issueComments.id, commentId),
    });

    if (!existingComment) {
      return err("NOT_FOUND", "Comment not found");
    }

    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });

    if (
      existingComment.authorId !== user.id &&
      userProfile?.role !== "admin"
    ) {
      return err(
        "UNAUTHORIZED",
        "You can only delete your own comments, or you must be an admin"
      );
    }

    await deleteIssueComment({
      commentId,
    });

    // Revalidate the issue page
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, existingComment.issueId),
      columns: { machineInitials: true, issueNumber: true },
    });
    if (issue) {
      revalidatePath(`/m/${issue.machineInitials}/i/${issue.issueNumber}`);
    }

    return ok({ commentId });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : "Unknown",
        action: "deleteComment",
      },
      "Failed to delete issue comment"
    );
    return err("SERVER", "Failed to delete comment");
  }
}
