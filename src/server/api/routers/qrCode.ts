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
      // Verify machine exists and is accessible (RLS handles org scoping)
      const machine = await getSingleRecordWithLimit(
        ctx.db
          .select()
          .from(machines)
          .where(eq(machines.id, input.machineId))
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
   * Generate QR codes for all machines without QR codes in the organization (RLS scoped)
   */
  generateBulk: organizationManageProcedure.mutation(async ({ ctx }) => {
    const qrCodeService = ctx.services.createQRCodeService();
    return qrCodeService.generateQRCodesForOrganization();
  }),

  /**
   * Regenerate QR codes for all machines in the organization (RLS scoped)
   */
  regenerateBulk: organizationManageProcedure.mutation(async ({ ctx }) => {
    const qrCodeService = ctx.services.createQRCodeService();
    return qrCodeService.regenerateQRCodesForOrganization();
  }),

  /**
   * Get QR code statistics for the organization (RLS scoped)
   */
  getStats: organizationProcedure.query(async ({ ctx }) => {
    const qrCodeService = ctx.services.createQRCodeService();
    return qrCodeService.getOrganizationQRCodeStats();
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
