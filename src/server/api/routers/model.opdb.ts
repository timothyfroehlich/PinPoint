import { type Model } from "@prisma/client";
import { z } from "zod";

import { env } from "~/env";
import { OPDBClient, type OPDBSearchResult } from "~/lib/opdb/client";
import {
  createTRPCRouter,
  organizationProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";

type SyncResult = {
  synced: number;
  total?: number;
  message: string;
};

export const modelOpdbRouter = createTRPCRouter({
  // Search OPDB games for typeahead
  searchOPDB: organizationProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }): Promise<OPDBSearchResult[]> => {
      const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
      return opdbClient.searchMachines(input.query);
    }),

  // Create Model from OPDB data
  createFromOPDB: organizationManageProcedure
    .input(z.object({ opdbId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<Model> => {
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
      const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
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
          year: machineData.year,
          opdbImgUrl: machineData.playfield_image,
          machineType: machineData.type,
        },
      });
    }),

  // Sync existing titles with OPDB
  syncWithOPDB: organizationManageProcedure.mutation(
    async ({ ctx }): Promise<SyncResult> => {
      // Find all OPDB games that have game instances in this organization
      const machinesInOrg = await ctx.db.machine.findMany({
        where: {
          organizationId: ctx.organization.id,
        },
        include: {
          model: true,
        },
      });

      const opdbGamesToSync = machinesInOrg
        .map((gi) => gi.model)
        .filter((gt) => gt && gt.opdbId && !gt.opdbId.startsWith("custom-"));

      if (opdbGamesToSync.length === 0) {
        return { synced: 0, message: "No OPDB-linked games found to sync" };
      }

      const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
      let syncedCount = 0;

      // Sync each title with OPDB data
      for (const title of opdbGamesToSync) {
        try {
          if (!title?.opdbId) continue; // Type guard

          const machineData = await opdbClient.getMachineById(title.opdbId);

          if (machineData) {
            await ctx.db.model.update({
              where: { id: title.id },
              data: {
                name: machineData.name,
                manufacturer: machineData.manufacturer,
                year: machineData.year,
                opdbImgUrl: machineData.playfield_image,
                machineType: machineData.type,
              },
            });
            syncedCount++;
          }
        } catch (error) {
          console.error(`Failed to sync game ${title.name ?? "N/A"}:`, error);
        }
      }

      return {
        synced: syncedCount,
        total: opdbGamesToSync.length,
        message: `Synced ${syncedCount} of ${opdbGamesToSync.length} games`,
      };
    },
  ),
});
