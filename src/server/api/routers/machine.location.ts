import { z } from "zod";

import { createTRPCRouter, machineEditProcedure } from "~/server/api/trpc";

export const machineLocationRouter = createTRPCRouter({
  // Move a game instance to a different location
  moveToLocation: machineEditProcedure
    .input(
      z.object({
        machineId: z.string(),
        locationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the game instance belongs to this organization
      const existingInstance = await ctx.db.machine.findFirst({
        where: {
          id: input.machineId,
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
          id: input.locationId,
          organizationId: ctx.organization.id,
        },
      });

      if (!room) {
        throw new Error("Target room not found");
      }

      return ctx.db.machine.update({
        where: { id: input.machineId },
        data: {
          locationId: input.locationId,
        },
        include: {
          model: {
            include: {
              _count: {
                select: {
                  machines: true,
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
