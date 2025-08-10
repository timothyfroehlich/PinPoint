import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  issueDeleteProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { COMMENT_CLEANUP_CONFIG } from "~/server/constants/cleanup";
import { comments, issues, users } from "~/server/db/schema";
import { excludeSoftDeleted } from "~/server/db/utils/common-queries";

export const commentRouter = createTRPCRouter({
  // Get comments for an issue (excludes deleted)
  getForIssue: organizationProcedure
    .input(z.object({ issueId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.drizzle
        .select({
          id: comments.id,
          content: comments.content,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          deletedAt: comments.deletedAt,
          deletedBy: comments.deletedBy,
          issueId: comments.issueId,
          authorId: comments.authorId,
          author: {
            id: users.id,
            name: users.name,
            profilePicture: users.profilePicture,
          },
        })
        .from(comments)
        .innerJoin(users, eq(comments.authorId, users.id))
        .where(
          and(
            eq(comments.issueId, input.issueId),
            excludeSoftDeleted(comments.deletedAt),
          ),
        )
        .orderBy(comments.createdAt);
    }),

  // Soft delete a comment
  delete: issueDeleteProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [comment] = await ctx.drizzle
        .select({
          id: comments.id,
          issueId: comments.issueId,
          issue: {
            organizationId: issues.organizationId,
          },
        })
        .from(comments)
        .innerJoin(issues, eq(comments.issueId, issues.id))
        .where(eq(comments.id, input.commentId))
        .limit(1);

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Verify comment belongs to user's organization

      if (comment.issue.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Comment not in organization",
        });
      }

      const cleanupService = ctx.services.createCommentCleanupService();
      await cleanupService.softDeleteComment(input.commentId, ctx.user.id);

      // Record the deletion activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordCommentDeleted(
        comment.issueId,
        ctx.organization.id,
        ctx.user.id,
        input.commentId,
      );

      return { success: true };
    }),

  // Admin: Get deleted comments
  getDeleted: organizationManageProcedure.query(({ ctx }) => {
    const cleanupService = ctx.services.createCommentCleanupService();
    return cleanupService.getDeletedComments(ctx.organization.id);
  }),

  // Admin: Restore deleted comment
  restore: organizationManageProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cleanupService = ctx.services.createCommentCleanupService();
      await cleanupService.restoreComment(input.commentId);
      return { success: true };
    }),

  // Admin: Get cleanup statistics
  getCleanupStats: organizationManageProcedure.query(async ({ ctx }) => {
    const cleanupService = ctx.services.createCommentCleanupService();
    const candidateCount = await cleanupService.getCleanupCandidateCount();

    return {
      candidateCount,
      cleanupThresholdDays: COMMENT_CLEANUP_CONFIG.RETENTION_DAYS,
    };
  }),
});
