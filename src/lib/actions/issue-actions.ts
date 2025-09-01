/**
 * Issue Server Actions (2025 Performance Patterns)
 * Form handling and mutations for RSC architecture with React 19 cache API
 */

"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cache } from "react"; // React 19 cache API
import { z } from "zod";
import { titleSchema, commentContentSchema, uuidSchema, idSchema } from "~/lib/validation/schemas";
import { and, eq, inArray } from "drizzle-orm";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import {
  issues,
  issueStatuses,
  priorities,
  comments,
} from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import { transformKeysToSnakeCase } from "~/lib/utils/case-transformers";
import {
  requireAuthContextWithRole,
  validateFormData,
  actionSuccess,
  actionError,
  runAfterResponse,
  type ActionResult,
} from "./shared";
import { requirePermission } from "./shared";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
import {
  generateIssueCreationNotifications,
  generateStatusChangeNotifications,
  generateAssignmentNotifications,
} from "~/lib/services/notification-generator";

// Enhanced validation schemas with better error messages
const createIssueSchema = z.object({
  title: titleSchema,
  description: z.string().optional(),
  machineId: uuidSchema.or(idSchema.refine(() => false, "Please select a machine")),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  assigneeId: uuidSchema.optional(),
});

const updateIssueStatusSchema = z.object({
  statusId: uuidSchema, // uses centralized uuid validator (provides proper message)
});

const addCommentSchema = z.object({ content: commentContentSchema });

const updateIssueAssignmentSchema = z.object({
  assigneeId: uuidSchema.optional(),
});

const bulkUpdateIssuesSchema = z.object({
  issueIds: z
    .array(uuidSchema)
    .min(1, "No issues selected")
    .max(50, "Cannot update more than 50 issues at once"),
  statusId: uuidSchema.optional(),
  assigneeId: uuidSchema.optional(),
});

// Performance: Cached database queries for default values
const getDefaultStatus = cache(async (organizationId: string) => {
  const db = getGlobalDatabaseProvider().getClient();
  return await db.query.issueStatuses.findFirst({
    where: and(
      eq(issueStatuses.is_default, true),
      eq(issueStatuses.organization_id, organizationId),
    ),
  });
});

const getDefaultPriority = cache(async (organizationId: string) => {
  const db = getGlobalDatabaseProvider().getClient();
  return await db.query.priorities.findFirst({
    where: and(
      eq(priorities.is_default, true),
      eq(priorities.organization_id, organizationId),
    ),
  });
});

/**
 * Create new issue via Server Action (React 19 useActionState compatible)
 * Enhanced with performance optimizations and background processing
 */
export async function createIssueAction(
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();

    // Enhanced validation with Zod
    const validation = validateFormData(formData, createIssueSchema);
    if (!validation.success) {
      return validation;
    }

    const db = getGlobalDatabaseProvider().getClient();
    await requirePermission(membership, PERMISSIONS.ISSUE_CREATE, db);

    // Parallel queries for better performance
    const [defaultStatus, defaultPriority] = await Promise.all([
      getDefaultStatus(organizationId),
      getDefaultPriority(organizationId),
    ]);

    if (!defaultStatus || !defaultPriority) {
      return actionError("System configuration error. Please contact support.");
    }

    // Create issue with validated data
    const issueData = {
      id: generatePrefixedId("issue"),
      title: validation.data.title,
      description: validation.data.description ?? "",
      machineId: validation.data.machineId,
      organizationId,
      statusId: defaultStatus.id,
      priorityId: defaultPriority.id,
      assigneeId: validation.data.assigneeId,
      createdById: user.id,
    };

    // Create issue in database
    await db
      .insert(issues)
      .values(
        transformKeysToSnakeCase(issueData) as typeof issues.$inferInsert,
      );

    // Granular cache invalidation
    revalidatePath("/issues");
    revalidatePath(`/issues/${issueData.id}`);
    revalidatePath("/dashboard");
    revalidateTag("issues");

    // Background processing (runs after response sent to user)
    runAfterResponse(async () => {
      console.log(`Issue ${issueData.id} created by ${user.email}`);

      // Generate notifications for issue creation
      try {
        await generateIssueCreationNotifications(issueData.id, {
          organizationId,
          actorId: user.id,
          actorName:
            (user.user_metadata?.["name"] as string) ?? user.email ?? "Someone",
        });
      } catch (error) {
        console.error(
          "Failed to generate issue creation notifications:",
          error,
        );
      }
    });

    // Redirect to new issue
    redirect(`/issues/${issueData.id}`);
  } catch (error) {
    console.error("Create issue error:", error);
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to create issue. Please try again.",
    );
  }
}

/**
 * Update issue status via Server Action (React 19 useActionState compatible)
 * Enhanced with validation and background processing
 */
export async function updateIssueStatusAction(
  issueId: string,
  _prevState: ActionResult<{ statusId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ statusId: string }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();

    // Enhanced validation
    const validation = validateFormData(formData, updateIssueStatusSchema);
    if (!validation.success) {
      return validation;
    }

    const db = getGlobalDatabaseProvider().getClient();
    await requirePermission(membership, PERMISSIONS.ISSUE_EDIT, db);

    // Update with organization scoping for security
    const [updatedIssue] = await db
      .update(issues)
      .set({ status_id: validation.data.statusId })
      .where(
        and(eq(issues.id, issueId), eq(issues.organization_id, organizationId)),
      )
      .returning({ status_id: issues.status_id });

    if (!updatedIssue) {
      return actionError("Issue not found or access denied");
    }

    // Granular cache invalidation
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath("/dashboard");
    revalidateTag("issues");

    // Background processing
    runAfterResponse(async () => {
      console.log(`Issue ${issueId} status updated by ${user.email}`);

      // Generate notifications for status change
      try {
        // Get status name for notification message
        const statusResult = await db.query.issueStatuses.findFirst({
          where: eq(issueStatuses.id, validation.data.statusId),
          columns: { name: true },
        });

        if (statusResult) {
          await generateStatusChangeNotifications(issueId, statusResult.name, {
            organizationId,
            actorId: user.id,
            actorName:
              (user.user_metadata?.["name"] as string) ??
              user.email ??
              "Someone",
          });
        }
      } catch (error) {
        console.error("Failed to generate status change notifications:", error);
      }
    });

    return actionSuccess(
      { statusId: updatedIssue.status_id },
      "Issue status updated successfully",
    );
  } catch (error) {
    console.error("Update issue status error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to update issue status",
    );
  }
}

/**
 * Add comment to issue via Server Action (React 19 useActionState compatible)
 */
export async function addCommentAction(
  issueId: string,
  _prevState: ActionResult<{ commentId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ commentId: string }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();

    // Enhanced validation
    const validation = validateFormData(formData, addCommentSchema);
    if (!validation.success) {
      return validation;
    }

    const db = getGlobalDatabaseProvider().getClient();
    await requirePermission(membership, PERMISSIONS.ISSUE_CREATE, db);

    // Verify issue exists and user has access
    const issue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organization_id, organizationId),
      ),
      columns: { id: true },
    });

    if (!issue) {
      return actionError("Issue not found or access denied");
    }

    // Create comment
    const commentData = {
      id: generatePrefixedId("comment"),
      content: validation.data.content,
      issue_id: issueId,
      author_id: user.id,
      organization_id: organizationId,
    };

    await db.insert(comments).values(commentData);

    // Cache invalidation
    revalidatePath(`/issues/${issueId}`);
    revalidateTag("issues");
    revalidateTag(`comments-${issueId}`);

    // Background processing
    runAfterResponse(async () => {
      console.log(`Comment added to issue ${issueId} by ${user.email}`);
    });

    return actionSuccess(
      { commentId: commentData.id },
      "Comment added successfully",
    );
  } catch (error) {
    console.error("Add comment error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to add comment",
    );
  }
}

/**
 * Update issue assignment via Server Action (React 19 useActionState compatible)
 */
export async function updateIssueAssignmentAction(
  issueId: string,
  _prevState: ActionResult<{ assigneeId: string | null }> | null,
  formData: FormData,
): Promise<ActionResult<{ assigneeId: string | null }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();

    // Enhanced validation
    const validation = validateFormData(formData, updateIssueAssignmentSchema);
    if (!validation.success) {
      return validation;
    }

    const db = getGlobalDatabaseProvider().getClient();
    await requirePermission(membership, PERMISSIONS.ISSUE_ASSIGN, db);

    // Get current assignee for notification comparison
    const currentIssue = await db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organization_id, organizationId),
      ),
      columns: { assigned_to_id: true },
    });

    const previousAssigneeId = currentIssue?.assigned_to_id ?? null;

    // Update assignment with organization scoping
    const [updatedIssue] = await db
      .update(issues)
      .set({ assigned_to_id: validation.data.assigneeId ?? null })
      .where(
        and(eq(issues.id, issueId), eq(issues.organization_id, organizationId)),
      )
      .returning({ assigned_to_id: issues.assigned_to_id });

    if (!updatedIssue) {
      return actionError("Issue not found or access denied");
    }

    // Cache invalidation
    revalidatePath(`/issues/${issueId}`);
    revalidatePath("/issues");
    revalidatePath("/dashboard");
    revalidateTag("issues");

    // Background processing
    runAfterResponse(async () => {
      console.log(`Issue ${issueId} assignment updated by ${user.email}`);

      // Generate notifications for assignment change
      try {
        await generateAssignmentNotifications(
          issueId,
          validation.data.assigneeId ?? null,
          previousAssigneeId,
          {
            organizationId,
            actorId: user.id,
            actorName:
              (user.user_metadata?.["name"] as string) ??
              user.email ??
              "Someone",
          },
        );
      } catch (error) {
        console.error(
          "Failed to generate assignment change notifications:",
          error,
        );
      }
    });

    return actionSuccess(
      { assigneeId: updatedIssue.assigned_to_id },
      "Issue assignment updated successfully",
    );
  } catch (error) {
    console.error("Update issue assignment error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to update assignment",
    );
  }
}

/**
 * Bulk update issues via Server Action (React 19 useActionState compatible)
 */
export async function bulkUpdateIssuesAction(
  _prevState: ActionResult<{ updatedCount: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    const { user, organizationId, membership } =
      await requireAuthContextWithRole();

    // Parse JSON data from form
    const jsonData = formData.get("data") as string;
    if (!jsonData) {
      return actionError("No data provided for bulk update");
    }

    const data = JSON.parse(jsonData);
    const validation = bulkUpdateIssuesSchema.safeParse(data);
    if (!validation.success) {
      return actionError("Invalid bulk update data");
    }

    const db = getGlobalDatabaseProvider().getClient();
    await requirePermission(membership, PERMISSIONS.ISSUE_BULK_MANAGE, db);
    const { issueIds, statusId, assigneeId } = validation.data;

    // Build update object
    const updateData: any = {};
    if (statusId) updateData.status_id = statusId;
    if (assigneeId !== undefined) updateData.assigned_to_id = assigneeId ?? null;

    if (Object.keys(updateData).length === 0) {
      return actionError("No updates specified");
    }

    // Bulk update with organization scoping
    const updatedIssues = await db
      .update(issues)
      .set(updateData)
      .where(
        and(
          eq(issues.organization_id, organizationId),
          inArray(issues.id, issueIds),
        ),
      )
      .returning({ id: issues.id });

    // Cache invalidation
    revalidatePath("/issues");
    revalidatePath("/dashboard");
    revalidateTag("issues");

    // Background processing
    runAfterResponse(async () => {
      console.log(
        `Bulk updated ${updatedIssues.length} issues by ${user.email}`,
      );
    });

    return actionSuccess(
      { updatedCount: updatedIssues.length },
      `Successfully updated ${updatedIssues.length} issue${updatedIssues.length !== 1 ? "s" : ""}`,
    );
  } catch (error) {
    console.error("Bulk update issues error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to bulk update issues",
    );
  }
}
