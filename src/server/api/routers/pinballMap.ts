import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationManageProcedure,
} from "~/server/api/trpc";

export const pinballMapRouter = createTRPCRouter({
  // Enable PinballMap integration for organization
  enableIntegration: organizationManageProcedure.mutation(async ({ ctx }) => {
    const service = ctx.services.createPinballMapService();
    if (!ctx.organization?.id) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }
    await service.enableIntegration(ctx.organization.id as string);
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
      if (!ctx.organization?.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }
      await service.configureLocationSync(
        input.locationId,
        input.pinballMapId,
        ctx.organization.id as string,
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

  // Get sync status for organization
  getSyncStatus: organizationManageProcedure.query(async ({ ctx }) => {
    const service = ctx.services.createPinballMapService();
    if (!ctx.organization?.id) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }
    return service.getOrganizationSyncStatus(ctx.organization.id as string);
  }),
});
