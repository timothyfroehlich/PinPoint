import { eq, desc } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

import type { DrizzleClient } from "~/server/db/drizzle";

import { comments, issues, users } from "~/server/db/schema";
import {
  transformKeysToCamelCase,
  type DrizzleToCamelCase,
} from "~/lib/utils/case-transformers";

// Type definitions for service responses
type CommentDbModel = InferSelectModel<typeof comments>;
type CommentResponse = DrizzleToCamelCase<CommentDbModel>;

type CommentWithRelations = InferSelectModel<typeof comments> & {
  author: Pick<
    InferSelectModel<typeof users>,
    "id" | "name" | "email" | "image"
  >;
  deleter: Pick<
    InferSelectModel<typeof users>,
    "id" | "name" | "email" | "image"
  > | null;
  issue: Pick<InferSelectModel<typeof issues>, "id" | "title">;
};
type CommentWithRelationsResponse = DrizzleToCamelCase<CommentWithRelations>;

/**
 * Comment service utilities.
 * This provides reusable comment business logic.
 * TODO: Consolidate with CommentCleanupService for unified comment management.
 */
export class CommentService {
  constructor(private drizzle: DrizzleClient) {}

  /**
   * Soft delete a comment (mark as deleted without removing from database)
   */
  async softDeleteComment(
    commentId: string,
    deletedById: string,
  ): Promise<{
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    deletedBy: string | null;
    issueId: string;
    authorId: string;
  }> {
    const [deletedComment] = await this.drizzle
      .update(comments)
      .set({
        deleted_at: new Date(),
        deleted_by: deletedById,
      })
      .where(eq(comments.id, commentId))
      .returning({
        id: comments.id,
        content: comments.content,
        created_at: comments.created_at,
        updated_at: comments.updated_at,
        deleted_at: comments.deleted_at,
        deleted_by: comments.deleted_by,
        issue_id: comments.issue_id,
        author_id: comments.author_id,
      });

    if (!deletedComment) {
      throw new Error(`Comment with id ${commentId} not found`);
    }

    return transformKeysToCamelCase(deletedComment) as CommentResponse;
  }

  /**
   * Restore a soft-deleted comment
   */
  async restoreComment(commentId: string): Promise<{
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    deletedBy: string | null;
    issueId: string;
    authorId: string;
  }> {
    const [restoredComment] = await this.drizzle
      .update(comments)
      .set({
        deleted_at: null,
        deleted_by: null,
      })
      .where(eq(comments.id, commentId))
      .returning({
        id: comments.id,
        content: comments.content,
        created_at: comments.created_at,
        updated_at: comments.updated_at,
        deleted_at: comments.deleted_at,
        deleted_by: comments.deleted_by,
        issue_id: comments.issue_id,
        author_id: comments.author_id,
      });

    if (!restoredComment) {
      throw new Error(`Comment with id ${commentId} not found`);
    }

    return transformKeysToCamelCase(restoredComment) as CommentResponse;
  }

  /**
   * Get all soft-deleted comments for an organization (admin view)
   */
  async getDeletedComments(organizationId: string): Promise<
    {
      id: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      deletedBy: string | null;
      issueId: string;
      authorId: string;
      author: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
      };
      deleter: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
      } | null;
      issue: {
        id: string;
        title: string;
      };
    }[]
  > {
    // Create subquery to get deleter info
    const result = await this.drizzle
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
          email: users.email,
          image: users.image,
        },
        issue: {
          id: issues.id,
          title: issues.title,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.author_id, users.id))
      .innerJoin(issues, eq(comments.issue_id, issues.id))
      .where(eq(issues.organization_id, organizationId))
      .orderBy(desc(comments.deleted_at));

    // For each comment, if it has a deleter, fetch deleter info
    const commentsWithDeleters = await Promise.all(
      result.map(async (comment) => {
        let deleter = null;
        if (comment.deleted_by) {
          const [deleterUser] = await this.drizzle
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
            })
            .from(users)
            .where(eq(users.id, comment.deleted_by))
            .limit(1);
          deleter = deleterUser ?? null;
        }
        return {
          ...comment,
          deleter,
        };
      }),
    );

    // Filter to only deleted comments and transform to camelCase
    const deletedComments = commentsWithDeleters.filter(
      (comment) => comment.deleted_at !== null,
    );
    return deletedComments.map((comment) =>
      transformKeysToCamelCase(comment),
    ) as CommentWithRelationsResponse[];
  }
}
