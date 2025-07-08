import { type PrismaClient } from "@prisma/client";

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
}
