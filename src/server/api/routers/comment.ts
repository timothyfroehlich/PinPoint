// External libraries (alphabetical)
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

// Internal types (alphabetical)
import { type CommentResponse } from "~/lib/utils/api-response-transformers";
import { type CommentWithAuthorResponse } from "~/lib/types/api";

// Internal utilities (alphabetical)
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";
import { transformCommentWithAuthorResponse } from "~/lib/utils/api-response-transformers";

// Server modules (alphabetical)
import {
  createTRPCRouter,
  issueDeleteProcedure,
  organizationManageProcedure,
  orgScopedProcedure,
} from "~/server/api/trpc";
import { COMMENT_CLEANUP_CONFIG } from "~/server/constants/cleanup";

// Database schema (alphabetical)
import { comments, issues, users } from "~/server/db/schema";
import { excludeSoftDeleted } from "~/server/db/utils/common-queries";

export const commentRouter = createTRPCRouter({
  // Get comments for an issue (excludes deleted)
  getForIssue: orgScopedProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }): Promise<CommentWithAuthorResponse[]> => {
      const result = await ctx.db
        .select({
          id: comments.id,
          content: comments.content,
          created_at: comments.created_at,
          updated_at: comments.updated_at,
          deleted_at: comments.deleted_at,
          deleted_by: comments.deleted_by,
          issue_id: comments.issue_id,
          author_id: comments.author_id,
          author: {
            id: users.id,
            name: users.name,
            image: users.image,
          },
        })
        .from(comments)
        .innerJoin(users, eq(comments.author_id, users.id))
        .where(
          and(
            eq(comments.issue_id, input.issueId),
            excludeSoftDeleted(comments.deleted_at),
          ),
        )
        .orderBy(comments.created_at);

      return result.map((comment) =>
        transformCommentWithAuthorResponse(comment),
      );
    }),

  // Soft delete a comment
  delete: issueDeleteProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      const [comment] = await ctx.db
        .select({
          id: comments.id,
          issue_id: comments.issue_id,
          issue: {
            organization_id: issues.organization_id,
          },
        })
        .from(comments)
        .innerJoin(issues, eq(comments.issue_id, issues.id))
        .where(eq(comments.id, input.commentId))
        .limit(1);

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // RLS ensures comment belongs to user's organization

      const cleanupService = ctx.services.createCommentCleanupService();
      await cleanupService.softDeleteComment(input.commentId, ctx.user.id);

      // Record the deletion activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordCommentDeleted(
        comment.issue_id,
        ctx.user.id,
        input.commentId,
      );

      return { success: true };
    }),

  // Admin: Get deleted comments
  getDeleted: organizationManageProcedure.query(
    async ({ ctx }): Promise<CommentResponse[]> => {
      const cleanupService = ctx.services.createCommentCleanupService();
      const deletedComments = await cleanupService.getDeletedComments();
      // Transform to camelCase as service returns snake_case from database
      return transformKeysToCamelCase(deletedComments) as CommentResponse[];
    },
  ),

  // Admin: Restore deleted comment
  restore: organizationManageProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      const cleanupService = ctx.services.createCommentCleanupService();
      await cleanupService.restoreComment(input.commentId);
      return { success: true };
    }),

  // Admin: Get cleanup statistics
  getCleanupStats: organizationManageProcedure.query(
    async ({
      ctx,
    }): Promise<{ candidateCount: number; cleanupThresholdDays: number }> => {
      const cleanupService = ctx.services.createCommentCleanupService();
      const candidateCount = await cleanupService.getCleanupCandidateCount();

      return {
        candidateCount,
        cleanupThresholdDays: COMMENT_CLEANUP_CONFIG.RETENTION_DAYS,
      };
    },
  ),
});
