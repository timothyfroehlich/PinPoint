/**
 * Comment Server Actions (2025 Performance Patterns)
 * Form handling and mutations for comment management with React 19 cache API
 */

"use server";

import { getDb } from "~/lib/dal/shared";

import { revalidatePath, revalidateTag } from "next/cache";
import { cache } from "react"; // React 19 cache API
import { z } from "zod";
import { commentContentSchema } from "~/lib/validation/schemas";
import { and, eq, isNull } from "drizzle-orm";
import { comments, issues } from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import {
  validateFormData,
  actionSuccess,
  actionError,
  runAfterResponse,
  type ActionResult,
} from "./shared";
import { isError, getErrorMessage } from "~/lib/utils/type-guards";
import { getRequestAuthContext } from "~/server/auth/context";
import { requirePermission } from "./shared";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
import { generateCommentNotifications } from "~/lib/services/notification-generator";

// Validation using centralized schemas
const addCommentSchema = z.object({
  content: commentContentSchema,
});

const editCommentSchema = z.object({
  content: commentContentSchema,
});

// Performance: Cached database queries for verification
const getCommentWithAccess = cache(
  async (commentId: string, organizationId: string, userId: string) => {
    return await getDb().query.comments.findFirst({
      where: and(
        eq(comments.id, commentId),
        eq(comments.organization_id, organizationId),
        eq(comments.author_id, userId), // User must be author to edit/delete
        isNull(comments.deleted_at), // Not soft-deleted
      ),
    });
  },
);

const getIssueWithAccess = cache(
  async (issueId: string, organizationId: string) => {
    return await getDb().query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organization_id, organizationId),
      ),
      columns: { id: true },
    });
  },
);

/**
 * Add comment to issue via Server Action (React 19 useActionState compatible)
 * Enhanced with organization scoping and background processing
 */
export async function addCommentAction(
  issueId: string,
  _prevState: ActionResult<{ commentId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ commentId: string }>> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    const { user, org: organization } = authContext;
    const organizationId = organization.id;

    // Enhanced validation
    const validation = validateFormData(formData, addCommentSchema);
    if (!validation.success) {
      return validation;
    }

    // Note: Commenting is allowed for any authenticated member who can view the issue.
    // Do NOT require ISSUE_CREATE here; visibility of the issue implies comment permission.

    // Verify issue exists and user has access
    const issue = await getIssueWithAccess(issueId, organizationId);
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

    await getDb().insert(comments).values(commentData);

    // Granular cache invalidation
    revalidatePath(`/issues/${issueId}`);
    revalidateTag("issues", "max");
    revalidateTag(`comments-${issueId}`, "max");
    revalidateTag(`recent-comments-${organizationId}`, "max");

    // Background processing (runs after response sent to user)
    runAfterResponse(async () => {
      console.log(`Comment added to issue ${issueId} by ${user.email}`);

      // Generate notifications for issue stakeholders
      try {
        await generateCommentNotifications(issueId, commentData.id, {
          organizationId,
          actorId: user.id,
          actorName: user.name ?? user.email,
        });
      } catch (error) {
        console.error(
          "Failed to generate comment notifications:",
          getErrorMessage(error),
        );
      }
    });

    return actionSuccess(
      { commentId: commentData.id },
      "Comment added successfully",
    );
  } catch (error) {
    console.error("Add comment error:", error);
    return actionError(
      isError(error) ? error.message : "Failed to add comment",
    );
  }
}

/**
 * Edit comment via Server Action (React 19 useActionState compatible)
 * Enhanced with permission checks and audit trail
 */
export async function editCommentAction(
  commentId: string,
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    const { user, org: organization, membership } = authContext;
    const organizationId = organization.id;
    await requirePermission(
      { role_id: membership.role.id },
      PERMISSIONS.ISSUE_CREATE_BASIC,
      getDb(),
    );

    // Enhanced validation
    const validation = validateFormData(formData, editCommentSchema);
    if (!validation.success) {
      return validation;
    }

    // Verify comment exists and user has permission to edit
    const comment = await getCommentWithAccess(
      commentId,
      organizationId,
      user.id,
    );
    if (!comment) {
      return actionError(
        "Comment not found or you don't have permission to edit it",
      );
    }

    // Update comment
    await getDb()
      .update(comments)
      .set({
        content: validation.data.content,
        updated_at: new Date(),
      })
      .where(eq(comments.id, commentId));

    // Granular cache invalidation
    revalidatePath(`/issues/${comment.issue_id}`);
    revalidateTag("issues", "max");
    revalidateTag(`comments-${comment.issue_id}`, "max");
    revalidateTag(`recent-comments-${organizationId}`, "max");

    // Background processing
    runAfterResponse(() => {
      console.log(`Comment ${commentId} edited by ${user.email}`);
      return Promise.resolve();
    });

    return actionSuccess({ success: true }, "Comment updated successfully");
  } catch (error) {
    console.error("Edit comment error:", error);
    return actionError(
      isError(error) ? error.message : "Failed to update comment",
    );
  }
}

/**
 * Delete comment via Server Action (React 19 useActionState compatible)
 * Uses soft delete for audit trail and potential recovery
 */
export async function deleteCommentAction(
  commentId: string,
  _prevState: ActionResult<{ success: boolean }> | null,
  _formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    const { user, org: organization, membership } = authContext;
    const organizationId = organization.id;
    await requirePermission(
      { role_id: membership.role.id },
      PERMISSIONS.ISSUE_CREATE_BASIC,
      getDb(),
    );

    // Verify comment exists and user has permission to delete
    const comment = await getCommentWithAccess(
      commentId,
      organizationId,
      user.id,
    );
    if (!comment) {
      return actionError(
        "Comment not found or you don't have permission to delete it",
      );
    }

    // Soft delete comment (preserve for audit trail)
    await getDb()
      .update(comments)
      .set({
        deleted_at: new Date(),
        deleted_by: user.id,
      })
      .where(eq(comments.id, commentId));

    // Granular cache invalidation
    revalidatePath(`/issues/${comment.issue_id}`);
    revalidateTag("issues", "max");
    revalidateTag(`comments-${comment.issue_id}`, "max");
    revalidateTag(`recent-comments-${organizationId}`, "max");

    // Background processing
    runAfterResponse(() => {
      console.log(`Comment ${commentId} deleted by ${user.email}`);
      return Promise.resolve();
    });

    return actionSuccess({ success: true }, "Comment deleted successfully");
  } catch (error) {
    console.error("Delete comment error:", error);
    return actionError(
      isError(error) ? error.message : "Failed to delete comment",
    );
  }
}

/**
 * Restore soft-deleted comment via Server Action (for admin recovery)
 */
export async function restoreCommentAction(
  commentId: string,
  _prevState: ActionResult<{ success: boolean }> | null,
  _formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    const { user, org: organization, membership } = authContext;
    const organizationId = organization.id;
    await requirePermission(
      { role_id: membership.role.id },
      PERMISSIONS.ISSUE_CREATE_BASIC,
      getDb(),
    );

    // Find soft-deleted comment that user authored
    const comment = await getDb().query.comments.findFirst({
      where: and(
        eq(comments.id, commentId),
        eq(comments.organization_id, organizationId),
        eq(comments.author_id, user.id), // User must be author
      ),
    });

    if (!comment?.deleted_at) {
      return actionError("Comment not found or not deleted");
    }

    // Restore comment
    await getDb()
      .update(comments)
      .set({
        deleted_at: null,
        deleted_by: null,
      })
      .where(eq(comments.id, commentId));

    // Cache invalidation
    revalidatePath(`/issues/${comment.issue_id}`);
    revalidateTag("issues", "max");
    revalidateTag(`comments-${comment.issue_id}`, "max");
    revalidateTag(`recent-comments-${organizationId}`, "max");

    // Background processing
    runAfterResponse(() => {
      console.log(`Comment ${commentId} restored by ${user.email}`);
      return Promise.resolve();
    });

    return actionSuccess({ success: true }, "Comment restored successfully");
  } catch (error) {
    console.error("Restore comment error:", error);
    return actionError(
      isError(error) ? error.message : "Failed to restore comment",
    );
  }
}
