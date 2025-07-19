import { z } from "zod";
import { type Machine, type QRCode } from "@prisma/client";
import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
  machineEditProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { type QRCodeInfo } from "~/server/services/QRCodeService";

export const qrCodeRouter = createTRPCRouter({
  /**
   * Generate QR code for a specific machine
   */
  generate: machineEditProcedure
    .input(z.object({ machineId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<QRCode> => {
      // The machineEditProcedure already validates machine access
      const qrCodeService = ctx.services.createQRCodeService();
      return qrCodeService.generateQRCode(input.machineId);
    }),

  /**
   * Get QR code information for a specific machine
   */
  getInfo: organizationProcedure
    .input(z.object({ machineId: z.string() }))
    .query(async ({ ctx, input }): Promise<QRCodeInfo | null> => {
      // Verify machine belongs to organization
      const machine = await ctx.db.machine.findUnique({
        where: {
          id: input.machineId,
          organizationId: ctx.organization.id,
        },
      });

      if (!machine) {
        throw new Error("Machine not found");
      }

      const qrCodeService = ctx.services.createQRCodeService();
      return qrCodeService.getQRCodeInfo(input.machineId);
    }),

  /**
   * Regenerate QR code for a specific machine
   */
  regenerate: machineEditProcedure
    .input(z.object({ machineId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<QRCode> => {
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
    .query(async ({ ctx, input }): Promise<Machine> => {
      const qrCodeService = ctx.services.createQRCodeService();
      const machine = await qrCodeService.resolveMachineFromQR(input.qrCodeId);

      if (!machine) {
        throw new Error("Invalid QR code");
      }

      return machine;
    }),
});
