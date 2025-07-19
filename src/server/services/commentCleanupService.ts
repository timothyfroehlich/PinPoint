import { type Comment, type ExtendedPrismaClient } from "./types";

import { COMMENT_CLEANUP_CONFIG } from "~/server/constants/cleanup";

export class CommentCleanupService {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Permanently delete comments that have been soft-deleted for more than the configured retention period
   */
  async cleanupOldDeletedComments(): Promise<number> {
    const retentionCutoff = new Date();
    retentionCutoff.setDate(
      retentionCutoff.getDate() - COMMENT_CLEANUP_CONFIG.RETENTION_DAYS,
    );

    const result: { count: number } = await this.prisma.comment.deleteMany({
      where: {
        deletedAt: {
          lte: retentionCutoff,
        },
      },
    });

    return result.count;
  }

  /**
   * Get count of comments that will be cleaned up (for monitoring/reporting)
   */
  getCleanupCandidateCount(): Promise<number> {
    const retentionCutoff = new Date();
    retentionCutoff.setDate(
      retentionCutoff.getDate() - COMMENT_CLEANUP_CONFIG.RETENTION_DAYS,
    );

    return this.prisma.comment.count({
      where: {
        deletedAt: {
          lte: retentionCutoff,
        },
      },
    });
  }

  /**
   * Soft delete a comment (mark as deleted without removing from database)
   */
  async softDeleteComment(
    commentId: string,
    deletedById: string,
  ): Promise<void> {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
        deletedBy: deletedById,
      },
    });
  }

  /**
   * Restore a soft-deleted comment
   */
  async restoreComment(commentId: string): Promise<void> {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  /**
   * Get all soft-deleted comments for an organization (admin view)
   */
  getDeletedComments(organizationId: string): Promise<Comment[]> {
    return this.prisma.comment.findMany({
      where: {
        deletedAt: { not: null },
        issue: {
          organizationId,
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        deleter: {
          select: {
            id: true,
            name: true,
          },
        },
        issue: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        deletedAt: "desc",
      },
    });
  }
}
