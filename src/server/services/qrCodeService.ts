import * as QRCode from "qrcode";

import { type Machine, type ExtendedPrismaClient } from "./types";

import { imageStorage } from "~/lib/image-storage/local-storage";
import { constructReportUrl } from "~/server/utils/qrCodeUtils";

export interface QRCodeInfo {
  id: string;
  url: string | null;
  generatedAt: Date | null;
}

export interface MachineFromQRCode {
  id: string;
  name: string;
  organizationId: string;
  locationId: string;
  model: {
    name: string;
    manufacturer: string | null;
  };
  location: {
    name: string;
  };
  organization: {
    name: string;
    subdomain: string | null;
  };
}

export interface BulkGenerationResult {
  generated: number;
  failed: number;
  total: number;
}

export class QRCodeService {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Generate QR code for a machine
   */
  async generateQRCode(machineId: string): Promise<QRCodeInfo> {
    // Get machine details for QR code content
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        organization: {
          select: { subdomain: true },
        },
      },
    });

    if (!machine) {
      throw new Error("Machine not found");
    }

    // Generate QR code content URL
    const qrContent = this.generateQRCodeContent(machine);

    // Generate QR code as buffer
    const qrCodeBuffer = await QRCode.toBuffer(qrContent, {
      type: "png",
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Upload QR code image directly from buffer
    const qrCodeUrl = await imageStorage.uploadQRCode(
      qrCodeBuffer,
      `qr-codes/machine-${String(machine.id)}/qr-code-${String(machine.id)}`,
    );

    // Update machine with QR code information
    const updatedMachine = await this.prisma.machine.update({
      where: { id: machineId },
      data: {
        qrCodeUrl,
        qrCodeGeneratedAt: new Date(),
      },
      select: {
        qrCodeId: true,
        qrCodeUrl: true,
        qrCodeGeneratedAt: true,
      },
    });

    return {
      id: updatedMachine.qrCodeId ?? "",
      url: updatedMachine.qrCodeUrl,
      generatedAt: updatedMachine.qrCodeGeneratedAt,
    };
  }

  /**
   * Get QR code information for a machine
   */
  async getQRCodeInfo(machineId: string): Promise<QRCodeInfo | null> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      select: {
        qrCodeId: true,
        qrCodeUrl: true,
        qrCodeGeneratedAt: true,
      },
    });

    if (!machine) {
      throw new Error("Machine not found");
    }

    if (!machine.qrCodeUrl || !machine.qrCodeGeneratedAt || !machine.qrCodeId) {
      return null;
    }

    return {
      id: machine.qrCodeId,
      url: machine.qrCodeUrl,
      generatedAt: machine.qrCodeGeneratedAt,
    };
  }

  /**
   * Regenerate QR code for a machine (delete old and create new)
   */
  async regenerateQRCode(machineId: string): Promise<QRCodeInfo> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      select: { qrCodeUrl: true },
    });

    if (!machine) {
      throw new Error("Machine not found");
    }

    // Delete old QR code image if it exists
    if (machine.qrCodeUrl) {
      try {
        await imageStorage.deleteImage(machine.qrCodeUrl);
      } catch (error) {
        // Log error but don't fail regeneration
        console.warn(`Failed to delete old QR code image: ${String(error)}`);
      }
    }

    // Generate new QR code
    return this.generateQRCode(machineId);
  }

  /**
   * Resolve machine information from QR code ID
   */
  async resolveMachineFromQR(
    qrCodeId: string,
  ): Promise<MachineFromQRCode | null> {
    const machine = await this.prisma.machine.findUnique({
      where: { qrCodeId },
      include: {
        model: {
          select: {
            name: true,
            manufacturer: true,
          },
        },
        location: {
          select: {
            name: true,
          },
        },
        organization: {
          select: {
            name: true,
            subdomain: true,
          },
        },
      },
    });

    if (!machine) {
      return null;
    }

    return {
      id: machine.id,
      name: machine.name,
      organizationId: machine.organizationId,
      locationId: machine.locationId,
      model: machine.model,
      location: machine.location,
      organization: machine.organization,
    };
  }

  /**
   * Generate QR codes for all machines in an organization
   */
  async generateQRCodesForOrganization(
    organizationId: string,
  ): Promise<BulkGenerationResult> {
    const machines = await this.prisma.machine.findMany({
      where: {
        organizationId,
        qrCodeUrl: null, // Only generate for machines without QR codes
      },
      select: { id: true },
    });

    let generated = 0;
    let failed = 0;
    const total = machines.length;

    for (const machine of machines) {
      try {
        await this.generateQRCode(machine.id);
        generated++;
      } catch (error) {
        console.error(
          `Failed to generate QR code for machine ${String(machine.id)}:`,
          error,
        );
        failed++;
      }
    }

    return { generated, failed, total };
  }

  /**
   * Generate QR codes for all machines in an organization (including regeneration)
   */
  async regenerateQRCodesForOrganization(
    organizationId: string,
  ): Promise<BulkGenerationResult> {
    const machines = await this.prisma.machine.findMany({
      where: { organizationId },
      select: { id: true },
    });

    let generated = 0;
    let failed = 0;
    const total = machines.length;

    for (const machine of machines) {
      try {
        await this.regenerateQRCode(machine.id);
        generated++;
      } catch (error) {
        console.error(
          `Failed to regenerate QR code for machine ${String(machine.id)}:`,
          error,
        );
        failed++;
      }
    }

    return { generated, failed, total };
  }

  /**
   * Generate the QR code content URL based on machine and organization
   */
  private generateQRCodeContent(
    machine: Machine & { organization: { subdomain: string | null } },
  ): string {
    return constructReportUrl(machine);
  }

  /**
   * Get QR code statistics for an organization
   */
  async getOrganizationQRCodeStats(organizationId: string): Promise<{
    total: number;
    withQRCodes: number;
    withoutQRCodes: number;
  }> {
    const [total, withQRCodes] = await Promise.all([
      this.prisma.machine.count({
        where: { organizationId },
      }),
      this.prisma.machine.count({
        where: {
          organizationId,
          qrCodeUrl: { not: null },
        },
      }),
    ]);

    return {
      total,
      withQRCodes,
      withoutQRCodes: total - withQRCodes,
    };
  }
}
