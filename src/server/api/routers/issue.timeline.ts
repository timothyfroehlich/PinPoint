import { z } from "zod";

import { createTRPCRouter, organizationProcedure } from "~/server/api/trpc";
import { IssueActivityService } from "~/server/services/issueActivityService";

export const issueTimelineRouter = createTRPCRouter({
  // Get issue timeline (comments + activities)
  getTimeline: organizationProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify the issue belongs to this organization
      const issue = await ctx.db.issue.findFirst({
        where: {
          id: input.issueId,
          organizationId: ctx.organization.id,
        },
        select: {
          id: true,
        },
      });

      if (!issue) {
        throw new Error("Issue not found");
      }

      const activityService = new IssueActivityService(ctx.db);
      return activityService.getIssueTimeline(
        input.issueId,
        ctx.organization.id,
      );
    }),
});
