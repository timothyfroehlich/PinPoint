import {
  createTRPCRouter,
  organizationManageProcedure,
} from "~/server/api/trpc";

export const issueAdminRouter = createTRPCRouter({
  // Cleanup old deleted comments (admin only)
  cleanupDeletedComments: organizationManageProcedure.mutation(
    async ({ ctx }) => {
      const cleanupService = ctx.services.createCommentCleanupService();
      const deletedCount = await cleanupService.cleanupOldDeletedComments();

      return {
        deletedCount,
        message: `Successfully deleted ${String(deletedCount)} old comments`,
      };
    },
  ),
});
