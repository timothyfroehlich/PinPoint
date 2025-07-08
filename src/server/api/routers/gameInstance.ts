import { z } from "zod";
import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const gameInstanceRouter = createTRPCRouter({
  create: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1),
        gameTitleId: z.string(),
        roomId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify that the gameTitle and room belong to the same organization
      const gameTitle = await ctx.db.gameTitle.findFirst({
        where: {
          id: input.gameTitleId,
          OR: [
            { organizationId: ctx.organization.id }, // Organization-specific games
            { organizationId: null }, // Global OPDB games
          ],
        },
      });

      const room = await ctx.db.room.findFirst({
        where: {
          id: input.roomId,
          organizationId: ctx.organization.id,
        },
      });

      if (!gameTitle || !room) {
        throw new Error("Invalid game title or room");
      }

      return ctx.db.gameInstance.create({
        data: {
          name: input.name,
          gameTitleId: input.gameTitleId,
          roomId: input.roomId,
        },
        include: {
          gameTitle: {
            include: {
              _count: {
                select: {
                  gameInstances: true,
                },
              },
            },
          },
          room: {
            include: {
              location: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });
    }),

  getAll: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.gameInstance.findMany({
      where: {
        room: {
          organizationId: ctx.organization.id,
        },
      },
      include: {
        gameTitle: {
          include: {
            _count: {
              select: {
                gameInstances: true,
              },
            },
          },
        },
        room: {
          include: {
            location: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  // Public endpoint for issue reporting - returns minimal data needed for issue form
  getAllForIssues: publicProcedure.query(async ({ ctx }) => {
    // Use the organization resolved from subdomain context
    const organization = ctx.organization;

    return ctx.db.gameInstance.findMany({
      where: {
        room: {
          organizationId: organization.id,
        },
      },
      select: {
        id: true,
        name: true,
        gameTitle: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const gameInstance = await ctx.db.gameInstance.findFirst({
        where: {
          id: input.id,
          room: {
            organizationId: ctx.organization.id,
          },
        },
        include: {
          gameTitle: {
            include: {
              _count: {
                select: {
                  gameInstances: true,
                },
              },
            },
          },
          room: {
            include: {
              location: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });

      if (!gameInstance) {
        throw new Error("Game instance not found");
      }

      return gameInstance;
    }),

  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        gameTitleId: z.string().optional(),
        locationId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First verify the game instance belongs to this organization
      const existingInstance = await ctx.db.gameInstance.findFirst({
        where: {
          id: input.id,
          room: {
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!existingInstance) {
        throw new Error("Game instance not found");
      }

      // If updating gameTitle or location, verify they belong to the organization
      if (input.gameTitleId) {
        const gameTitle = await ctx.db.gameTitle.findFirst({
          where: {
            id: input.gameTitleId,
            organizationId: ctx.organization.id,
          },
        });
        if (!gameTitle) {
          throw new Error("Invalid game title");
        }
      }

      if (input.locationId) {
        const location = await ctx.db.location.findFirst({
          where: {
            id: input.locationId,
            organizationId: ctx.organization.id,
          },
        });
        if (!location) {
          throw new Error("Invalid location");
        }
      }

      return ctx.db.gameInstance.update({
        where: { id: input.id },
        data: {
          name: input.name,
          ...(input.gameTitleId && { gameTitleId: input.gameTitleId }),
          ...(input.locationId && { locationId: input.locationId }),
        },
        include: {
          gameTitle: {
            include: {
              _count: {
                select: {
                  gameInstances: true,
                },
              },
            },
          },
          room: {
            include: {
              location: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });
    }),

  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the game instance belongs to this organization
      const existingInstance = await ctx.db.gameInstance.findFirst({
        where: {
          id: input.id,
          room: {
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!existingInstance) {
        throw new Error("Game instance not found");
      }

      return ctx.db.gameInstance.delete({
        where: { id: input.id },
      });
    }),

  // Move a game instance to a different location
  moveToLocation: organizationProcedure
    .input(
      z.object({
        gameInstanceId: z.string(),
        roomId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the game instance belongs to this organization
      const existingInstance = await ctx.db.gameInstance.findFirst({
        where: {
          id: input.gameInstanceId,
          room: {
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!existingInstance) {
        throw new Error("Game instance not found");
      }

      // Verify the target room belongs to this organization
      const room = await ctx.db.room.findFirst({
        where: {
          id: input.roomId,
          organizationId: ctx.organization.id,
        },
      });

      if (!room) {
        throw new Error("Target room not found");
      }

      return ctx.db.gameInstance.update({
        where: { id: input.gameInstanceId },
        data: {
          roomId: input.roomId,
        },
        include: {
          gameTitle: {
            include: {
              _count: {
                select: {
                  gameInstances: true,
                },
              },
            },
          },
          room: {
            include: {
              location: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });
    }),

  // Assign or remove owner from a game instance
  assignOwner: organizationProcedure
    .input(
      z.object({
        gameInstanceId: z.string(),
        ownerId: z.string().optional(), // null/undefined to remove owner
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the game instance belongs to this organization
      const existingInstance = await ctx.db.gameInstance.findFirst({
        where: {
          id: input.gameInstanceId,
          room: {
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!existingInstance) {
        throw new Error("Game instance not found");
      }

      // If setting an owner, verify the user is a member of this organization
      if (input.ownerId) {
        const membership = await ctx.db.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: input.ownerId,
              organizationId: ctx.organization.id,
            },
          },
        });

        if (!membership) {
          throw new Error("User is not a member of this organization");
        }
      }

      return ctx.db.gameInstance.update({
        where: { id: input.gameInstanceId },
        data: {
          ownerId: input.ownerId ?? null,
        },
        include: {
          gameTitle: {
            include: {
              _count: {
                select: {
                  gameInstances: true,
                },
              },
            },
          },
          room: {
            include: {
              location: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });
    }),
});
