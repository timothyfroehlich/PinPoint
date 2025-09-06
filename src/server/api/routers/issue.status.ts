import { count, eq, asc } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

// Validation schemas
import {
  idSchema,
  statusNameSchema,
  optionalStatusNameSchema,
  statusCategorySchema,
  optionalStatusCategorySchema,
} from "~/lib/validation/schemas";

import {
  transformKeysToCamelCase,
  type DrizzleToCamelCase,
} from "~/lib/utils/case-transformers";
import { createTRPCRouter, orgScopedProcedure } from "~/server/api/trpc";
import { issues, issueStatuses } from "~/server/db/schema/issues";

// Type definitions for API responses
type IssueStatusDbModel = InferSelectModel<typeof issueStatuses>;
type IssueStatusResponse = DrizzleToCamelCase<IssueStatusDbModel>;

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
  getAll: orgScopedProcedure.query(
    async ({ ctx }): Promise<IssueStatusResponse[]> => {
      const statuses = await ctx.db
        .select()
        .from(issueStatuses)
        .orderBy(asc(issueStatuses.name));
      return transformKeysToCamelCase(statuses) as IssueStatusResponse[];
    },
  ),

  create: orgScopedProcedure
    .input(
      z.object({
        name: statusNameSchema,
        category: statusCategorySchema,
      }),
    )
    .mutation(async ({ ctx, input }): Promise<IssueStatusResponse> => {
      const [result] = await ctx.db
        .insert(issueStatuses)
        .values({
          id: generateId(),
          name: input.name,
          category: input.category,
          organization_id: ctx.organizationId,
        })
        .returning();
      return transformKeysToCamelCase(result) as IssueStatusResponse;
    }),

  update: orgScopedProcedure
    .input(
      z.object({
        id: idSchema,
        name: optionalStatusNameSchema,
        category: optionalStatusCategorySchema,
      }),
    )
    .mutation(async ({ ctx, input }): Promise<IssueStatusResponse> => {
      // Build the update object dynamically
      const updateData: Partial<{
        name: string;
        category: "NEW" | "IN_PROGRESS" | "RESOLVED";
      }> = {};

      if (input.name) updateData.name = input.name;
      if (input.category) updateData.category = input.category;

      const [result] = await ctx.db
        .update(issueStatuses)
        .set(updateData)
        .where(eq(issueStatuses.id, input.id))
        .returning();

      return transformKeysToCamelCase(result) as IssueStatusResponse;
    }),

  delete: orgScopedProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }): Promise<IssueStatusResponse> => {
      // Check if any issues are using this status (RLS handles org scoping)
      const [issueCountResult] = await ctx.db
        .select({ count: count() })
        .from(issues)
        .where(eq(issues.status_id, input.id));

      if (issueCountResult?.count && issueCountResult.count > 0) {
        throw new Error(
          "Cannot delete status that is currently being used by issues",
        );
      }

      const [result] = await ctx.db
        .delete(issueStatuses)
        .where(eq(issueStatuses.id, input.id))
        .returning();

      return transformKeysToCamelCase(result) as IssueStatusResponse;
    }),

  // Status Counts / Analytics
  getStatusCounts: orgScopedProcedure.query(async ({ ctx }) => {
    // Get issue counts grouped by statusId using Drizzle aggregation (RLS handles org scoping)
    const counts = await ctx.db
      .select({
        status_id: issues.status_id,
        count: count(),
      })
      .from(issues)
      .groupBy(issues.status_id);

    // Get all statuses (RLS handles org scoping)
    const statuses = await ctx.db
      .select({
        id: issueStatuses.id,
        category: issueStatuses.category,
      })
      .from(issueStatuses);

    // Create status ID to category mapping
    const statusMap = new Map(statuses.map((s) => [s.id, s.category]));

    // Initialize category counts using Drizzle enum values
    const categoryCounts = {
      NEW: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
    };

    // Type guard to ensure category is a valid key
    function isValidCategory(
      category: string,
    ): category is keyof typeof categoryCounts {
      return category in categoryCounts;
    }

    // Aggregate counts by category
    for (const group of counts) {
      // Type assertion needed due to Drizzle query result typing
      const statusId = group.status_id;
      const category = statusMap.get(statusId);
      if (category !== undefined && isValidCategory(category)) {
        // Use type-safe property access instead of bracket notation
        // eslint-disable-next-line security/detect-object-injection -- category is validated by isValidCategory and type-constrained
        const currentCount = categoryCounts[category];
        // eslint-disable-next-line security/detect-object-injection -- category is validated by isValidCategory and type-constrained
        categoryCounts[category] = currentCount + group.count;
      }
    }

    return categoryCounts;
  }),
});
