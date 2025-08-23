import { TRPCError } from "@trpc/server";
import { eq, and, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { OPDBClient } from "~/lib/opdb/client";
import { generateId } from "~/lib/utils/id-generation";
import {
  createTRPCRouter,
  orgScopedProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { models, machines } from "~/server/db/schema";

export const modelRouter = createTRPCRouter({
  // Get all models accessible to this organization
  // Includes: OPDB models (global) + org's custom models (future v1.x feature)
  getAll: orgScopedProcedure.query(async ({ ctx }) => {
    const allModels = await ctx.db.query.models.findMany({
      where:
        // Global OPDB models (organizationId = NULL) OR org's custom models
        or(
          isNull(models.organizationId), // OPDB models
          eq(models.organizationId, ctx.organizationId), // Custom models
        ),
      with: {
        machines: {
          where: eq(machines.organizationId, ctx.organizationId),
          columns: { id: true },
        },
      },
    });

    // Add machine count and sort by name
    return allModels
      .map((model) => ({
        ...model,
        machineCount: model.machines.length,
        _count: {
          machines: model.machines.length,
        },
        machines: undefined, // Remove machines array from response
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }),

  // Get single model by ID (must be accessible to organization)
  getById: orgScopedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const model = await ctx.db.query.models.findFirst({
        where: and(
          eq(models.id, input.id),
          // Must be OPDB model OR org's custom model
          or(
            isNull(models.organizationId), // OPDB models
            eq(models.organizationId, ctx.organizationId), // Custom models
          ),
        ),
        with: {
          machines: {
            where: eq(machines.organizationId, ctx.organizationId),
            columns: { id: true },
          },
        },
      });

      if (!model) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Model not found or access denied",
        });
      }

      // Return model with machine count
      return {
        ...model,
        machineCount: model.machines.length,
        _count: {
          machines: model.machines.length,
        },
        machines: undefined, // Remove machines array from response
      };
    }),

  // Search OPDB games for typeahead
  searchOPDB: orgScopedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
      return await opdbClient.searchMachines(input.query);
    }),

  // Create Model from OPDB data
  createFromOPDB: organizationManageProcedure
    .input(z.object({ opdbId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if this OPDB game already exists globally
      const existingGame = await ctx.db.query.models.findFirst({
        where: and(
          eq(models.opdbId, input.opdbId),
          isNull(models.organizationId), // OPDB models have NULL organizationId
        ),
      });

      if (existingGame) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This game already exists in the system",
        });
      }

      // Fetch full data from OPDB
      const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
      const machineData = await opdbClient.getMachineById(input.opdbId);

      if (!machineData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game not found in OPDB",
        });
      }

      // Create global OPDB Model record
      // OPDB games are shared across all organizations
      const [newModel] = await ctx.db
        .insert(models)
        .values({
          id: generateId(),
          name: machineData.name,
          organizationId: null, // NULL for OPDB models (global access)
          isCustom: false, // OPDB models are not custom
          opdbId: input.opdbId,
          manufacturer: machineData.manufacturer ?? null,
          year: machineData.year ?? null,
          opdbImgUrl: machineData.playfield_image ?? null,
          machineType: machineData.type ?? null,
        })
        .returning();

      return newModel;
    }),

  // Sync existing OPDB models with latest OPDB data
  syncWithOPDB: organizationManageProcedure.mutation(async ({ ctx }) => {
    // Find all OPDB models that have machines in this organization
    const machinesInOrg = await ctx.db.query.machines.findMany({
      where: eq(machines.organizationId, ctx.organizationId),
      with: {
        model: true,
      },
    });

    const opdbModelsToSync = machinesInOrg
      .map((machine) => machine.model)
      .filter(
        (model): model is NonNullable<typeof model> =>
          model !== null &&
          model !== undefined &&
          model.opdbId !== null &&
          model.opdbId !== undefined &&
          model.organizationId === null && // Only OPDB models
          !model.isCustom,
      )
      // Remove duplicates by creating a Map
      .reduce((uniqueModels, model) => {
        uniqueModels.set(model.id, model);
        return uniqueModels;
      }, new Map<string, NonNullable<(typeof machinesInOrg)[0]["model"]>>());

    const uniqueModels = Array.from(opdbModelsToSync.values());

    if (uniqueModels.length === 0) {
      return { synced: 0, message: "No OPDB-linked games found to sync" };
    }

    const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
    let syncedCount = 0;

    // Sync each title with OPDB data
    for (const title of uniqueModels) {
      try {
        if (!title.opdbId) continue; // Type guard

        const machineData = await opdbClient.getMachineById(title.opdbId);

        if (machineData) {
          await ctx.db
            .update(models)
            .set({
              name: machineData.name,
              manufacturer: machineData.manufacturer ?? null,
              year: machineData.year ?? null,
              opdbImgUrl: machineData.playfield_image ?? null,
              machineType: machineData.type ?? null,
            })
            .where(eq(models.id, title.id));
          syncedCount++;
        }
      } catch (error) {
        ctx.logger.error({
          msg: "Failed to sync OPDB game",
          component: "modelRouter.syncOPDBGames",
          context: {
            gameTitle: title.name,
            gameId: title.id,
            opdbId: title.opdbId,
            operation: "opdb_sync",
          },
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return {
      synced: syncedCount,
      total: uniqueModels.length,
      message: `Synced ${syncedCount.toString()} of ${uniqueModels.length.toString()} games`,
    };
  }),

  // Note: Custom model CRUD operations will be added in v1.x
  // For now, OPDB models are read-only after creation and cannot be deleted
});
