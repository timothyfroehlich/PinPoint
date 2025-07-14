import { z } from "zod";

import { createTRPCRouter, machineEditProcedure } from "~/server/api/trpc";

export const machineOwnerRouter = createTRPCRouter({
  // Assign or remove owner from a game instance
  assignOwner: machineEditProcedure
    .input(
      z.object({
        machineId: z.string(),
        ownerId: z.string().optional(), // null/undefined to remove owner
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

      return ctx.db.machine.update({
        where: { id: input.machineId },
        data: {
          ownerId: input.ownerId ?? null,
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
