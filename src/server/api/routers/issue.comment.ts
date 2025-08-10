import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { OrganizationTRPCContext } from "~/server/api/trpc.base";

import { generateId } from "~/lib/utils/id-generation";
import {
  createTRPCRouter,
  organizationProcedure,
  issueCreateProcedure,
  issueEditProcedure,
} from "~/server/api/trpc";
import { comments, issues, memberships, users } from "~/server/db/schema";

// Helper function to create a comment with author details
async function createCommentWithAuthor(
  ctx: OrganizationTRPCContext,
  input: { issueId: string; content: string },
) {
  // Verify the issue belongs to this organization
  const [existingIssue] = await ctx.drizzle
    .select({
      id: issues.id,
      organizationId: issues.organizationId,
    })
    .from(issues)
    .where(
      and(
        eq(issues.id, input.issueId),
        eq(issues.organizationId, ctx.organization.id),
      ),
    )
    .limit(1);

  if (!existingIssue) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Issue not found",
    });
  }

  // Verify the user is a member of this organization
  const [membership] = await ctx.drizzle
    .select({
      id: memberships.id,
    })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, ctx.user.id),
        eq(memberships.organizationId, ctx.organization.id),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is not a member of this organization",
    });
  }

  // Insert the comment
  const [comment] = await ctx.drizzle
    .insert(comments)
    .values({
      id: generateId(),
      content: input.content,
      issueId: input.issueId,
      authorId: ctx.user.id,
    })
    .returning({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      issueId: comments.issueId,
      authorId: comments.authorId,
    });

  // Fetch the comment with author details
  // Note: comment.id is guaranteed to exist since Drizzle .returning() throws on failure
  const [commentWithAuthor] = await ctx.drizzle
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      issueId: comments.issueId,
      authorId: comments.authorId,
      author: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Drizzle .returning() guarantees non-null
    .where(eq(comments.id, comment!.id))
    .limit(1);

  return commentWithAuthor;
}

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
      return createCommentWithAuthor(ctx, input);
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
      return createCommentWithAuthor(ctx, input);
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
      const [comment] = await ctx.drizzle
        .select({
          id: comments.id,
          authorId: comments.authorId,
          deletedAt: comments.deletedAt,
          issue: {
            id: issues.id,
            organizationId: issues.organizationId,
          },
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(comments)
        .innerJoin(issues, eq(comments.issueId, issues.id))
        .innerJoin(users, eq(comments.authorId, users.id))
        .where(
          and(
            eq(comments.id, input.commentId),
            eq(issues.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      if (comment.deletedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot edit deleted comment",
        });
      }

      // Only the author can edit their own comment
      if (comment.authorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own comments",
        });
      }

      // Update the comment
      const [updatedComment] = await ctx.drizzle
        .update(comments)
        .set({
          content: input.content,
        })
        .where(eq(comments.id, input.commentId))
        .returning({
          id: comments.id,
          content: comments.content,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          issueId: comments.issueId,
          authorId: comments.authorId,
        });

      // Fetch the updated comment with author details
      // Note: updatedComment.id is guaranteed to exist since Drizzle .returning() throws on failure
      const [commentWithAuthor] = await ctx.drizzle
        .select({
          id: comments.id,
          content: comments.content,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          issueId: comments.issueId,
          authorId: comments.authorId,
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(comments)
        .innerJoin(users, eq(comments.authorId, users.id))
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Drizzle .returning() guarantees non-null
        .where(eq(comments.id, updatedComment!.id))
        .limit(1);

      return commentWithAuthor;
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
      const [comment] = await ctx.drizzle
        .select({
          id: comments.id,
          authorId: comments.authorId,
          deletedAt: comments.deletedAt,
          issue: {
            id: issues.id,
            organizationId: issues.organizationId,
          },
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(comments)
        .innerJoin(issues, eq(comments.issueId, issues.id))
        .innerJoin(users, eq(comments.authorId, users.id))
        .where(
          and(
            eq(comments.id, input.commentId),
            eq(issues.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      if (comment.deletedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Comment is already deleted",
        });
      }

      // Check permissions: user can delete their own comment, admins can delete any
      const [membership] = await ctx.drizzle
        .select({
          id: memberships.id,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, ctx.user.id),
            eq(memberships.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User is not a member of this organization",
        });
      }

      const canDelete =
        comment.authorId === ctx.user.id ||
        ctx.userPermissions.includes("issue:delete");

      if (!canDelete) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own comments",
        });
      }

      // Soft delete the comment
      const [deletedComment] = await ctx.drizzle
        .update(comments)
        .set({
          deletedAt: new Date(),
          deletedBy: ctx.user.id,
        })
        .where(eq(comments.id, input.commentId))
        .returning({
          id: comments.id,
          content: comments.content,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          deletedAt: comments.deletedAt,
          deletedBy: comments.deletedBy,
          issueId: comments.issueId,
          authorId: comments.authorId,
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
