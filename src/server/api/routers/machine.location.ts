import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, machineEditProcedure } from "~/server/api/trpc";
import { machines, locations, models, users } from "~/server/db/schema";

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
      // Verify the game instance exists and belongs to user's organization
      const existingInstance = await ctx.db.query.machines.findFirst({
        where: and(
          eq(machines.id, input.machineId),
          eq(machines.organizationId, ctx.organizationId)
        ),
      });

      if (!existingInstance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game instance not found",
        });
      }

      // Verify the target location exists and belongs to user's organization
      const location = await ctx.db.query.locations.findFirst({
        where: and(
          eq(locations.id, input.locationId),
          eq(locations.organizationId, ctx.organizationId)
        ),
      });

      if (!location) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target location not found",
        });
      }

      // Update machine location and return with all relationships in a single query
      const updatedMachines = await ctx.db
        .update(machines)
        .set({
          locationId: input.locationId,
          updatedAt: new Date(),
        })
        .where(eq(machines.id, input.machineId))
        .returning({
          id: machines.id,
          name: machines.name,
          modelId: machines.modelId,
          locationId: machines.locationId,
          organizationId: machines.organizationId,
          ownerId: machines.ownerId,
          qrCodeId: machines.qrCodeId,
          qrCodeUrl: machines.qrCodeUrl,
          qrCodeGeneratedAt: machines.qrCodeGeneratedAt,
          ownerNotificationsEnabled: machines.ownerNotificationsEnabled,
          notifyOnNewIssues: machines.notifyOnNewIssues,
          notifyOnStatusChanges: machines.notifyOnStatusChanges,
          notifyOnComments: machines.notifyOnComments,
          createdAt: machines.createdAt,
          updatedAt: machines.updatedAt,
        });

      // If no rows were updated, the machine didn't exist or doesn't belong to the organization
      if (updatedMachines.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found or not accessible",
        });
      }

      const updatedMachine = updatedMachines[0];
      if (!updatedMachine) {
        // This should never happen since we checked length above
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Machine update succeeded but returned no data",
        });
      }

      // Fetch the related data separately (model, location, owner)
      const [machineWithRelations] = await ctx.db
        .select({
          id: machines.id,
          name: machines.name,
          modelId: machines.modelId,
          locationId: machines.locationId,
          organizationId: machines.organizationId,
          ownerId: machines.ownerId,
          qrCodeId: machines.qrCodeId,
          qrCodeUrl: machines.qrCodeUrl,
          qrCodeGeneratedAt: machines.qrCodeGeneratedAt,
          ownerNotificationsEnabled: machines.ownerNotificationsEnabled,
          notifyOnNewIssues: machines.notifyOnNewIssues,
          notifyOnStatusChanges: machines.notifyOnStatusChanges,
          notifyOnComments: machines.notifyOnComments,
          createdAt: machines.createdAt,
          updatedAt: machines.updatedAt,
          model: {
            id: models.id,
            name: models.name,
            manufacturer: models.manufacturer,
            year: models.year,
            ipdbId: models.ipdbId,
            opdbId: models.opdbId,
            machineType: models.machineType,
            machineDisplay: models.machineDisplay,
            isActive: models.isActive,
            ipdbLink: models.ipdbLink,
            opdbImgUrl: models.opdbImgUrl,
            kineticistUrl: models.kineticistUrl,
            isCustom: models.isCustom,
          },
          location: locations,
          owner: {
            id: users.id,
            name: users.name,
            profilePicture: users.profilePicture,
          },
        })
        .from(machines)
        .leftJoin(models, eq(machines.modelId, models.id))
        .leftJoin(locations, eq(machines.locationId, locations.id))
        .leftJoin(users, eq(machines.ownerId, users.id))
        .where(eq(machines.id, updatedMachine.id))
        .limit(1);

      // This should always return a result since we just updated the machine successfully
      if (!machineWithRelations) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve updated machine details",
        });
      }

      return machineWithRelations;
    }),
});
