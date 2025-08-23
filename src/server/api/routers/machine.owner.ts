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
      // Verify the game instance exists and belongs to the user's organization
      const existingInstance = await ctx.db.query.machines.findFirst({
        where: and(
          eq(machines.id, input.machineId),
          eq(machines.organizationId, ctx.organizationId)
        ),
      });

      if (!existingInstance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found",
        });
      }

      // If setting an owner, verify the user is a member of this organization
      if (input.ownerId && input.ownerId.trim() !== "") {
        const membership = await ctx.db.query.memberships.findFirst({
          where: and(
            eq(memberships.userId, input.ownerId),
            eq(memberships.organizationId, ctx.organizationId)
          ),
        });

        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User is not a member of this organization",
          });
        }
      }

      // Update the machine owner (treat empty string as null)
      const [updatedMachine] = await ctx.db
        .update(machines)
        .set({ ownerId: input.ownerId && input.ownerId.trim() !== "" ? input.ownerId : null })
        .where(eq(machines.id, input.machineId))
        .returning();

      if (!updatedMachine) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update machine owner",
        });
      }

      // Fetch the updated machine with its relationships (ensure org scoping)
      const machineWithRelations = await ctx.db.query.machines.findFirst({
        where: and(
          eq(machines.id, input.machineId),
          eq(machines.organizationId, ctx.organizationId)
        ),
        with: {
          model: true,
          location: true,
          owner: {
            columns: {
              id: true,
              name: true,
              profilePicture: true,
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
