import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, orgScopedProcedure } from "~/server/api/trpc";
import { issues } from "~/server/db/schema";

export const issueTimelineRouter = createTRPCRouter({
  // Get issue timeline (comments + activities)
  getTimeline: orgScopedProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify the issue exists (RLS handles org scoping)
      const issue = await ctx.db
        .select({ id: issues.id })
        .from(issues)
        .where(eq(issues.id, input.issueId))
        .limit(1);

      if (issue.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found or access denied",
        });
      }

      const activityService = ctx.services.createIssueActivityService();
      return activityService.getIssueTimeline(input.issueId);
    }),
});
