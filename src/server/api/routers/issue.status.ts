import { count, eq, asc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { issues, issueStatuses } from "~/server/db/schema/issues";

/**
 * Generate UUID with environment fallback support.
 * Uses crypto.randomUUID() when available (Node 14.17+), falls back to uuid library.
 */
function generateId(): string {
  // In Node.js 19+ crypto.randomUUID is always available
  // Keep fallback for older environments during development/testing
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  } else {
    return uuidv4();
  }
}

export const issueStatusRouter = createTRPCRouter({
  // CRUD Operations
  getAll: organizationProcedure.query(async ({ ctx }) => {
    return ctx.drizzle
      .select()
      .from(issueStatuses)
      .where(eq(issueStatuses.organizationId, ctx.organization.id))
      .orderBy(asc(issueStatuses.name));
  }),

  create: organizationManageProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        category: z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.drizzle
        .insert(issueStatuses)
        .values({
          id: generateId(),
          name: input.name,
          category: input.category,
          organizationId: ctx.organization.id,
        })
        .returning();
      return result;
    }),

  update: organizationManageProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        category: z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Build the update object dynamically
      const updateData: Partial<{
        name: string;
        category: "NEW" | "IN_PROGRESS" | "RESOLVED";
      }> = {};

      if (input.name) updateData.name = input.name;
      if (input.category) updateData.category = input.category;

      const [result] = await ctx.drizzle
        .update(issueStatuses)
        .set(updateData)
        .where(
          and(
            eq(issueStatuses.id, input.id),
            eq(issueStatuses.organizationId, ctx.organization.id),
          ),
        )
        .returning();

      return result;
    }),

  delete: organizationManageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if any issues are using this status
      const [issueCountResult] = await ctx.drizzle
        .select({ count: count() })
        .from(issues)
        .where(
          and(
            eq(issues.statusId, input.id),
            eq(issues.organizationId, ctx.organization.id),
          ),
        );

      if (issueCountResult?.count && issueCountResult.count > 0) {
        throw new Error(
          "Cannot delete status that is currently being used by issues",
        );
      }

      const [result] = await ctx.drizzle
        .delete(issueStatuses)
        .where(
          and(
            eq(issueStatuses.id, input.id),
            eq(issueStatuses.organizationId, ctx.organization.id),
          ),
        )
        .returning();

      return result;
    }),

  // Status Counts / Analytics
  getStatusCounts: organizationProcedure.query(async ({ ctx }) => {
    // Get issue counts grouped by statusId using Drizzle aggregation
    const counts = await ctx.drizzle
      .select({
        statusId: issues.statusId,
        count: count(),
      })
      .from(issues)
      .where(eq(issues.organizationId, ctx.organization.id))
      .groupBy(issues.statusId);

    // Get all statuses for the organization
    const statuses = await ctx.drizzle.query.issueStatuses.findMany({
      where: eq(issueStatuses.organizationId, ctx.organization.id),
      columns: {
        id: true,
        category: true,
      },
    });

    // Create status ID to category mapping
    const statusMap = new Map(statuses.map((s) => [s.id, s.category]));

    // Initialize category counts using Drizzle enum values
    const categoryCounts: Record<string, number> = {
      NEW: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
    };

    // Aggregate counts by category
    for (const group of counts) {
      const category = statusMap.get(group.statusId);
      if (category && category in categoryCounts) {
        const validCategory = category as keyof typeof categoryCounts;
        categoryCounts[validCategory] =
          (categoryCounts[validCategory] ?? 0) + group.count;
      }
    }

    return categoryCounts;
  }),
});
