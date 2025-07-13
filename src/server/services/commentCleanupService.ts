import { type PrismaClient, type Comment } from "@prisma/client";

export class CommentCleanupService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Permanently delete comments that have been soft-deleted for more than 90 days
   */
  async cleanupOldDeletedComments(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await this.prisma.comment.deleteMany({
      where: {
        deletedAt: {
          lte: ninetyDaysAgo,
        },
      },
    });

    return result.count;
  }

  /**
   * Get count of comments that will be cleaned up (for monitoring/reporting)
   */
  async getCleanupCandidateCount(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return this.prisma.comment.count({
      where: {
        deletedAt: {
          lte: ninetyDaysAgo,
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
  async getDeletedComments(organizationId: string): Promise<Comment[]> {
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
