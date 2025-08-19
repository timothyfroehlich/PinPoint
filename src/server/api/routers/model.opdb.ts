import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { OPDBClient } from "~/lib/opdb/client";
import { generateId } from "~/lib/utils/id-generation";
import {
  createTRPCRouter,
  orgScopedProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { models } from "~/server/db/schema";

export const modelOpdbRouter = createTRPCRouter({
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
        where: eq(models.opdbId, input.opdbId),
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

      // Create global Model record with OPDB data
      // OPDB games are shared across all organizations
      const [newModel] = await ctx.db
        .insert(models)
        .values({
          id: generateId(),
          name: machineData.name,
          opdbId: input.opdbId,
          manufacturer: machineData.manufacturer ?? null,
          year: machineData.year ?? null,
          opdbImgUrl: machineData.playfield_image ?? null,
          machineType: machineData.type ?? null,
        })
        .returning();

      return newModel;
    }),

  // Sync existing titles with OPDB
  syncWithOPDB: organizationManageProcedure.mutation(async ({ ctx }) => {
    // Find all OPDB games that have game instances in this organization
    // RLS automatically scopes to organization's machines
    const machinesInOrg = await ctx.db.query.machines.findMany({
      with: {
        model: true,
      },
    });

    const opdbGamesToSync = machinesInOrg
      .map((machine) => machine.model)
      .filter((model) => model.opdbId && !model.opdbId.startsWith("custom-"))
      // Remove duplicates by creating a Map
      .reduce((uniqueModels, model) => {
        uniqueModels.set(model.id, model);
        return uniqueModels;
      }, new Map<string, (typeof machinesInOrg)[0]["model"]>());

    const uniqueModels = Array.from(opdbGamesToSync.values());

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
});
