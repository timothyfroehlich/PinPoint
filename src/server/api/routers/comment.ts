import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  issueDeleteProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { CommentCleanupService } from "~/server/services/commentCleanupService";
import { IssueActivityService } from "~/server/services/issueActivityService";

export const commentRouter = createTRPCRouter({
  // Get comments for an issue (excludes deleted)
  getForIssue: organizationProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.comment.findMany({
        where: {
          issueId: input.issueId,
          deletedAt: null,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    }),

  // Soft delete a comment
  delete: issueDeleteProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.comment.findUnique({
        where: { id: input.commentId },
        include: {
          issue: {
            select: {
              organizationId: true,
            },
          },
        },
      });

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

      const cleanupService = new CommentCleanupService(ctx.db);
      await cleanupService.softDeleteComment(
        input.commentId,
        ctx.session.user.id,
      );

      // Record the deletion activity
      const activityService = new IssueActivityService(ctx.db);
      await activityService.recordCommentDeleted(
        comment.issueId,
        ctx.organization.id,
        ctx.session.user.id,
        input.commentId,
      );

      return { success: true };
    }),

  // Admin: Get deleted comments
  getDeleted: organizationManageProcedure.query(async ({ ctx }) => {
    const cleanupService = new CommentCleanupService(ctx.db);
    return cleanupService.getDeletedComments(ctx.organization.id);
  }),

  // Admin: Restore deleted comment
  restore: organizationManageProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cleanupService = new CommentCleanupService(ctx.db);
      await cleanupService.restoreComment(input.commentId);
      return { success: true };
    }),

  // Admin: Get cleanup statistics
  getCleanupStats: organizationManageProcedure.query(async ({ ctx }) => {
    const cleanupService = new CommentCleanupService(ctx.db);
    const candidateCount = await cleanupService.getCleanupCandidateCount();

    return {
      candidateCount,
      cleanupThresholdDays: 90,
    };
  }),
});
