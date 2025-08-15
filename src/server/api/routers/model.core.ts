import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { models, machines } from "~/server/db/schema";

export const modelCoreRouter = createTRPCRouter({
  // Enhanced getAll with OPDB metadata
  getAll: organizationProcedure.query(async ({ ctx }) => {
    // Get all game titles that are either:
    // 1. Custom games belonging to this organization
    // 2. Global OPDB games that have instances in this organization
    const modelsWithMachines = await ctx.db.query.models.findMany({
      with: {
        machines: {
          where: eq(machines.organizationId, ctx.organization.id),
          columns: { id: true },
        },
      },
    });

    // Filter models that have machines in this organization
    const filteredModels = modelsWithMachines.filter(
      (model) => model.machines.length > 0,
    );

    // Add machine count and sort by name
    return filteredModels
      .map((model) => ({
        ...model,
        _count: {
          machines: model.machines.length,
        },
        machines: undefined, // Remove machines array from response
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }),

  // Get single game title by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const model = await ctx.db.query.models.findFirst({
        where: eq(models.id, input.id),
        with: {
          machines: {
            where: eq(machines.organizationId, ctx.organization.id),
            columns: { id: true },
          },
        },
      });

      if (!model || model.machines.length === 0) {
        throw new Error("Game title not found");
      }

      // Return model with machine count
      return {
        ...model,
        _count: {
          machines: model.machines.length,
        },
        machines: undefined, // Remove machines array from response
      };
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
      const model = await ctx.db.query.models.findFirst({
        where: eq(models.id, input.id),
        with: {
          machines: {
            where: eq(machines.organizationId, ctx.organization.id),
            columns: { id: true },
          },
        },
      });

      if (!model || model.machines.length === 0) {
        throw new Error("Game title not found");
      }

      if (model.isCustom) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete custom games. Remove game instances instead.",
        });
      }

      if (model.machines.length > 0) {
        throw new Error("Cannot delete game title that has game instances");
      }

      // Delete the model
      const [deletedModel] = await ctx.db
        .delete(models)
        .where(eq(models.id, input.id))
        .returning();

      return deletedModel;
    }),
});
