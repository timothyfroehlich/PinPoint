import { eq, count } from "drizzle-orm";

import { createTRPCRouter, organizationProcedure } from "~/server/api/trpc";
import { issues, issueStatuses } from "~/server/db/schema";

// Status category enum values
const StatusCategory = {
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
} as const;

type StatusCategoryType = (typeof StatusCategory)[keyof typeof StatusCategory];

function isValidStatusCategory(
  category: string,
): category is StatusCategoryType {
  return Object.values(StatusCategory).includes(category as StatusCategoryType);
}

export const issueStatusRouter = createTRPCRouter({
  // Get counts for each status category
  getStatusCounts: organizationProcedure.query(async ({ ctx }) => {
    // Get all statuses with their categories for this organization
    const statuses = await ctx.drizzle
      .select({
        id: issueStatuses.id,
        category: issueStatuses.category,
      })
      .from(issueStatuses)
      .where(eq(issueStatuses.organizationId, ctx.organization.id));

    const statusMap = new Map(statuses.map((s) => [s.id, s.category]));

    // Get issue counts grouped by status using Drizzle groupBy
    const counts = await ctx.drizzle
      .select({
        statusId: issues.statusId,
        count: count(issues.id).as("count"),
      })
      .from(issues)
      .where(eq(issues.organizationId, ctx.organization.id))
      .groupBy(issues.statusId);

    const categoryCounts = {
      [StatusCategory.NEW]: 0,
      [StatusCategory.IN_PROGRESS]: 0,
      [StatusCategory.RESOLVED]: 0,
    };

    for (const group of counts) {
      const category = statusMap.get(group.statusId);
      if (category && isValidStatusCategory(category)) {
        categoryCounts[category] += Number(group.count);
      }
    }

    return categoryCounts;
  }),
});
