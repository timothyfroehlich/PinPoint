import { eq, desc } from "drizzle-orm";

import type { DrizzleClient } from "~/server/db/drizzle";

import { comments, issues, users } from "~/server/db/schema";

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
        createdAt: comments.created_at,
        updatedAt: comments.updated_at,
        deletedAt: comments.deleted_at,
        deletedBy: comments.deleted_by,
        issueId: comments.issue_id,
        authorId: comments.author_id,
      });

    if (!deletedComment) {
      throw new Error(`Comment with id ${commentId} not found`);
    }

    return deletedComment;
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
        createdAt: comments.created_at,
        updatedAt: comments.updated_at,
        deletedAt: comments.deleted_at,
        deletedBy: comments.deleted_by,
        issueId: comments.issue_id,
        authorId: comments.author_id,
      });

    if (!restoredComment) {
      throw new Error(`Comment with id ${commentId} not found`);
    }

    return restoredComment;
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
        createdAt: comments.created_at,
        updatedAt: comments.updated_at,
        deletedAt: comments.deleted_at,
        deletedBy: comments.deleted_by,
        issueId: comments.issue_id,
        authorId: comments.author_id,
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
        if (comment.deletedBy) {
          const [deleterUser] = await this.drizzle
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
            })
            .from(users)
            .where(eq(users.id, comment.deletedBy))
            .limit(1);
          deleter = deleterUser ?? null;
        }
        return {
          ...comment,
          deleter,
        };
      }),
    );

    // Filter to only deleted comments
    return commentsWithDeleters.filter((comment) => comment.deletedAt !== null);
  }
}
