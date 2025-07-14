import { z } from "zod";

import { env } from "~/env";
import { OPDBClient } from "~/lib/opdb/client";
import {
  createTRPCRouter,
  organizationProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";

export const modelOpdbRouter = createTRPCRouter({
  // Search OPDB games for typeahead
  searchOPDB: organizationProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const opdbClient = new OPDBClient(env.OPDB_API_TOKEN, env.OPDB_API_URL);
      return await opdbClient.searchMachines(input.query);
    }),

  // Create Model from OPDB data
  createFromOPDB: organizationManageProcedure
    .input(z.object({ opdbId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if this OPDB game already exists globally
      const existingGame = await ctx.db.model.findUnique({
        where: {
          opdbId: input.opdbId,
        },
      });

      if (existingGame) {
        throw new Error("This game already exists in the system");
      }

      // Fetch full data from OPDB
      const opdbClient = new OPDBClient(env.OPDB_API_TOKEN, env.OPDB_API_URL);
      const machineData = await opdbClient.getMachineById(input.opdbId);

      if (!machineData) {
        throw new Error("Game not found in OPDB");
      }

      // Create global Model record with OPDB data
      // OPDB games are shared across all organizations
      return ctx.db.model.create({
        data: {
          name: machineData.name,
          opdbId: input.opdbId,
          manufacturer: machineData.manufacturer,
          releaseDate: machineData.year
            ? new Date(machineData.year, 0, 1)
            : null,
          imageUrl: machineData.playfield_image ?? machineData.images?.[0],
          description: machineData.description,
          lastSynced: new Date(),
          // organizationId is null for global OPDB games
        },
      });
    }),

  // Sync existing titles with OPDB
  syncWithOPDB: organizationManageProcedure.mutation(async ({ ctx }) => {
    // Find all OPDB games that have game instances in this organization
    const machinesInOrg = await ctx.db.machine.findMany({
      where: {
        room: {
          organizationId: ctx.organization.id,
        },
      },
      include: {
        model: true,
      },
    });

    const opdbGamesToSync = machinesInOrg
      .map((gi) => gi.model)
      .filter((gt) => gt.opdbId && !gt.opdbId.startsWith("custom-"));

    if (opdbGamesToSync.length === 0) {
      return { synced: 0, message: "No OPDB-linked games found to sync" };
    }

    const opdbClient = new OPDBClient(env.OPDB_API_TOKEN, env.OPDB_API_URL);
    let syncedCount = 0;

    // Sync each title with OPDB data
    for (const title of opdbGamesToSync) {
      try {
        if (!title.opdbId) continue; // Type guard

        const machineData = await opdbClient.getMachineById(title.opdbId);

        if (machineData) {
          await ctx.db.model.update({
            where: { id: title.id },
            data: {
              name: machineData.name,
              manufacturer: machineData.manufacturer,
              releaseDate: machineData.year
                ? new Date(machineData.year, 0, 1)
                : null,
              imageUrl: machineData.playfield_image ?? machineData.images?.[0],
              description: machineData.description,
              lastSynced: new Date(),
            },
          });
          syncedCount++;
        }
      } catch (error) {
        console.error(`Failed to sync game ${title.name}:`, error);
      }
    }

    return {
      synced: syncedCount,
      total: opdbGamesToSync.length,
      message: `Synced ${syncedCount} of ${opdbGamesToSync.length} games`,
    };
  }),
});
