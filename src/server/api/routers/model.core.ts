import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, orgScopedProcedure } from "~/server/api/trpc";
import { organizationManageProcedure } from "~/server/api/trpc.permission";
import { models, machines } from "~/server/db/schema";

export const modelCoreRouter = createTRPCRouter({
  // Enhanced getAll with OPDB metadata
  getAll: orgScopedProcedure.query(async ({ ctx }) => {
    // Get all game titles that have instances in this organization
    const modelsWithMachines = await ctx.db.query.models.findMany({
      with: {
        machines: {
          columns: { id: true },
          where: eq(machines.organizationId, ctx.organizationId),
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
        machineCount: model.machines.length, // For test compatibility
        _count: {
          machines: model.machines.length,
        },
        machines: undefined, // Remove machines array from response
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }),

  // Get single game title by ID
  getById: orgScopedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const model = await ctx.db.query.models.findFirst({
        where: eq(models.id, input.id),
        with: {
          machines: {
            columns: { id: true },
            where: eq(machines.organizationId, ctx.organizationId),
          },
        },
      });

      if (!model || model.machines.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game title not found or access denied",
        });
      }

      // Return model with machine count
      return {
        ...model,
        machineCount: model.machines.length, // For test compatibility
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
      // Get the model and check all its machines
      const model = await ctx.db.query.models.findFirst({
        where: eq(models.id, input.id),
        with: {
          machines: {
            columns: { id: true, organizationId: true },
          },
        },
      });

      if (!model) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game title not found or access denied",
        });
      }

      // Check if this organization has any machines of this model
      const orgMachines = model.machines.filter(
        (m) => m.organizationId === ctx.organizationId,
      );

      if (orgMachines.length === 0) {
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

      if (orgMachines.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete game title that has game instances",
        });
      }

      // Delete the model
      const [deletedModel] = await ctx.db
        .delete(models)
        .where(eq(models.id, input.id))
        .returning();

      return deletedModel;
    }),
});
