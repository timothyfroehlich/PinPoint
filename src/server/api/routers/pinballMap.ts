import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationManageProcedure,
} from "~/server/api/trpc";

export const pinballMapRouter = createTRPCRouter({
  // Enable PinballMap integration for organization (RLS scoped)
  enableIntegration: organizationManageProcedure.mutation(async ({ ctx }) => {
    const service = ctx.services.createPinballMapService();
    await service.enableIntegration(ctx.organization.id); // Still needed for ID generation
    return { success: true };
  }),

  // Configure location for sync
  configureLocation: organizationManageProcedure
    .input(
      z.object({
        locationId: z.string(),
        pinballMapId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = ctx.services.createPinballMapService();
      await service.configureLocationSync(
        input.locationId,
        input.pinballMapId,
        ctx.organization.id,
      );
      return { success: true };
    }),

  // Sync a specific location
  syncLocation: organizationManageProcedure
    .input(z.object({ locationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = ctx.services.createPinballMapService();
      const result = await service.syncLocation(input.locationId);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Sync failed",
        });
      }

      return result;
    }),

  // Get sync status for organization (RLS scoped)
  getSyncStatus: organizationManageProcedure.query(async ({ ctx }) => {
    const service = ctx.services.createPinballMapService();
    return service.getOrganizationSyncStatus(ctx.organization.id);
  }),
});
