import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
  machineEditProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { machines } from "~/server/db/schema";
import {
  getSingleRecordWithLimit,
  COMMON_ERRORS,
} from "~/server/db/utils/common-queries";

export const qrCodeRouter = createTRPCRouter({
  /**
   * Generate QR code for a specific machine
   */
  generate: machineEditProcedure
    .input(z.object({ machineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // The machineEditProcedure already validates machine access
      const qrCodeService = ctx.services.createQRCodeService();
      return qrCodeService.generateQRCode(input.machineId);
    }),

  /**
   * Get QR code information for a specific machine
   */
  getInfo: organizationProcedure
    .input(z.object({ machineId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify machine belongs to organization

      const machine = await getSingleRecordWithLimit(
        ctx.drizzle
          .select()
          .from(machines)
          .where(
            and(
              eq(machines.id, input.machineId),
              eq(machines.organizationId, ctx.organization.id),
            ),
          )
          .$dynamic(),
      );

      if (!machine) {
        throw new Error(COMMON_ERRORS.NOT_IN_ORGANIZATION);
      }

      const qrCodeService = ctx.services.createQRCodeService();
      return qrCodeService.getQRCodeInfo(input.machineId);
    }),

  /**
   * Regenerate QR code for a specific machine
   */
  regenerate: machineEditProcedure
    .input(z.object({ machineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // The machineEditProcedure already validates machine access
      const qrCodeService = ctx.services.createQRCodeService();
      return qrCodeService.regenerateQRCode(input.machineId);
    }),

  /**
   * Generate QR codes for all machines without QR codes in the organization
   */
  generateBulk: organizationManageProcedure.mutation(async ({ ctx }) => {
    const qrCodeService = ctx.services.createQRCodeService();
    return qrCodeService.generateQRCodesForOrganization(ctx.organization.id);
  }),

  /**
   * Regenerate QR codes for all machines in the organization
   */
  regenerateBulk: organizationManageProcedure.mutation(async ({ ctx }) => {
    const qrCodeService = ctx.services.createQRCodeService();
    return qrCodeService.regenerateQRCodesForOrganization(ctx.organization.id);
  }),

  /**
   * Get QR code statistics for the organization
   */
  getStats: organizationProcedure.query(async ({ ctx }) => {
    const qrCodeService = ctx.services.createQRCodeService();
    return qrCodeService.getOrganizationQRCodeStats(ctx.organization.id);
  }),

  /**
   * Public endpoint to resolve machine information from QR code
   * This is used when someone scans a QR code
   */
  resolve: publicProcedure
    .input(z.object({ qrCodeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const qrCodeService = ctx.services.createQRCodeService();
      const machine = await qrCodeService.resolveMachineFromQR(input.qrCodeId);

      if (!machine) {
        throw new Error("Invalid QR code");
      }

      return machine;
    }),
});
