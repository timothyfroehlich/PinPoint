import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Validation schemas
import { idSchema, issueIdSchema, commentContentSchema } from "~/lib/validation/schemas";

import { CommentService } from "./utils/commentService";
import {
  validateCommentDeletion,
  validateCommentRestoration,
  validateCommentEdit,
  validateAdminPermissions,
  type ValidationContext,
} from "./utils/commentValidation";

import type { RLSOrganizationTRPCContext } from "~/server/api/trpc.base";

import { generatePrefixedId } from "~/lib/utils/id-generation";
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";
import { transformCommentWithAuthorResponse } from "~/lib/utils/api-response-transformers";
import type { CommentWithAuthorResponse } from "~/lib/types/api";
import {
  createTRPCRouter,
  organizationProcedure,
  issueCreateProcedure,
  issueEditProcedure,
} from "~/server/api/trpc";
import { comments, issues, memberships, users } from "~/server/db/schema";

// Using centralized CommentWithAuthorResponse type from ~/lib/types/api

// Helper function to create a comment with author details
async function createCommentWithAuthor(
  ctx: RLSOrganizationTRPCContext,
  input: { issueId: string; content: string },
): Promise<CommentWithAuthorResponse> {
  // Verify the issue exists (RLS handles org scoping)
  const [existingIssue] = await ctx.db
    .select({
      id: issues.id,
    })
    .from(issues)
    .where(eq(issues.id, input.issueId))
    .limit(1);

  if (!existingIssue) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Issue not found",
    });
  }

  // Verify the user is a member (RLS handles org scoping)
  const [membership] = await ctx.db
    .select({
      id: memberships.id,
    })
    .from(memberships)
    .where(eq(memberships.user_id, ctx.user.id))
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
      issue_id: input.issueId,
      author_id: ctx.user.id,
      organization_id: ctx.organization.id,
    })
    .returning({
      id: comments.id,
      content: comments.content,
      created_at: comments.created_at,
      updated_at: comments.updated_at,
      issue_id: comments.issue_id,
      author_id: comments.author_id,
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
      created_at: comments.created_at,
      updated_at: comments.updated_at,
      issue_id: comments.issue_id,
      author_id: comments.author_id,
      author: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.author_id, users.id))
    .where(eq(comments.id, comment.id))
    .limit(1);

  if (!commentWithAuthor) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch comment with author details",
    });
  }

  // Author is guaranteed to be present due to innerJoin
  const result = transformCommentWithAuthorResponse(commentWithAuthor);
  return {
    ...result,
    author: result.author,
  };
}

const addCommentProcedure = issueCreateProcedure
  .input(
    z.object({
      issueId: issueIdSchema,
      content: commentContentSchema,
    }),
  )
  .mutation(async ({ ctx, input }): Promise<CommentWithAuthorResponse> => {
    return createCommentWithAuthor(ctx, input);
  });

export const issueCommentRouter = createTRPCRouter({
  // Add comment to an issue (for members/admins)
  addComment: addCommentProcedure,

  // Alias for addComment (for backward compatibility with tests)
  create: addCommentProcedure,

  // Edit comment (users can only edit their own comments)
  editComment: issueEditProcedure
    .input(
      z.object({
        commentId: idSchema,
        content: commentContentSchema,
      }),
    )
    .mutation(async ({ ctx, input }): Promise<CommentWithAuthorResponse> => {
      // Find the comment and verify permissions (RLS handles org scoping)
      const [comment] = await ctx.db
        .select({
          id: comments.id,
          author_id: comments.author_id,
          deleted_at: comments.deleted_at,
          issue: {
            id: issues.id,
            organization_id: issues.organization_id,
          },
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(comments)
        .innerJoin(issues, eq(comments.issue_id, issues.id))
        .innerJoin(users, eq(comments.author_id, users.id))
        .where(eq(comments.id, input.commentId))
        .limit(1);

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Use validation functions
      const validationContext: ValidationContext = {
        userId: ctx.user.id,
        organizationId: ctx.organization.id,
        userPermissions: ctx.userPermissions,
      };

      // Transform comment data to camelCase for validation
      const transformedComment = transformCommentWithAuthorResponse(comment);
      const commentData = {
        id: transformedComment.id,
        authorId: transformedComment.authorId,
        deletedAt: transformedComment.deletedAt,
        issue: {
          id: transformedComment.issueId,
          organizationId: comment.issue.organization_id, // Safe access
        },
      };

      const validation = validateCommentEdit(commentData, validationContext);
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
          created_at: comments.created_at,
          updated_at: comments.updated_at,
          issue_id: comments.issue_id,
          author_id: comments.author_id,
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
          created_at: comments.created_at,
          updated_at: comments.updated_at,
          issue_id: comments.issue_id,
          author_id: comments.author_id,
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(comments)
        .innerJoin(users, eq(comments.author_id, users.id))
        .where(eq(comments.id, updatedComment.id))
        .limit(1);

      if (!commentWithAuthor) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch updated comment with author details",
        });
      }

      return transformKeysToCamelCase(
        commentWithAuthor,
      ) as CommentWithAuthorResponse;
    }),

  // Delete comment (users can delete their own, admins can delete any)
  deleteComment: organizationProcedure
    .input(
      z.object({
        commentId: idSchema,
      }),
    )
    .mutation(async ({ ctx, input }): Promise<object> => {
      // Find the comment and verify permissions (RLS handles org scoping)
      const [comment] = await ctx.db
        .select({
          id: comments.id,
          author_id: comments.author_id,
          deleted_at: comments.deleted_at,
          issue: {
            id: issues.id,
            organization_id: issues.organization_id,
          },
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(comments)
        .innerJoin(issues, eq(comments.issue_id, issues.id))
        .innerJoin(users, eq(comments.author_id, users.id))
        .where(eq(comments.id, input.commentId))
        .limit(1);

      // Get membership for validation (RLS handles org scoping)
      const [membership] = await ctx.db
        .select({
          id: memberships.id,
          user_id: memberships.user_id,
          organization_id: memberships.organization_id,
        })
        .from(memberships)
        .where(eq(memberships.user_id, ctx.user.id))
        .limit(1);

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Use validation functions
      const validationContext: ValidationContext = {
        userId: ctx.user.id,
        organizationId: ctx.organization.id,
        userPermissions: ctx.userPermissions,
      };

      // Transform comment data to camelCase for validation
      const transformedComment = transformCommentWithAuthorResponse(comment);
      const commentData = {
        id: transformedComment.id,
        authorId: transformedComment.authorId,
        deletedAt: transformedComment.deletedAt,
        issue: {
          id: transformedComment.issueId,
          organizationId: comment.issue.organization_id, // Safe access
        },
      };

      // Transform membership data to camelCase for validation
      const transformedMembership = membership
        ? {
            id: membership.id,
            userId: membership.user_id,
            organizationId: membership.organization_id,
          }
        : null;

      const validation = validateCommentDeletion(
        commentData,
        transformedMembership,
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

      // Soft delete the comment using service
      const commentService = new CommentService(ctx.db);
      const deletedComment = await commentService.softDeleteComment(
        input.commentId,
        ctx.user.id,
      );

      // Record deletion activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordCommentDeleted(
        comment.issue.id,
        ctx.user.id,
        input.commentId,
      );

      return deletedComment;
    }),

  // Restore deleted comment (admins only)
  restoreComment: organizationProcedure
    .input(
      z.object({
        commentId: idSchema,
      }),
    )
    .mutation(async ({ ctx, input }): Promise<object> => {
      // Find the comment and verify it exists and is deleted (RLS handles org scoping)
      const [comment] = await ctx.db
        .select({
          id: comments.id,
          author_id: comments.author_id,
          deleted_at: comments.deleted_at,
          issue: {
            id: issues.id,
            organization_id: issues.organization_id,
          },
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(comments)
        .innerJoin(issues, eq(comments.issue_id, issues.id))
        .innerJoin(users, eq(comments.author_id, users.id))
        .where(eq(comments.id, input.commentId))
        .limit(1);

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Use validation functions
      const validationContext: ValidationContext = {
        userId: ctx.user.id,
        organizationId: ctx.organization.id,
        userPermissions: ctx.userPermissions,
      };

      // Transform comment data to camelCase for validation
      const transformedComment = transformCommentWithAuthorResponse(comment);
      const commentData = {
        id: transformedComment.id,
        authorId: transformedComment.authorId,
        deletedAt: transformedComment.deletedAt,
        issue: {
          id: transformedComment.issueId,
          organizationId: comment.issue.organization_id, // Safe access
        },
      };

      const validation = validateCommentRestoration(
        commentData,
        validationContext,
      );
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

      // Restore the comment using service
      const commentService = new CommentService(ctx.db);
      const restoredComment = await commentService.restoreComment(
        input.commentId,
      );

      // Record restoration activity
      const activityService = ctx.services.createIssueActivityService();
      await activityService.recordCommentRestored(
        comment.issue.id,
        ctx.user.id,
        input.commentId,
      );

      return restoredComment;
    }),

  // Get all deleted comments for organization (admin view)
  getDeletedComments: organizationProcedure.query(
    async ({ ctx }): Promise<CommentWithAuthorResponse[]> => {
      // Use validation functions
      const adminValidation = validateAdminPermissions(ctx.userPermissions);
      if (!adminValidation.valid) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient permissions to view deleted comments",
        });
      }

      const commentService = new CommentService(ctx.db);
      const deletedComments = await commentService.getDeletedComments(
        ctx.organization.id,
      );
      return transformKeysToCamelCase(
        deletedComments,
      ) as CommentWithAuthorResponse[];
    },
  ),
});
