import { eq, count, asc, and } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import * as schema from "~/server/db/schema";

export const issueStatusRouter = createTRPCRouter({
  getAll: organizationProcedure.query(async ({ ctx }) => {
    return ctx.drizzle
      .select()
      .from(schema.issueStatuses)
      .where(eq(schema.issueStatuses.organizationId, ctx.organization.id))
      .orderBy(asc(schema.issueStatuses.name));
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
        .insert(schema.issueStatuses)
        .values({
          id: crypto.randomUUID(),
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
        .update(schema.issueStatuses)
        .set(updateData)
        .where(
          and(
            eq(schema.issueStatuses.id, input.id),
            eq(schema.issueStatuses.organizationId, ctx.organization.id),
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
        .from(schema.issues)
        .where(
          and(
            eq(schema.issues.statusId, input.id),
            eq(schema.issues.organizationId, ctx.organization.id),
          ),
        );

      if (issueCountResult?.count && issueCountResult.count > 0) {
        throw new Error(
          "Cannot delete status that is currently being used by issues",
        );
      }

      const [result] = await ctx.drizzle
        .delete(schema.issueStatuses)
        .where(
          and(
            eq(schema.issueStatuses.id, input.id),
            eq(schema.issueStatuses.organizationId, ctx.organization.id),
          ),
        )
        .returning();

      return result;
    }),
});
