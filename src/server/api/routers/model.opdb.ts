import { eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { OPDBClient } from "~/lib/opdb/client";
import { generateId } from "~/lib/utils/id-generation";
import {
  createTRPCRouter,
  organizationProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { models, machines } from "~/server/db/schema";

export const modelOpdbRouter = createTRPCRouter({
  // Search OPDB games for typeahead
  searchOPDB: organizationProcedure
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
        throw new Error("This game already exists in the system");
      }

      // Fetch full data from OPDB
      const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
      const machineData = await opdbClient.getMachineById(input.opdbId);

      if (!machineData) {
        throw new Error("Game not found in OPDB");
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
    const machinesInOrg = await ctx.db.query.machines.findMany({
      where: eq(machines.organizationId, ctx.organization.id),
      with: {
        model: true,
      },
    });

    const opdbGamesToSync = machinesInOrg
      .map((gi) => gi.model)
      .filter((gt) => gt.opdbId && !gt.opdbId.startsWith("custom-"));

    if (opdbGamesToSync.length === 0) {
      return { synced: 0, message: "No OPDB-linked games found to sync" };
    }

    const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
    let syncedCount = 0;

    // Sync each title with OPDB data
    for (const title of opdbGamesToSync) {
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
      total: opdbGamesToSync.length,
      message: `Synced ${syncedCount.toString()} of ${opdbGamesToSync.length.toString()} games`,
    };
  }),
});
