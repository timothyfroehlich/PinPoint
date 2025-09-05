import { z } from "zod";

// Validation schemas
import { idSchema, descriptionSchema, collectionNameSchema } from "~/lib/validation/schemas";

import {
  createTRPCRouter,
  publicProcedure,
  orgScopedProcedure,
  organizationManageProcedure,
  locationEditProcedure,
} from "~/server/api/trpc";

export const collectionRouter = createTRPCRouter({
  // Public: Get collections for location filtering (RLS scoped)
  getForLocation: publicProcedure
    .input(
      z.object({
        locationId: idSchema,
        organizationId: idSchema, // Still needed for public API compatibility
      }),
    )
    .query(async ({ ctx, input }) => {
      const service = ctx.services.createCollectionService();
      return service.getLocationCollections(input.locationId);
    }),

  // Get machines in a collection
  getMachines: publicProcedure
    .input(
      z.object({
        collectionId: idSchema,
        locationId: idSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const service = ctx.services.createCollectionService();
      return service.getCollectionMachines(
        input.collectionId,
        input.locationId,
      );
    }),

  // Create manual collection
  createManual: locationEditProcedure
    .input(
      z.object({
        name: collectionNameSchema,
        typeId: idSchema,
        locationId: z.string().optional(), // Keep as string since it may come from client
        description: descriptionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = ctx.services.createCollectionService();

      const data: {
        name: string;
        typeId: string;
        locationId?: string;
        description?: string;
      } = {
        name: input.name,
        typeId: input.typeId,
      };

      if (input.locationId) {
        data.locationId = input.locationId;
      }

      if (input.description) {
        data.description = input.description;
      }

      return service.createManualCollection(data);
    }),

  // Add machines to collection
  addMachines: locationEditProcedure
    .input(
      z.object({
        collectionId: idSchema,
        machineIds: z.array(idSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = ctx.services.createCollectionService();
      await service.addMachinesToCollection(
        input.collectionId,
        input.machineIds,
      );
      return { success: true };
    }),

  // Generate auto-collections (RLS scoped)
  generateAuto: organizationManageProcedure.mutation(async ({ ctx }) => {
    const service = ctx.services.createCollectionService();
    return service.generateAutoCollections();
  }),

  // Get organization collection types for admin (RLS scoped)
  getTypes: orgScopedProcedure.query(async ({ ctx }) => {
    const service = ctx.services.createCollectionService();
    return service.getOrganizationCollectionTypes();
  }),

  // Toggle collection type
  toggleType: organizationManageProcedure
    .input(
      z.object({
        collectionTypeId: idSchema,
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = ctx.services.createCollectionService();
      await service.toggleCollectionType(input.collectionTypeId, input.enabled);
      return { success: true };
    }),
});
