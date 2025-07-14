import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { PinballMapService } from "~/server/services/pinballmapService";

export const pinballMapRouter = createTRPCRouter({
  // Enable PinballMap integration for organization
  enableIntegration: organizationManageProcedure.mutation(async ({ ctx }) => {
    const service = new PinballMapService(ctx.db);
    await service.enableIntegration(ctx.organization.id);
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
      const service = new PinballMapService(ctx.db);
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
      const service = new PinballMapService(ctx.db);
      const result = await service.syncLocation(input.locationId);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Sync failed",
        });
      }

      return result;
    }),

  // Get sync status for organization
  getSyncStatus: organizationManageProcedure.query(async ({ ctx }) => {
    const service = new PinballMapService(ctx.db);
    return service.getOrganizationSyncStatus(ctx.organization.id);
  }),
});
