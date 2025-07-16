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
          organizationId: ctx.organization.id,
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

      return ctx.db.machine.update({
        where: { id: input.machineId },
        data: {
          locationId: input.locationId,
        },
        include: {
          model: true,
          location: true,
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });
    }),
});
