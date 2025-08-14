import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, organizationProcedure } from "~/server/api/trpc";
import { issues } from "~/server/db/schema";

export const issueTimelineRouter = createTRPCRouter({
  // Get issue timeline (comments + activities)
  getTimeline: organizationProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify the issue belongs to this organization
      const issue = await ctx.drizzle.query.issues.findFirst({
        where: and(
          eq(issues.id, input.issueId),
          eq(issues.organizationId, ctx.organization.id),
        ),
        columns: {
          id: true,
        },
      });

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found or access denied",
        });
      }

      const activityService = ctx.services.createIssueActivityService();
      return activityService.getIssueTimeline(
        input.issueId,
        ctx.organization.id,
      );
    }),
});
