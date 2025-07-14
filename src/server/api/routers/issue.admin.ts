import {
  createTRPCRouter,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { CommentCleanupService } from "~/server/services/commentCleanupService";

export const issueAdminRouter = createTRPCRouter({
  // Cleanup old deleted comments (admin only)
  cleanupDeletedComments: organizationManageProcedure.mutation(
    async ({ ctx }) => {
      const cleanupService = new CommentCleanupService(ctx.db);
      const deletedCount = await cleanupService.cleanupOldDeletedComments();

      return {
        deletedCount,
        message: `Successfully deleted ${deletedCount} old comments`,
      };
    },
  ),
});
