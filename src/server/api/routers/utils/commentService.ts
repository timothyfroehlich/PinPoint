import { eq, desc } from "drizzle-orm";

import type { DrizzleClient } from "~/server/db/drizzle";

import { comments, issues, users } from "~/server/db/schema";

/**
 * Comment service utilities for Drizzle operations.
 * This provides reusable comment business logic with Drizzle ORM.
 * TODO: Consolidate with CommentCleanupService for unified comment management.
 */
export class DrizzleCommentService {
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
        deletedAt: new Date(),
        deletedBy: deletedById,
      })
      .where(eq(comments.id, commentId))
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Drizzle update with returning throws on no rows
    return deletedComment!; // Safe because update with returning will throw if no rows affected
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
        deletedAt: null,
        deletedBy: null,
      })
      .where(eq(comments.id, commentId))
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Drizzle update with returning throws on no rows
    return restoredComment!; // Safe because update with returning will throw if no rows affected
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
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        deletedAt: comments.deletedAt,
        deletedBy: comments.deletedBy,
        issueId: comments.issueId,
        authorId: comments.authorId,
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
      .innerJoin(users, eq(comments.authorId, users.id))
      .innerJoin(issues, eq(comments.issueId, issues.id))
      .where(eq(issues.organizationId, organizationId))
      .orderBy(desc(comments.deletedAt));

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
