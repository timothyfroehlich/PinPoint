import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, orgScopedProcedure } from "~/server/api/trpc";
import { organizationManageProcedure } from "~/server/api/trpc.permission";
import { models, machines } from "~/server/db/schema";

export const modelCoreRouter = createTRPCRouter({
  // Enhanced getAll with OPDB metadata
  getAll: orgScopedProcedure.query(async ({ ctx }) => {
    // Get all models that have machine instances in this organization
    const modelsWithMachines = await ctx.db.query.models.findMany({
      with: {
        machines: {
          columns: { id: true },
          where: eq(machines.organization_id, ctx.organizationId),
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

  // Get single model by ID
  getById: orgScopedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const model = await ctx.db.query.models.findFirst({
        where: eq(models.id, input.id),
        with: {
          machines: {
            columns: { id: true },
            where: eq(machines.organization_id, ctx.organizationId),
          },
        },
      });

      if (!model || model.machines.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Model not found or access denied",
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

  // Delete model (only if no machine instances exist)
  delete: organizationManageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get the model and check all its machines
      const model = await ctx.db.query.models.findFirst({
        where: eq(models.id, input.id),
        with: {
          machines: {
            columns: { id: true, organization_id: true },
          },
        },
      });

      if (!model) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Model not found or access denied",
        });
      }

      // Check if this organization has any machines of this model
      const orgMachines = model.machines.filter(
        (m) => m.organization_id === ctx.organizationId,
      );

      if (orgMachines.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Model not found or access denied",
        });
      }

      if (model.is_custom) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cannot delete custom models. Remove machine instances instead.",
        });
      }

      if (orgMachines.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete model that has machine instances",
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
