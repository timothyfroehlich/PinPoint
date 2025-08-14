import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { machines, models } from "~/server/db/schema";

export const modelCoreRouter = createTRPCRouter({
  // Enhanced getAll with OPDB metadata
  getAll: organizationProcedure.query(async ({ ctx }) => {
    // Get all game titles that are either:
    // 1. Custom games belonging to this organization
    // 2. Global OPDB games that have instances in this organization
    return await ctx.drizzle.query.models.findMany({
      where: (models, { exists }) =>
        exists(
          ctx.drizzle
            .select({ id: machines.id })
            .from(machines)
            .where(
              and(
                eq(machines.modelId, models.id),
                eq(machines.organizationId, ctx.organization.id),
              ),
            ),
        ),
      orderBy: (models, { asc }) => [asc(models.name)],
      extras: {
        machineCount: sql<number>`(
          SELECT COUNT(*) 
          FROM ${machines} 
          WHERE ${machines.modelId} = ${models.id} 
            AND ${machines.organizationId} = ${ctx.organization.id}
        )`.as("machine_count"),
      },
    });
  }),

  // Get single game title by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const model = await ctx.drizzle.query.models.findFirst({
        where: (models, { and, eq, exists }) =>
          and(
            eq(models.id, input.id),
            exists(
              ctx.drizzle
                .select({ id: machines.id })
                .from(machines)
                .where(
                  and(
                    eq(machines.modelId, models.id),
                    eq(machines.organizationId, ctx.organization.id),
                  ),
                ),
            ),
          ),
        extras: {
          machineCount: sql<number>`(
            SELECT COUNT(*) 
            FROM ${machines} 
            WHERE ${machines.modelId} = ${models.id} 
              AND ${machines.organizationId} = ${ctx.organization.id}
          )`.as("machine_count"),
        },
      });

      if (!model) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game title not found or access denied",
        });
      }

      return model;
    }),

  // Delete game title (only if no game instances exist)
  delete: organizationManageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the game title belongs to this organization or is a global OPDB game
      const model = await ctx.drizzle.query.models.findFirst({
        where: (models, { and, eq, exists }) =>
          and(
            eq(models.id, input.id),
            exists(
              ctx.drizzle
                .select({ id: machines.id })
                .from(machines)
                .where(
                  and(
                    eq(machines.modelId, models.id),
                    eq(machines.organizationId, ctx.organization.id),
                  ),
                ),
            ),
          ),
        extras: {
          machineCount: sql<number>`(
            SELECT COUNT(*) 
            FROM ${machines} 
            WHERE ${machines.modelId} = ${models.id} 
              AND ${machines.organizationId} = ${ctx.organization.id}
          )`.as("machine_count"),
        },
      });

      if (!model) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game title not found or access denied",
        });
      }

      if (model.isCustom) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete custom games. Remove game instances instead.",
        });
      }

      if (model.machineCount > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete game title that has game instances",
        });
      }

      const [deletedModel] = await ctx.drizzle
        .delete(models)
        .where(eq(models.id, input.id))
        .returning();

      return deletedModel;
    }),
});
