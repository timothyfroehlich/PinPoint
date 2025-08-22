import { TRPCError } from "@trpc/server";
import { eq, sql, asc } from "drizzle-orm";
import { z } from "zod";

import { generatePrefixedId } from "~/lib/utils/id-generation";
import {
  createTRPCRouter,
  orgScopedProcedure,
  publicProcedure,
  machineEditProcedure,
  machineDeleteProcedure,
} from "~/server/api/trpc";
import { machines, models, locations, users } from "~/server/db/schema";

export const machineCoreRouter = createTRPCRouter({
  create: machineEditProcedure
    .input(
      z.object({
        name: z.string().optional(),
        modelId: z.string(),
        locationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
        throw new Error("Invalid game title or location");
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
          modelId: input.modelId,
          locationId: input.locationId,
          qrCodeId: qrCodeId,
          organizationId: ctx.organizationId,
        })
        .returning();

      if (!machine) {
        throw new Error("Failed to create machine");
      }

      // Get machine with all relationships for return
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
            machinesCount: sql<number>`(
              SELECT COUNT(*) FROM ${machines} 
              WHERE ${machines.modelId} = ${models.id}
            )`,
          },
          location: locations,
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.modelId, models.id))
        .innerJoin(locations, eq(machines.locationId, locations.id))
        .leftJoin(users, eq(machines.ownerId, users.id))
        .where(eq(machines.id, machine.id))
        .limit(1);

      if (!machineWithRelations) {
        throw new Error("Failed to retrieve created machine");
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

      return machineWithRelations;
    }),

  getAll: orgScopedProcedure.query(async ({ ctx }) => {
    const machinesWithRelations = await ctx.db
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
        model: models,
        location: locations,
        owner: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(machines)
      .innerJoin(models, eq(machines.modelId, models.id))
      .innerJoin(locations, eq(machines.locationId, locations.id))
      .leftJoin(users, eq(machines.ownerId, users.id))
      .orderBy(asc(models.name));

    return machinesWithRelations;
  }),

  // Public endpoint for issue reporting - returns minimal data needed for issue form
  getAllForIssues: publicProcedure.query(async ({ ctx }) => {
    // Use the organization resolved from subdomain context
    const organization = ctx.organization;

    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    const machinesForIssues = await ctx.db
      .select({
        id: machines.id,
        name: machines.name,
        model: {
          name: models.name,
        },
      })
      .from(machines)
      .innerJoin(models, eq(machines.modelId, models.id))
      .orderBy(asc(models.name));

    return machinesForIssues;
  }),

  getById: orgScopedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
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
            machinesCount: sql<number>`(
              SELECT COUNT(*) FROM ${machines} 
              WHERE ${machines.modelId} = ${models.id}
            )`,
          },
          location: locations,
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.modelId, models.id))
        .innerJoin(locations, eq(machines.locationId, locations.id))
        .leftJoin(users, eq(machines.ownerId, users.id))
        .where(eq(machines.id, input.id))
        .limit(1);

      if (!machineWithRelations) {
        throw new Error("Game instance not found");
      }

      return machineWithRelations;
    }),

  update: machineEditProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        modelId: z.string().optional(),
        locationId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
        modelId?: string;
        locationId?: string;
      } = {};
      if (input.name) updateData.name = input.name;
      if (input.modelId) updateData.modelId = input.modelId;
      if (input.locationId) updateData.locationId = input.locationId;

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
            machinesCount: sql<number>`(
              SELECT COUNT(*) FROM ${machines} 
              WHERE ${machines.modelId} = ${models.id}
            )`,
          },
          location: locations,
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.modelId, models.id))
        .innerJoin(locations, eq(machines.locationId, locations.id))
        .leftJoin(users, eq(machines.ownerId, users.id))
        .where(eq(machines.id, input.id))
        .limit(1);

      if (!machineWithRelations) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve updated machine",
        });
      }

      return machineWithRelations;
    }),

  delete: machineDeleteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the game instance exists (RLS handles org scoping)
      const [existingMachine] = await ctx.db
        .select()
        .from(machines)
        .where(eq(machines.id, input.id))
        .limit(1);

      if (!existingMachine) {
        throw new Error("Game instance not found");
      }

      // Delete the machine
      const [deletedMachine] = await ctx.db
        .delete(machines)
        .where(eq(machines.id, input.id))
        .returning();

      if (!deletedMachine) {
        throw new Error("Failed to delete machine");
      }

      return deletedMachine;
    }),
});
