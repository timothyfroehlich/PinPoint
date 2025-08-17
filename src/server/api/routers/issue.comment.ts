import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { DrizzleCommentService } from "./utils/commentService";
import {
  validateCommentDeletion,
  validateCommentRestoration,
  validateCommentEdit,
  validateAdminPermissions,
  type ValidationContext,
} from "./utils/commentValidation";

import type { OrganizationTRPCContext } from "~/server/api/trpc.base";

import { generatePrefixedId } from "~/lib/utils/id-generation";
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
): Promise<{
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date | null;
  issueId: string;
  authorId: string;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}> {
  // Verify the issue belongs to this organization
  const [existingIssue] = await ctx.db
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
  const [membership] = await ctx.db
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
  const [comment] = await ctx.db
    .insert(comments)
    .values({
      id: generatePrefixedId("comment"),
      content: input.content,
      organizationId: ctx.organization.id,
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

  if (!comment) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create comment",
    });
  }

  // Fetch the comment with author details
  const [commentWithAuthor] = await ctx.db
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
    .where(eq(comments.id, comment.id))
    .limit(1);

  if (!commentWithAuthor) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch comment with author details",
    });
  }

  return commentWithAuthor;
}

const addCommentProcedure = issueCreateProcedure
  .input(
    z.object({
      issueId: z.string(),
      content: z.string().min(1).max(1000),
    }),
  )
  .mutation(
    async ({
      ctx,
      input,
    }): Promise<{
      id: string;
      content: string;
      createdAt: Date;
      updatedAt: Date | null;
      issueId: string;
      authorId: string;
      author: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
      };
    }> => {
      return createCommentWithAuthor(ctx, input);
    },
  );

export const issueCommentRouter = createTRPCRouter({
  // Add comment to an issue (for members/admins)
  addComment: addCommentProcedure,

  // Alias for addComment (for backward compatibility with tests)
  create: addCommentProcedure,

  // Edit comment (users can only edit their own comments)
  editComment: issueEditProcedure
    .input(
      z.object({
        commentId: z.string(),
        content: z.string().min(1).max(1000),
      }),
    )
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{
        id: string;
        content: string;
        createdAt: Date;
        updatedAt: Date | null;
        issueId: string;
        authorId: string;
        author: {
          id: string;
          name: string | null;
          email: string | null;
          image: string | null;
        };
      }> => {
        // Find the comment and verify permissions
        const [comment] = await ctx.db
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

        // Use validation functions
        const validationContext: ValidationContext = {
          userId: ctx.user.id,
          organizationId: ctx.organization.id,
          userPermissions: ctx.userPermissions,
        };

        const validation = validateCommentEdit(comment, validationContext);
        if (!validation.valid) {
          throw new TRPCError({
            code: validation.error?.includes("not found")
              ? "NOT_FOUND"
              : validation.error?.includes("deleted")
                ? "BAD_REQUEST"
                : "FORBIDDEN",
            message: validation.error ?? "Validation failed",
          });
        }

        // Update the comment
        const [updatedComment] = await ctx.db
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

        if (!updatedComment) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update comment",
          });
        }

        // Fetch the updated comment with author details
        const [commentWithAuthor] = await ctx.db
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
          .where(eq(comments.id, updatedComment.id))
          .limit(1);

        if (!commentWithAuthor) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch updated comment with author details",
          });
        }

        return commentWithAuthor;
      },
    ),

  // Delete comment (users can delete their own, admins can delete any)
  deleteComment: organizationProcedure
    .input(
      z.object({
        commentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the comment and verify permissions
      const [comment] = await ctx.db
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

      // Get membership for validation
      const [membership] = await ctx.db
        .select({
          id: memberships.id,
          userId: memberships.userId,
          organizationId: memberships.organizationId,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, ctx.user.id),
            eq(memberships.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);

      // Use validation functions
      const validationContext: ValidationContext = {
        userId: ctx.user.id,
        organizationId: ctx.organization.id,
        userPermissions: ctx.userPermissions,
      };

      const validation = validateCommentDeletion(
        comment,
        membership ?? null,
        validationContext,
      );
      if (!validation.valid) {
        throw new TRPCError({
          code: validation.error?.includes("not found")
            ? "NOT_FOUND"
            : validation.error?.includes("already deleted")
              ? "BAD_REQUEST"
              : "FORBIDDEN",
          message: validation.error ?? "Validation failed",
        });
      }

      // At this point, validation ensures comment exists
      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Soft delete the comment using service
      const commentService = new DrizzleCommentService(ctx.db);
      const deletedComment = await commentService.softDeleteComment(
        input.commentId,
        ctx.user.id,
      );

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

  // Restore deleted comment (admins only)
  restoreComment: organizationProcedure
    .input(
      z.object({
        commentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the comment and verify it exists and is deleted
      const [comment] = await ctx.db
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

      // Use validation functions
      const validationContext: ValidationContext = {
        userId: ctx.user.id,
        organizationId: ctx.organization.id,
        userPermissions: ctx.userPermissions,
      };

      const validation = validateCommentRestoration(comment, validationContext);
      if (!validation.valid) {
        throw new TRPCError({
          code: validation.error?.includes("not found")
            ? "NOT_FOUND"
            : validation.error?.includes("not deleted")
              ? "BAD_REQUEST"
              : "FORBIDDEN",
          message: validation.error ?? "Validation failed",
        });
      }

      // At this point, validation ensures comment exists
      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Restore the comment using service
      const commentService = new DrizzleCommentService(ctx.db);
      const restoredComment = await commentService.restoreComment(
        input.commentId,
      );

      // Record restoration activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordCommentDeleted(
        comment.issue.id,
        ctx.organization.id,
        ctx.user.id,
        input.commentId,
      );

      return restoredComment;
    }),

  // Get all deleted comments for organization (admin view)
  getDeletedComments: organizationProcedure.query(async ({ ctx }) => {
    // Use validation functions
    const adminValidation = validateAdminPermissions(ctx.userPermissions);
    if (!adminValidation.valid) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Insufficient permissions to view deleted comments",
      });
    }

    const commentService = new DrizzleCommentService(ctx.db);
    return commentService.getDeletedComments(ctx.organization.id);
  }),
});
