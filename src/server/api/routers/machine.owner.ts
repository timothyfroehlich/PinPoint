import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, machineEditProcedure } from "~/server/api/trpc";
import { machines, memberships } from "~/server/db/schema";

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
      const existingInstance = await ctx.drizzle.query.machines.findFirst({
        where: and(
          eq(machines.id, input.machineId),
          eq(machines.organizationId, ctx.organization.id),
        ),
      });

      if (!existingInstance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game instance not found",
        });
      }

      // If setting an owner, verify the user is a member of this organization
      if (input.ownerId) {
        const membership = await ctx.drizzle.query.memberships.findFirst({
          where: and(
            eq(memberships.userId, input.ownerId),
            eq(memberships.organizationId, ctx.organization.id),
          ),
        });

        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User is not a member of this organization",
          });
        }
      }

      // Update the machine owner
      const [updatedMachine] = await ctx.drizzle
        .update(machines)
        .set({ ownerId: input.ownerId ?? null })
        .where(eq(machines.id, input.machineId))
        .returning();

      if (!updatedMachine) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update machine owner",
        });
      }

      // Fetch the updated machine with its relationships
      const machineWithRelations = await ctx.drizzle.query.machines.findFirst({
        where: eq(machines.id, input.machineId),
        with: {
          model: true,
          location: true,
          owner: {
            columns: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      if (!machineWithRelations) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch updated machine",
        });
      }

      return machineWithRelations;
    }),
});
