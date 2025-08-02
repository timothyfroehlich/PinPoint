import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  issueCreateProcedure,
  issueEditProcedure,
} from "~/server/api/trpc";

export const issueCommentRouter = createTRPCRouter({
  // Add comment to an issue (for members/admins)
  addComment: issueCreateProcedure
    .input(
      z.object({
        issueId: z.string(),
        content: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the issue belongs to this organization
      const existingIssue = await ctx.db.issue.findFirst({
        where: {
          id: input.issueId,
          organizationId: ctx.organization.id,
        },
      });

      if (!existingIssue) {
        throw new Error("Issue not found");
      }

      // Verify the user is a member of this organization
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.user.id,
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!membership) {
        throw new Error("User is not a member of this organization");
      }

      const comment = await ctx.db.comment.create({
        data: {
          content: input.content,
          issueId: input.issueId,
          authorId: ctx.user.id,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      return comment;
    }),

  // Alias for addComment (for backward compatibility with tests)
  create: issueCreateProcedure
    .input(
      z.object({
        issueId: z.string(),
        content: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the issue belongs to this organization
      const existingIssue = await ctx.db.issue.findFirst({
        where: {
          id: input.issueId,
          organizationId: ctx.organization.id,
        },
      });

      if (!existingIssue) {
        throw new Error("Issue not found");
      }

      // Verify the user is a member of this organization
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.user.id,
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!membership) {
        throw new Error("User is not a member of this organization");
      }

      const comment = await ctx.db.comment.create({
        data: {
          content: input.content,
          issueId: input.issueId,
          authorId: ctx.user.id,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      return comment;
    }),

  // Edit comment (users can only edit their own comments)
  editComment: issueEditProcedure
    .input(
      z.object({
        commentId: z.string(),
        content: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the comment and verify permissions
      const comment = await ctx.db.comment.findFirst({
        where: {
          id: input.commentId,
          issue: {
            organizationId: ctx.organization.id,
          },
        },
        include: {
          author: true,
          issue: true,
        },
      });

      if (!comment) {
        throw new Error("Comment not found");
      }

      if (comment.deletedAt) {
        throw new Error("Cannot edit deleted comment");
      }

      // Only the author can edit their own comment
      if (comment.authorId !== ctx.user.id) {
        throw new Error("You can only edit your own comments");
      }

      // Update the comment
      const updatedComment = await ctx.db.comment.update({
        where: { id: input.commentId },
        data: {
          content: input.content,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      return updatedComment;
    }),

  // Delete comment (users can delete their own, admins can delete any)
  deleteComment: organizationProcedure
    .input(
      z.object({
        commentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the comment and verify permissions
      const comment = await ctx.db.comment.findFirst({
        where: {
          id: input.commentId,
          issue: {
            organizationId: ctx.organization.id,
          },
        },
        include: {
          author: true,
          issue: true,
        },
      });

      if (!comment) {
        throw new Error("Comment not found");
      }

      if (comment.deletedAt) {
        throw new Error("Comment is already deleted");
      }

      // Check permissions: user can delete their own comment, admins can delete any
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.user.id,
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!membership) {
        throw new Error("User is not a member of this organization");
      }

      const canDelete =
        comment.authorId === ctx.user.id ||
        ctx.userPermissions.includes("issue:delete");

      if (!canDelete) {
        throw new Error("You can only delete your own comments");
      }

      // Soft delete the comment
      const deletedComment = await ctx.db.comment.update({
        where: { id: input.commentId },
        data: {
          deletedAt: new Date(),
          deletedBy: ctx.user.id,
        },
      });

      // Record deletion activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordCommentDeleted(
        comment.issue.id,
        ctx.organization.id,
        ctx.user.id,
        input.commentId,
      );

      return deletedComment;
    }),
});
