import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { z } from "zod";

import {
  transformKeysToCamelCase,
  type DrizzleToCamelCase,
} from "~/lib/utils/case-transformers";
import { createTRPCRouter, machineEditProcedure } from "~/server/api/trpc";
import { machines, memberships } from "~/server/db/schema";
import type { models, locations, users } from "~/server/db/schema";

// Type for the machine with its relationships
type MachineWithRelations = InferSelectModel<typeof machines> & {
  model: InferSelectModel<typeof models>;
  location: InferSelectModel<typeof locations>;
  owner: Pick<
    InferSelectModel<typeof users>,
    "id" | "name" | "profile_picture"
  > | null;
};

type MachineWithRelationsResponse = DrizzleToCamelCase<MachineWithRelations>;

export const machineOwnerRouter = createTRPCRouter({
  // Assign or remove owner from a machine
  assignOwner: machineEditProcedure
    .input(
      z.object({
        machineId: z.string(),
        ownerId: z.string().optional(), // null/undefined to remove owner
      }),
    )
    .mutation(async ({ ctx, input }): Promise<MachineWithRelationsResponse> => {
      // Verify the machine exists and belongs to the user's organization
      const existingInstance = await ctx.db.query.machines.findFirst({
        where: and(
          eq(machines.id, input.machineId),
          eq(machines.organization_id, ctx.organizationId),
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
            eq(memberships.user_id, input.ownerId),
            eq(memberships.organization_id, ctx.organizationId),
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
        .set({
          owner_id:
            input.ownerId && input.ownerId.trim() !== "" ? input.ownerId : null,
        })
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
          eq(machines.organization_id, ctx.organizationId),
        ),
        with: {
          model: true,
          location: true,
          owner: {
            columns: {
              id: true,
              name: true,
              profile_picture: true,
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

      return transformKeysToCamelCase(
        machineWithRelations,
      ) as MachineWithRelationsResponse;
    }),
});
