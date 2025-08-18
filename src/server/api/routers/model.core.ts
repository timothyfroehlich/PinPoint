import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { models } from "~/server/db/schema";

export const modelCoreRouter = createTRPCRouter({
  // Enhanced getAll with OPDB metadata
  getAll: organizationProcedure.query(async ({ ctx }) => {
    // Get all game titles that have instances in this organization
    // RLS automatically handles organizational scoping for machines
    const modelsWithMachines = await ctx.db.query.models.findMany({
      with: {
        machines: {
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
      // Verify the game title is accessible to this organization
      const model = await ctx.db.query.models.findFirst({
        where: eq(models.id, input.id),
        with: {
          machines: {
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
