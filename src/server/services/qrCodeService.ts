import { type PrismaClient } from "@prisma/client";
import QRCode from "qrcode";

import { imageStorage } from "~/lib/image-storage/local-storage";

export interface QRCodeData {
  machineId: string;
  organizationId: string;
  qrCodeId: string;
}

export interface QRCodeInfo {
  qrCodeUrl: string;
  reportUrl: string;
  machineInfo: {
    id: string;
    modelName: string;
    locationName: string;
    organizationName: string;
  };
}

export class QRCodeService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate QR code for a machine
   */
  async generateQRCode(machineId: string): Promise<QRCodeInfo> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        model: true,
        location: true,
        organization: true,
      },
    });

    if (!machine) {
      throw new Error("Machine not found");
    }

    // Create the URL that the QR code will point to
    const reportUrl = `https://${machine.organization.subdomain}.pinpoint.app/machines/${machine.id}/report-issue`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(reportUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Convert data URL to File for upload
    const response = await fetch(qrCodeDataUrl);
    const blob = await response.blob();
    const file = new File([blob], `qr-${machine.qrCodeId}.png`, {
      type: "image/png",
    });

    // Upload QR code image
    const qrCodeUrl = await imageStorage.uploadImage(
      file,
      `qr-codes/machine-${machineId}`,
    );

    // Update machine with QR code info
    await this.prisma.machine.update({
      where: { id: machineId },
      data: {
        qrCodeUrl,
        qrCodeGeneratedAt: new Date(),
      },
    });

    return {
      qrCodeUrl,
      reportUrl,
      machineInfo: {
        id: machine.id,
        modelName: machine.model.name,
        locationName: machine.location.name,
        organizationName: machine.organization.name,
      },
    };
  }

  /**
   * Get QR code information for a machine
   */
  async getQRCodeInfo(machineId: string): Promise<QRCodeInfo | null> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        model: true,
        location: true,
        organization: true,
      },
    });

    if (!machine) {
      return null;
    }

    const reportUrl = `https://${machine.organization.subdomain}.pinpoint.app/machines/${machine.id}/report-issue`;

    return {
      qrCodeUrl: machine.qrCodeUrl || "",
      reportUrl,
      machineInfo: {
        id: machine.id,
        modelName: machine.model.name,
        locationName: machine.location.name,
        organizationName: machine.organization.name,
      },
    };
  }

  /**
   * Regenerate QR code for a machine
   */
  async regenerateQRCode(machineId: string): Promise<QRCodeInfo> {
    // Delete old QR code if it exists
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      select: { qrCodeUrl: true },
    });

    if (machine?.qrCodeUrl) {
      try {
        await imageStorage.deleteImage(machine.qrCodeUrl);
      } catch (error) {
        console.warn("Failed to delete old QR code:", error);
      }
    }

    // Generate new QR code
    return this.generateQRCode(machineId);
  }

  /**
   * Resolve machine information from QR code scan
   */
  async resolveMachineFromQR(qrCodeId: string): Promise<{
    machine: {
      id: string;
      modelName: string;
      locationName: string;
      organizationName: string;
      organizationSubdomain: string;
    };
    reportUrl: string;
  } | null> {
    const machine = await this.prisma.machine.findUnique({
      where: { qrCodeId },
      include: {
        model: true,
        location: true,
        organization: true,
      },
    });

    if (!machine) {
      return null;
    }

    const reportUrl = `https://${machine.organization.subdomain}.pinpoint.app/machines/${machine.id}/report-issue`;

    return {
      machine: {
        id: machine.id,
        modelName: machine.model.name,
        locationName: machine.location.name,
        organizationName: machine.organization.name,
        organizationSubdomain: machine.organization.subdomain || "",
      },
      reportUrl,
    };
  }

  /**
   * Bulk generate QR codes for all machines in an organization
   */
  async generateQRCodesForOrganization(organizationId: string): Promise<{
    generated: number;
    failed: number;
    errors: string[];
  }> {
    const machines = await this.prisma.machine.findMany({
      where: { organizationId },
      select: { id: true },
    });

    let generated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const machine of machines) {
      try {
        await this.generateQRCode(machine.id);
        generated++;
      } catch (error) {
        failed++;
        errors.push(
          `Machine ${machine.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return { generated, failed, errors };
  }
}
