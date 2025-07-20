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
      // Add type assertion for the group object properties
      const groupTyped = group as {
        statusId: string;
        _count: { _all: number };
      };
      const category = statusMap.get(groupTyped.statusId);
      if (category && Object.values(StatusCategory).includes(category)) {
        categoryCounts[category] += Number(groupTyped._count._all);
      }
    }

    return categoryCounts;
  }),
});
