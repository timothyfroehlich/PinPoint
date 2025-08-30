/**
 * Comment Server Actions (2025 Performance Patterns)
 * Form handling and mutations for comment management with React 19 cache API
 */

"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { cache } from "react"; // React 19 cache API
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { comments, issues } from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import {
  getActionAuthContext,
  validateFormData,
  actionSuccess,
  actionError,
  runAfterResponse,
  type ActionResult,
} from "./shared";
import { generateCommentNotifications } from "~/lib/services/notification-generator";

// Enhanced validation schemas with better error messages
const addCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment must be less than 2000 characters")
    .trim(),
});

const editCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment must be less than 2000 characters")
    .trim(),
});

// Performance: Cached database queries for verification
const getCommentWithAccess = cache(async (commentId: string, organizationId: string, userId: string) => {
  const db = getGlobalDatabaseProvider().getClient();
  return await db.query.comments.findFirst({
    where: and(
      eq(comments.id, commentId),
      eq(comments.organization_id, organizationId),
      eq(comments.author_id, userId), // User must be author to edit/delete
      isNull(comments.deleted_at), // Not soft-deleted
    ),
  });
});

const getIssueWithAccess = cache(async (issueId: string, organizationId: string) => {
  const db = getGlobalDatabaseProvider().getClient();
  return await db.query.issues.findFirst({
    where: and(
      eq(issues.id, issueId), 
      eq(issues.organization_id, organizationId)
    ),
    columns: { id: true },
  });
});

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
    const { user, organizationId } = await getActionAuthContext();

    // Enhanced validation
    const validation = validateFormData(formData, addCommentSchema);
    if (!validation.success) {
      return validation;
    }

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

    const db = getGlobalDatabaseProvider().getClient();
    await db.insert(comments).values(commentData);

    // Granular cache invalidation
    revalidatePath(`/issues/${issueId}`);
    revalidateTag("issues");
    revalidateTag(`comments-${issueId}`);
    revalidateTag(`recent-comments-${organizationId}`);

    // Background processing (runs after response sent to user)
    runAfterResponse(async () => {
      console.log(`Comment added to issue ${issueId} by ${user.email}`);
      
      // Generate notifications for issue stakeholders
      try {
        await generateCommentNotifications(issueId, commentData.id, {
          organizationId,
          actorId: user.id,
          actorName: user.user_metadata?.name || user.email || 'Someone',
        });
      } catch (error) {
        console.error('Failed to generate comment notifications:', error);
      }
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
 * Edit comment via Server Action (React 19 useActionState compatible)
 * Enhanced with permission checks and audit trail
 */
export async function editCommentAction(
  commentId: string,
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId } = await getActionAuthContext();

    // Enhanced validation
    const validation = validateFormData(formData, editCommentSchema);
    if (!validation.success) {
      return validation;
    }

    // Verify comment exists and user has permission to edit
    const comment = await getCommentWithAccess(commentId, organizationId, user.id);
    if (!comment) {
      return actionError("Comment not found or you don't have permission to edit it");
    }

    // Update comment
    const db = getGlobalDatabaseProvider().getClient();
    await db
      .update(comments)
      .set({ 
        content: validation.data.content,
        updated_at: new Date(),
      })
      .where(eq(comments.id, commentId));

    // Granular cache invalidation
    revalidatePath(`/issues/${comment.issue_id}`);
    revalidateTag("issues");
    revalidateTag(`comments-${comment.issue_id}`);
    revalidateTag(`recent-comments-${organizationId}`);

    // Background processing
    runAfterResponse(async () => {
      console.log(`Comment ${commentId} edited by ${user.email}`);
    });

    return actionSuccess(
      { success: true },
      "Comment updated successfully",
    );
  } catch (error) {
    console.error("Edit comment error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to update comment",
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
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId } = await getActionAuthContext();

    // Verify comment exists and user has permission to delete
    const comment = await getCommentWithAccess(commentId, organizationId, user.id);
    if (!comment) {
      return actionError("Comment not found or you don't have permission to delete it");
    }

    // Soft delete comment (preserve for audit trail)
    const db = getGlobalDatabaseProvider().getClient();
    await db
      .update(comments)
      .set({ 
        deleted_at: new Date(),
        deleted_by: user.id,
      })
      .where(eq(comments.id, commentId));

    // Granular cache invalidation
    revalidatePath(`/issues/${comment.issue_id}`);
    revalidateTag("issues");
    revalidateTag(`comments-${comment.issue_id}`);
    revalidateTag(`recent-comments-${organizationId}`);

    // Background processing
    runAfterResponse(async () => {
      console.log(`Comment ${commentId} deleted by ${user.email}`);
    });

    return actionSuccess(
      { success: true },
      "Comment deleted successfully",
    );
  } catch (error) {
    console.error("Delete comment error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to delete comment",
    );
  }
}

/**
 * Restore soft-deleted comment via Server Action (for admin recovery)
 */
export async function restoreCommentAction(
  commentId: string,
  _prevState: ActionResult<{ success: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { user, organizationId } = await getActionAuthContext();

    const db = getGlobalDatabaseProvider().getClient();
    
    // Find soft-deleted comment that user authored
    const comment = await db.query.comments.findFirst({
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
    await db
      .update(comments)
      .set({ 
        deleted_at: null,
        deleted_by: null,
      })
      .where(eq(comments.id, commentId));

    // Cache invalidation
    revalidatePath(`/issues/${comment.issue_id}`);
    revalidateTag("issues");
    revalidateTag(`comments-${comment.issue_id}`);
    revalidateTag(`recent-comments-${organizationId}`);

    // Background processing
    runAfterResponse(async () => {
      console.log(`Comment ${commentId} restored by ${user.email}`);
    });

    return actionSuccess(
      { success: true },
      "Comment restored successfully",
    );
  } catch (error) {
    console.error("Restore comment error:", error);
    return actionError(
      error instanceof Error ? error.message : "Failed to restore comment",
    );
  }
}