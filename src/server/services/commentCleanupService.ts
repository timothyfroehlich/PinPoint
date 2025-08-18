import { and, eq, lte, isNotNull } from "drizzle-orm";
import { type InferSelectModel } from "drizzle-orm";

import { COMMENT_CLEANUP_CONFIG } from "~/server/constants/cleanup";
import { type DrizzleClient } from "~/server/db/drizzle";
import { comments, issues } from "~/server/db/schema";

// Infer Comment type from Drizzle schema
type Comment = InferSelectModel<typeof comments> & {
  author: {
    id: string;
    name: string | null;
  } | null;
  deleter: {
    id: string;
    name: string | null;
  } | null;
  issue: {
    id: string;
    title: string;
  };
};

export class CommentCleanupService {
  constructor(private db: DrizzleClient) {}

  /**
   * Permanently delete comments that have been soft-deleted for more than the configured retention period
   */
  async cleanupOldDeletedComments(): Promise<number> {
    const retentionCutoff = new Date();
    retentionCutoff.setDate(
      retentionCutoff.getDate() - COMMENT_CLEANUP_CONFIG.RETENTION_DAYS,
    );

    const deletedComments = await this.db
      .delete(comments)
      .where(
        and(
          isNotNull(comments.deletedAt),
          lte(comments.deletedAt, retentionCutoff),
        ),
      )
      .returning({ id: comments.id });

    return deletedComments.length;
  }

  /**
   * Get count of comments that will be cleaned up (for monitoring/reporting)
   */
  async getCleanupCandidateCount(): Promise<number> {
    const retentionCutoff = new Date();
    retentionCutoff.setDate(
      retentionCutoff.getDate() - COMMENT_CLEANUP_CONFIG.RETENTION_DAYS,
    );

    const candidateComments = await this.db
      .select({ id: comments.id })
      .from(comments)
      .where(
        and(
          isNotNull(comments.deletedAt),
          lte(comments.deletedAt, retentionCutoff),
        ),
      );

    return candidateComments.length;
  }

  /**
   * Soft delete a comment (mark as deleted without removing from database)
   */
  async softDeleteComment(
    commentId: string,
    deletedById: string,
  ): Promise<void> {
    await this.db
      .update(comments)
      .set({
        deletedAt: new Date(),
        deletedBy: deletedById,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId));
  }

  /**
   * Restore a soft-deleted comment
   */
  async restoreComment(commentId: string): Promise<void> {
    await this.db
      .update(comments)
      .set({
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId));
  }

  /**
   * Get all soft-deleted comments for an organization (admin view)
   * RLS automatically scopes to user's organization
   */
  async getDeletedComments(): Promise<Comment[]> {
    const deletedComments = await this.db.query.comments.findMany({
      where: isNotNull(comments.deletedAt),
      with: {
        author: {
          columns: {
            id: true,
            name: true,
          },
        },
        deleter: {
          columns: {
            id: true,
            name: true,
          },
        },
        issue: {
          columns: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: (comments, { desc }) => [desc(comments.deletedAt)],
    });

    return deletedComments as Comment[];
  }
}
