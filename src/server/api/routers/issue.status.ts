import { StatusCategory } from "@prisma/client";

import { createTRPCRouter, organizationProcedure } from "~/server/api/trpc";

type StatusCounts = Record<StatusCategory, number>;

export const issueStatusRouter = createTRPCRouter({
  // Get counts for each status category
  getStatusCounts: organizationProcedure.query(
    async ({ ctx }): Promise<StatusCounts> => {
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

      const statusMap = new Map(
        statuses.map((s) => [s.id, s.category] as [string, StatusCategory]),
      );

      const categoryCounts: StatusCounts = {
        [StatusCategory.NEW]: 0,
        [StatusCategory.IN_PROGRESS]: 0,
        [StatusCategory.RESOLVED]: 0,
        [StatusCategory.CLOSED]: 0,
      };

      for (const group of counts) {
        if (group.statusId) {
          const category = statusMap.get(group.statusId);
          if (category) {
            categoryCounts[category] += Number(group._count._all);
          }
        }
      }

      return categoryCounts;
    },
  ),
});
