import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "~/server/api/trpc";
import { OPDBClient } from "~/lib/opdb/client";
import { env } from "~/env";

export const gameTitleRouter = createTRPCRouter({
  // Search OPDB games for typeahead
  searchOPDB: organizationProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const opdbClient = new OPDBClient(env.OPDB_API_TOKEN, env.OPDB_API_URL);
      return await opdbClient.searchMachines(input.query);
    }),

  // Create GameTitle from OPDB data
  createFromOPDB: organizationProcedure
    .input(z.object({ opdbId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if this OPDB game already exists for this organization
      const existingGame = await ctx.db.gameTitle.findFirst({
        where: {
          opdbId: input.opdbId,
          organizationId: ctx.organization.id,
        },
      });

      if (existingGame) {
        throw new Error("This game already exists in your organization");
      }

      // Fetch full data from OPDB
      const opdbClient = new OPDBClient(env.OPDB_API_TOKEN, env.OPDB_API_URL);
      const machineData = await opdbClient.getMachineById(input.opdbId);

      if (!machineData) {
        throw new Error("Game not found in OPDB");
      }

      // Create local GameTitle record with OPDB data
      return ctx.db.gameTitle.create({
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
          organizationId: ctx.organization.id,
        },
      });
    }),

  // Sync existing titles with OPDB
  syncWithOPDB: organizationProcedure.mutation(async ({ ctx }) => {
    const existingTitles = await ctx.db.gameTitle.findMany({
      where: {
        organizationId: ctx.organization.id,
        opdbId: { not: { startsWith: "custom-" } },
      },
    });

    if (existingTitles.length === 0) {
      return { synced: 0, message: "No OPDB-linked games found to sync" };
    }

    const opdbClient = new OPDBClient(env.OPDB_API_TOKEN, env.OPDB_API_URL);
    let syncedCount = 0;

    // Sync each title with OPDB data
    for (const title of existingTitles) {
      try {
        const machineData = await opdbClient.getMachineById(title.opdbId);

        if (machineData) {
          await ctx.db.gameTitle.update({
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
      total: existingTitles.length,
      message: `Synced ${syncedCount} of ${existingTitles.length} games`,
    };
  }),

  // Enhanced getAll with OPDB metadata
  getAll: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.gameTitle.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            gameInstances: true,
          },
        },
      },
    });
  }),

  // Get single game title by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const gameTitle = await ctx.db.gameTitle.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          _count: {
            select: {
              gameInstances: true,
            },
          },
        },
      });

      if (!gameTitle) {
        throw new Error("Game title not found");
      }

      return gameTitle;
    }),


  // Delete game title (only if no game instances exist)
  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the game title belongs to this organization
      const gameTitle = await ctx.db.gameTitle.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          _count: {
            select: {
              gameInstances: true,
            },
          },
        },
      });

      if (!gameTitle) {
        throw new Error("Game title not found");
      }

      if (gameTitle._count.gameInstances > 0) {
        throw new Error("Cannot delete game title that has game instances");
      }

      return ctx.db.gameTitle.delete({
        where: { id: input.id },
      });
    }),
});
