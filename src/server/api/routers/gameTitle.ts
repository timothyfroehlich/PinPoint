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
      // Check if this OPDB game already exists globally
      const existingGame = await ctx.db.gameTitle.findUnique({
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

      // Create global GameTitle record with OPDB data
      // OPDB games are shared across all organizations
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
          // organizationId is null for global OPDB games
        },
      });
    }),

  // Sync existing titles with OPDB
  syncWithOPDB: organizationProcedure.mutation(async ({ ctx }) => {
    // Find all OPDB games that have game instances in this organization
    const gameInstancesInOrg = await ctx.db.gameInstance.findMany({
      where: {
        room: {
          organizationId: ctx.organization.id,
        },
      },
      include: {
        gameTitle: true,
      },
    });

    const opdbGamesToSync = gameInstancesInOrg
      .map((gi) => gi.gameTitle)
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
      total: opdbGamesToSync.length,
      message: `Synced ${syncedCount} of ${opdbGamesToSync.length} games`,
    };
  }),

  // Enhanced getAll with OPDB metadata
  getAll: organizationProcedure.query(async ({ ctx }) => {
    // Get all game titles that are either:
    // 1. Custom games belonging to this organization
    // 2. Global OPDB games that have instances in this organization
    return ctx.db.gameTitle.findMany({
      where: {
        OR: [
          // Custom games for this organization
          {
            organizationId: ctx.organization.id,
          },
          // Global OPDB games with instances in this organization
          {
            organizationId: null,
            gameInstances: {
              some: {
                room: {
                  organizationId: ctx.organization.id,
                },
              },
            },
          },
        ],
      },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            gameInstances: {
              where: {
                room: {
                  organizationId: ctx.organization.id,
                },
              },
            },
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
          OR: [
            // Custom games for this organization
            {
              organizationId: ctx.organization.id,
            },
            // Global OPDB games with instances in this organization
            {
              organizationId: null,
              gameInstances: {
                some: {
                  room: {
                    organizationId: ctx.organization.id,
                  },
                },
              },
            },
          ],
        },
        include: {
          _count: {
            select: {
              gameInstances: {
                where: {
                  room: {
                    organizationId: ctx.organization.id,
                  },
                },
              },
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
      // Verify the game title belongs to this organization or is a global OPDB game
      const gameTitle = await ctx.db.gameTitle.findFirst({
        where: {
          id: input.id,
          OR: [
            // Custom games for this organization (can be deleted)
            {
              organizationId: ctx.organization.id,
            },
            // Global OPDB games (cannot be deleted, only instances can be removed)
            {
              organizationId: null,
              gameInstances: {
                some: {
                  room: {
                    organizationId: ctx.organization.id,
                  },
                },
              },
            },
          ],
        },
        include: {
          _count: {
            select: {
              gameInstances: {
                where: {
                  room: {
                    organizationId: ctx.organization.id,
                  },
                },
              },
            },
          },
        },
      });

      if (!gameTitle) {
        throw new Error("Game title not found");
      }

      // Don't allow deleting global OPDB games
      if (gameTitle.organizationId === null) {
        throw new Error(
          "Cannot delete global OPDB games. Remove game instances instead.",
        );
      }

      if (gameTitle._count.gameInstances > 0) {
        throw new Error("Cannot delete game title that has game instances");
      }

      return ctx.db.gameTitle.delete({
        where: { id: input.id },
      });
    }),
});
