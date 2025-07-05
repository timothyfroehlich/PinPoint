import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "~/server/api/trpc";

export const gameInstanceRouter = createTRPCRouter({
  create: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1),
        gameTitleId: z.string(),
        locationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify that the gameTitle and location belong to the same organization
      const gameTitle = await ctx.db.gameTitle.findFirst({
        where: {
          id: input.gameTitleId,
          organizationId: ctx.organization.id,
        },
      });

      const location = await ctx.db.location.findFirst({
        where: {
          id: input.locationId,
          organizationId: ctx.organization.id,
        },
      });

      if (!gameTitle || !location) {
        throw new Error("Invalid game title or location");
      }

      return ctx.db.gameInstance.create({
        data: {
          name: input.name,
          gameTitleId: input.gameTitleId,
          locationId: input.locationId,
        },
        include: {
          gameTitle: true,
          location: true,
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
        gameTitle: {
          organizationId: ctx.organization.id,
        },
      },
      include: {
        gameTitle: true,
        location: true,
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
          gameTitle: {
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
          gameTitle: true,
          location: true,
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
          gameTitle: {
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
        locationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the game instance belongs to this organization
      const existingInstance = await ctx.db.gameInstance.findFirst({
        where: {
          id: input.gameInstanceId,
          gameTitle: {
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!existingInstance) {
        throw new Error("Game instance not found");
      }

      // Verify the target location belongs to this organization
      const location = await ctx.db.location.findFirst({
        where: {
          id: input.locationId,
          organizationId: ctx.organization.id,
        },
      });

      if (!location) {
        throw new Error("Target location not found");
      }

      return ctx.db.gameInstance.update({
        where: { id: input.gameInstanceId },
        data: {
          locationId: input.locationId,
        },
        include: {
          gameTitle: true,
          location: true,
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
          gameTitle: {
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
          gameTitle: true,
          location: true,
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
