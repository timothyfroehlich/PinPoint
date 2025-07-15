import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  machineEditProcedure,
  organizationManageProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { QRCodeService } from "~/server/services/qrCodeService";

export const qrCodeRouter = createTRPCRouter({
  // Generate QR code for a machine
  generate: machineEditProcedure
    .input(z.object({ machineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new QRCodeService(ctx.db);
      return service.generateQRCode(input.machineId);
    }),

  // Get QR code info for a machine
  getInfo: organizationProcedure
    .input(z.object({ machineId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new QRCodeService(ctx.db);
      const info = await service.getQRCodeInfo(input.machineId);

      if (!info) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found",
        });
      }

      return info;
    }),

  // Regenerate QR code for a machine
  regenerate: machineEditProcedure
    .input(z.object({ machineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new QRCodeService(ctx.db);
      return service.regenerateQRCode(input.machineId);
    }),

  // Bulk generate QR codes for organization
  generateBulk: organizationManageProcedure.mutation(async ({ ctx }) => {
    const service = new QRCodeService(ctx.db);
    return service.generateQRCodesForOrganization(ctx.organization.id);
  }),

  // Public endpoint: Resolve machine from QR code
  resolve: publicProcedure
    .input(z.object({ qrCodeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new QRCodeService(ctx.db);
      const result = await service.resolveMachineFromQR(input.qrCodeId);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "QR code not found",
        });
      }

      return result;
    }),
});
