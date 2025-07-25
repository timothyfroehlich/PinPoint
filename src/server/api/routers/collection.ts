import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  organizationProcedure,
  organizationManageProcedure,
  locationEditProcedure,
} from "~/server/api/trpc";

export const collectionRouter = createTRPCRouter({
  // Public: Get collections for location filtering
  getForLocation: publicProcedure
    .input(
      z.object({
        locationId: z.string(),
        organizationId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const service = ctx.services.createCollectionService();
      return service.getLocationCollections(
        input.locationId,
        input.organizationId,
      );
    }),

  // Get machines in a collection
  getMachines: publicProcedure
    .input(
      z.object({
        collectionId: z.string(),
        locationId: z.string(),
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
        name: z.string().min(1).max(50),
        typeId: z.string(),
        locationId: z.string().optional(),
        description: z.string().optional(),
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

      return service.createManualCollection(ctx.organization.id, data);
    }),

  // Add machines to collection
  addMachines: locationEditProcedure
    .input(
      z.object({
        collectionId: z.string(),
        machineIds: z.array(z.string()),
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

  // Generate auto-collections
  generateAuto: organizationManageProcedure.mutation(async ({ ctx }) => {
    const service = ctx.services.createCollectionService();
    return service.generateAutoCollections(ctx.organization.id);
  }),

  // Get organization collection types for admin
  getTypes: organizationProcedure.query(async ({ ctx }) => {
    const service = ctx.services.createCollectionService();
    return service.getOrganizationCollectionTypes(ctx.organization.id);
  }),

  // Toggle collection type
  toggleType: organizationManageProcedure
    .input(
      z.object({
        collectionTypeId: z.string(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = ctx.services.createCollectionService();
      await service.toggleCollectionType(input.collectionTypeId, input.enabled);
      return { success: true };
    }),
});
