import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
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

      // Verify the target location belongs to this organization
      const location = await ctx.drizzle.query.locations.findFirst({
        where: and(
          eq(locations.id, input.locationId),
          eq(locations.organizationId, ctx.organization.id),
        ),
      });

      if (!location) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target location not found",
        });
      }

      // Update machine location
      const [updatedMachine] = await ctx.drizzle
        .update(machines)
        .set({
          locationId: input.locationId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(machines.id, input.machineId),
            eq(machines.organizationId, ctx.organization.id),
          ),
        )
        .returning();

      if (!updatedMachine) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found or not accessible",
        });
      }

      // Get updated machine with all relationships
      const [machineWithRelations] = await ctx.drizzle
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
            image: users.image,
          },
        })
        .from(machines)
        .leftJoin(models, eq(machines.modelId, models.id))
        .leftJoin(locations, eq(machines.locationId, locations.id))
        .leftJoin(users, eq(machines.ownerId, users.id))
        .where(eq(machines.id, input.machineId))
        .limit(1);

      if (!machineWithRelations) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve updated machine",
        });
      }

      return machineWithRelations;
    }),
});
