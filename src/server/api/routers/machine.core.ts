// External libraries (alphabetical)
import { TRPCError } from "@trpc/server";
import { asc, eq, sql } from "drizzle-orm";

// Internal types (alphabetical)
import { type MachineResponse } from "~/lib/types/api";
import { type MachineForIssues } from "~/lib/utils/machine-response-transformers";

// Internal utilities (alphabetical)
import { generatePrefixedId } from "~/lib/utils/id-generation";
import {
  transformMachineResponse,
  transformMachinesForIssuesResponse,
  transformMachinesResponse,
} from "~/lib/utils/machine-response-transformers";

// Server modules (alphabetical)
import {
  machineCreateSchema,
  machineFilterSchema,
  machineIdSchema,
  machineUpdateSchema,
} from "~/server/api/schemas/machine.schema";
import {
  createTRPCRouter,
  machineDeleteProcedure,
  machineEditProcedure,
  orgScopedProcedure,
  anonOrgScopedProcedure,
} from "~/server/api/trpc";

// Database schema (alphabetical)
import { locations, machines, models, users } from "~/server/db/schema";

export const machineCoreRouter = createTRPCRouter({
  create: machineEditProcedure
    .input(machineCreateSchema)
    .mutation(async ({ ctx, input }): Promise<MachineResponse> => {
      // Verify that the model and location exist (RLS handles org scoping)
      const [model] = await ctx.db
        .select()
        .from(models)
        .where(eq(models.id, input.modelId))
        .limit(1);

      const [location] = await ctx.db
        .select()
        .from(locations)
        .where(eq(locations.id, input.locationId))
        .limit(1);

      if (!model || !location) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid game title or location",
        });
      }

      // Generate unique IDs
      const machineId = generatePrefixedId("machine");
      const qrCodeId = generatePrefixedId("qr");

      // Create machine
      const [machine] = await ctx.db
        .insert(machines)
        .values({
          id: machineId,
          name: input.name ?? model.name,
          model_id: input.modelId,
          location_id: input.locationId,
          qr_code_id: qrCodeId,
          organization_id: ctx.organizationId,
        })
        .returning();

      if (!machine) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create machine",
        });
      }

      // Get machine with all relationships for return
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
            machinesCount: sql<number>`(
              SELECT COUNT(*) FROM ${machines}
              WHERE ${machines.model_id} = ${models.id}
            )`,
          },
          location: {
            id: locations.id,
            name: locations.name,
            street: locations.street,
            city: locations.city,
            state: locations.state,
            zip: locations.zip,
          },
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
            profile_picture: users.profile_picture,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.model_id, models.id))
        .innerJoin(locations, eq(machines.location_id, locations.id))
        .leftJoin(users, eq(machines.owner_id, users.id))
        .where(eq(machines.id, machine.id))
        .limit(1);

      if (!machineWithRelations) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve created machine",
        });
      }

      // Auto-generate QR code for the new machine
      try {
        const qrCodeService = ctx.services.createQRCodeService();
        await qrCodeService.generateQRCode(machine.id);
      } catch (error) {
        // Log error but don't fail machine creation
        ctx.logger.warn({
          msg: "Failed to generate QR code for machine",
          component: "machineRouter.create",
          context: {
            machineId: machine.id,
            machineName: machine.name,
            operation: "qr_code_generation",
          },
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }

      return transformMachineResponse(machineWithRelations);
    }),

  getAll: orgScopedProcedure
    .input(machineFilterSchema.optional())
    .query(async ({ ctx, input: _input }): Promise<MachineResponse[]> => {
      const machinesWithRelations = await ctx.db
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
          model: {
            id: models.id,
            name: models.name,
            manufacturer: models.manufacturer,
            year: models.year,
            machine_type: models.machine_type,
            ipdb_link: models.ipdb_link,
            opdb_id: models.opdb_id,
          },
          location: {
            id: locations.id,
            name: locations.name,
            street: locations.street,
            city: locations.city,
            state: locations.state,
            zip: locations.zip,
          },
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
            profile_picture: users.profile_picture,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.model_id, models.id))
        .innerJoin(locations, eq(machines.location_id, locations.id))
        .leftJoin(users, eq(machines.owner_id, users.id))
        .orderBy(asc(models.name));

      return transformMachinesResponse(machinesWithRelations);
    }),

  // Public endpoint for issue reporting - returns minimal data needed for issue form
  getAllForIssues: anonOrgScopedProcedure.query(
    async ({ ctx }): Promise<MachineForIssues[]> => {
      const machinesForIssues = await ctx.db
        .select({
          id: machines.id,
          name: machines.name,
          model: {
            id: models.id,
            name: models.name,
            manufacturer: models.manufacturer,
            year: models.year,
          },
          location: {
            id: locations.id,
            name: locations.name,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.model_id, models.id))
        .innerJoin(locations, eq(machines.location_id, locations.id))
        .where(eq(machines.organization_id, ctx.organizationId))
        .orderBy(asc(models.name));

      return transformMachinesForIssuesResponse(machinesForIssues);
    },
  ),

  getById: orgScopedProcedure
    .input(machineIdSchema)
    .query(async ({ ctx, input }): Promise<MachineResponse> => {
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
            machinesCount: sql<number>`(
              SELECT COUNT(*) FROM ${machines}
              WHERE ${machines.model_id} = ${models.id}
            )`,
          },
          location: {
            id: locations.id,
            name: locations.name,
            street: locations.street,
            city: locations.city,
            state: locations.state,
            zip: locations.zip,
          },
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
            profile_picture: users.profile_picture,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.model_id, models.id))
        .innerJoin(locations, eq(machines.location_id, locations.id))
        .leftJoin(users, eq(machines.owner_id, users.id))
        .where(eq(machines.id, input.id))
        .limit(1);

      if (!machineWithRelations) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game instance not found",
        });
      }

      return transformMachineResponse(machineWithRelations);
    }),

  update: machineEditProcedure
    .input(machineUpdateSchema)
    .mutation(async ({ ctx, input }): Promise<MachineResponse> => {
      // First verify the game instance exists (RLS handles org scoping)
      const [existingMachine] = await ctx.db
        .select()
        .from(machines)
        .where(eq(machines.id, input.id))
        .limit(1);

      if (!existingMachine) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found or not accessible",
        });
      }

      // If updating model or location, verify they exist (RLS handles org scoping)
      if (input.modelId) {
        const [model] = await ctx.db
          .select()
          .from(models)
          .where(eq(models.id, input.modelId))
          .limit(1);

        if (!model) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Game title not found",
          });
        }
      }

      if (input.locationId) {
        const [location] = await ctx.db
          .select()
          .from(locations)
          .where(eq(locations.id, input.locationId))
          .limit(1);

        if (!location) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Location not found or not accessible",
          });
        }
      }

      // Prepare update data
      const updateData: {
        name?: string;
        model_id?: string;
        location_id?: string;
      } = {};
      if (input.name) updateData.name = input.name;
      if (input.modelId) updateData.model_id = input.modelId;
      if (input.locationId) updateData.location_id = input.locationId;

      // Update machine (RLS handles org scoping)
      const [updatedMachine] = await ctx.db
        .update(machines)
        .set(updateData)
        .where(eq(machines.id, input.id))
        .returning();

      if (!updatedMachine) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found or not accessible",
        });
      }

      // Get updated machine with all relationships
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
            machinesCount: sql<number>`(
              SELECT COUNT(*) FROM ${machines}
              WHERE ${machines.model_id} = ${models.id}
            )`,
          },
          location: {
            id: locations.id,
            name: locations.name,
            street: locations.street,
            city: locations.city,
            state: locations.state,
            zip: locations.zip,
          },
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
            profile_picture: users.profile_picture,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.model_id, models.id))
        .innerJoin(locations, eq(machines.location_id, locations.id))
        .leftJoin(users, eq(machines.owner_id, users.id))
        .where(eq(machines.id, input.id))
        .limit(1);

      if (!machineWithRelations) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve updated machine",
        });
      }

      return transformMachineResponse(machineWithRelations);
    }),

  delete: machineDeleteProcedure
    .input(machineIdSchema)
    .mutation(async ({ ctx, input }): Promise<MachineResponse> => {
      // Verify the game instance exists (RLS handles org scoping)
      const [existingMachine] = await ctx.db
        .select()
        .from(machines)
        .where(eq(machines.id, input.id))
        .limit(1);

      if (!existingMachine) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Game instance not found",
        });
      }

      // Delete the machine
      const [deletedMachine] = await ctx.db
        .delete(machines)
        .where(eq(machines.id, input.id))
        .returning();

      if (!deletedMachine) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete machine",
        });
      }

      return transformMachineResponse(deletedMachine);
    }),
});
