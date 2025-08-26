import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { transformMachineResponse } from "~/lib/utils/machine-response-transformers";
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
          eq(machines.organization_id, ctx.organizationId),
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
          eq(locations.organization_id, ctx.organizationId),
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
          location_id: input.locationId,
          updated_at: new Date(),
        })
        .where(eq(machines.id, input.machineId))
        .returning({
          id: machines.id,
          name: machines.name,
          model_id: machines.model_id,
          location_id: machines.location_id,
          organization_id: machines.organization_id,
          owner_id: machines.owner_id,
          qr_code_id: machines.qr_code_id,
          qr_code_url: machines.qr_code_url,
          qr_code_generated_at: machines.qr_code_generated_at,
          owner_notifications_enabled: machines.owner_notifications_enabled,
          notify_on_new_issues: machines.notify_on_new_issues,
          notify_on_status_changes: machines.notify_on_status_changes,
          notify_on_comments: machines.notify_on_comments,
          created_at: machines.created_at,
          updated_at: machines.updated_at,
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
          model_id: machines.model_id,
          location_id: machines.location_id,
          organization_id: machines.organization_id,
          owner_id: machines.owner_id,
          qr_code_id: machines.qr_code_id,
          qr_code_url: machines.qr_code_url,
          qr_code_generated_at: machines.qr_code_generated_at,
          owner_notifications_enabled: machines.owner_notifications_enabled,
          notify_on_new_issues: machines.notify_on_new_issues,
          notify_on_status_changes: machines.notify_on_status_changes,
          notify_on_comments: machines.notify_on_comments,
          created_at: machines.created_at,
          updated_at: machines.updated_at,
          model: {
            id: models.id,
            name: models.name,
            manufacturer: models.manufacturer,
            year: models.year,
            ipdb_id: models.ipdb_id,
            opdb_id: models.opdb_id,
            machine_type: models.machine_type,
            machine_display: models.machine_display,
            is_active: models.is_active,
            ipdb_link: models.ipdb_link,
            opdb_img_url: models.opdb_img_url,
            kineticist_url: models.kineticist_url,
            is_custom: models.is_custom,
          },
          location: locations,
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
            profile_picture: users.profile_picture,
          },
        })
        .from(machines)
        .leftJoin(models, eq(machines.model_id, models.id))
        .leftJoin(locations, eq(machines.location_id, locations.id))
        .leftJoin(users, eq(machines.owner_id, users.id))
        .where(eq(machines.id, updatedMachine.id))
        .limit(1);

      // This should always return a result since we just updated the machine successfully
      if (!machineWithRelations) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve updated machine details",
        });
      }

      return transformMachineResponse(machineWithRelations);
    }),
});
