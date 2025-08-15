import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
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

    // Get distinct model IDs that have machines in this organization
    const modelIdsWithMachinesResult = await ctx.drizzle
      .selectDistinct({ modelId: machines.modelId })
      .from(machines)
      .where(eq(machines.organizationId, ctx.organization.id));

    const modelIdsWithMachines = modelIdsWithMachinesResult.map(
      (row) => row.modelId,
    );

    if (modelIdsWithMachines.length === 0) {
      return [];
    }

    return await ctx.drizzle
      .select({
        id: models.id,
        name: models.name,
        manufacturer: models.manufacturer,
        year: models.year,
        ipdbId: models.ipdbId,
        opdbId: models.opdbId,
        machineType: models.machineType,
        machineDisplay: models.machineDisplay,
        isActive: models.isActive,
        ipdbLink: models.ipdbLink,
        opdbImgUrl: models.opdbImgUrl,
        kineticistUrl: models.kineticistUrl,
        isCustom: models.isCustom,
        createdAt: models.createdAt,
        updatedAt: models.updatedAt,
        machineCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM "Machine" m 
          WHERE m."modelId" = "Model"."id" 
            AND m."organizationId" = ${ctx.organization.id}::text
        )`.as("machine_count"),
      })
      .from(models)
      .where(inArray(models.id, modelIdsWithMachines))
      .orderBy(models.name);
  }),

  // Get single game title by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get distinct model IDs that have machines in this organization
      const modelIdsWithMachinesResult = await ctx.drizzle
        .selectDistinct({ modelId: machines.modelId })
        .from(machines)
        .where(eq(machines.organizationId, ctx.organization.id));

      const modelIdsWithMachines = modelIdsWithMachinesResult.map(
        (row) => row.modelId,
      );

      const model = await ctx.drizzle
        .select({
          id: models.id,
          name: models.name,
          manufacturer: models.manufacturer,
          year: models.year,
          ipdbId: models.ipdbId,
          opdbId: models.opdbId,
          machineType: models.machineType,
          machineDisplay: models.machineDisplay,
          isActive: models.isActive,
          ipdbLink: models.ipdbLink,
          opdbImgUrl: models.opdbImgUrl,
          kineticistUrl: models.kineticistUrl,
          isCustom: models.isCustom,
          createdAt: models.createdAt,
          updatedAt: models.updatedAt,
          machineCount: sql<number>`(
            SELECT COUNT(*)::int
            FROM "Machine" m 
            WHERE m."modelId" = "Model"."id" 
              AND m."organizationId" = ${ctx.organization.id}::text
          )`.as("machine_count"),
        })
        .from(models)
        .where(
          and(
            eq(models.id, input.id),
            inArray(models.id, modelIdsWithMachines),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

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
      // Get distinct model IDs that have machines in this organization
      const modelIdsWithMachinesResult = await ctx.drizzle
        .selectDistinct({ modelId: machines.modelId })
        .from(machines)
        .where(eq(machines.organizationId, ctx.organization.id));

      const modelIdsWithMachines = modelIdsWithMachinesResult.map(
        (row) => row.modelId,
      );

      // Verify the game title belongs to this organization or is a global OPDB game
      const model = await ctx.drizzle
        .select({
          id: models.id,
          name: models.name,
          manufacturer: models.manufacturer,
          year: models.year,
          ipdbId: models.ipdbId,
          opdbId: models.opdbId,
          machineType: models.machineType,
          machineDisplay: models.machineDisplay,
          isActive: models.isActive,
          ipdbLink: models.ipdbLink,
          opdbImgUrl: models.opdbImgUrl,
          kineticistUrl: models.kineticistUrl,
          isCustom: models.isCustom,
          createdAt: models.createdAt,
          updatedAt: models.updatedAt,
          machineCount: sql<number>`(
            SELECT COUNT(*)::int
            FROM "Machine" m 
            WHERE m."modelId" = "Model"."id" 
              AND m."organizationId" = ${ctx.organization.id}::text
          )`.as("machine_count"),
        })
        .from(models)
        .where(
          and(
            eq(models.id, input.id),
            inArray(models.id, modelIdsWithMachines),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

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
