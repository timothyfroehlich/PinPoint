import { StatusCategory } from "@prisma/client";

import { createTRPCRouter, organizationProcedure } from "~/server/api/trpc";

export const issueStatusRouter = createTRPCRouter({
  // Get counts for each status category
  getStatusCounts: organizationProcedure.query(async ({ ctx }) => {
    const counts = await ctx.db.issue.groupBy({
      by: ["statusId"],
      where: {
        organizationId: ctx.organization.id,
      },
      _count: {
        _all: true,
      },
    });

    const statuses = await ctx.db.issueStatus.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
    });

    const statusMap = new Map(statuses.map((s) => [s.id, s.category]));

    const categoryCounts = {
      [StatusCategory.NEW]: 0,
      [StatusCategory.IN_PROGRESS]: 0,
      [StatusCategory.RESOLVED]: 0,
    };

    for (const group of counts) {
      const category = statusMap.get(group.statusId);
      if (category) {
        categoryCounts[category] += group._count._all;
      }
    }

    return categoryCounts;
  }),
});
