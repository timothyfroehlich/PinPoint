import { eq, isNull, count } from "drizzle-orm";
import * as QRCode from "qrcode";

import { imageStorage } from "~/lib/image-storage/local-storage";
import { logger } from "~/lib/logger";
import { type DrizzleClient } from "../db/drizzle";
import { machines } from "../db/schema";
import { constructReportUrl } from "../utils/qrCodeUtils";
import { getErrorMessage } from "~/lib/utils/type-guards";
import { safeCount, type CountResult } from "~/lib/types/database-results";

interface QRCodeInfo {
  id: string;
  url: string | null;
  generatedAt: Date | null;
}

interface MachineFromQRCode {
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
    subdomain: string; // Non-null to match database schema
  };
}

interface BulkGenerationResult {
  generated: number;
  failed: number;
  total: number;
}

export class QRCodeService {
  constructor(private db: DrizzleClient) {}

  /**
   * Generate QR code for a machine
   */
  async generateQRCode(machineId: string): Promise<QRCodeInfo> {
    // Get machine details for QR code content
    const machine = await this.db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      with: {
        organization: {
          columns: { subdomain: true },
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
      `qr-codes/machine-${machine.id}/qr-code-${machine.id}`,
    );

    // Update machine with QR code information
    const [updatedMachine] = await this.db
      .update(machines)
      .set({
        qr_code_url: qrCodeUrl,
        qr_code_generated_at: new Date(),
      })
      .where(eq(machines.id, machineId))
      .returning({
        qrCodeId: machines.qr_code_id,
        qrCodeUrl: machines.qr_code_url,
        qrCodeGeneratedAt: machines.qr_code_generated_at,
      });

    if (!updatedMachine) {
      throw new Error("Failed to update machine QR code");
    }

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
    const machine = await this.db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      columns: {
        qr_code_id: true,
        qr_code_url: true,
        qr_code_generated_at: true,
      },
    });

    if (!machine) {
      throw new Error("Machine not found");
    }

    // Use || to check for falsy values - QR code validation requires non-empty strings and valid dates
    if (
      !machine.qr_code_url ||
      !machine.qr_code_generated_at ||
      !machine.qr_code_id
    ) {
      return null;
    }

    return {
      id: machine.qr_code_id,
      url: machine.qr_code_url,
      generatedAt: machine.qr_code_generated_at,
    };
  }

  /**
   * Regenerate QR code for a machine (delete old and create new)
   */
  async regenerateQRCode(machineId: string): Promise<QRCodeInfo> {
    const machine = await this.db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      columns: { qr_code_url: true },
    });

    if (!machine) {
      throw new Error("Machine not found");
    }

    // Delete old QR code image if it exists
    if (machine.qr_code_url) {
      try {
        await imageStorage.deleteImage(machine.qr_code_url);
      } catch (error) {
        // Log error but don't fail regeneration
        logger.warn({
          msg: "Failed to delete old QR code image",
          component: "qrCodeService.regenerateQRCode",
          context: {
            machineId,
            qrCodeUrl: machine.qr_code_url,
            operation: "delete_old_qr_image",
          },
          error: {
            message: getErrorMessage(error),
          },
        });
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
    const machine = await this.db.query.machines.findFirst({
      where: eq(machines.qr_code_id, qrCodeId),
      columns: {
        id: true,
        name: true,
        organization_id: true,
        location_id: true,
      },
      with: {
        model: {
          columns: {
            name: true,
            manufacturer: true,
          },
        },
        location: {
          columns: {
            name: true,
          },
        },
        organization: {
          columns: {
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
      organizationId: machine.organization_id,
      locationId: machine.location_id,
      model: machine.model,
      location: machine.location,
      organization: machine.organization,
    };
  }

  /**
   * Generate QR codes for all machines in organization (RLS scoped)
   */
  async generateQRCodesForOrganization(): Promise<BulkGenerationResult> {
    const machineList = await this.db.query.machines.findMany({
      where: isNull(machines.qr_code_url), // Only generate for machines without QR codes
      columns: { id: true },
    });

    let generated = 0;
    let failed = 0;
    const total = machineList.length;

    for (const machine of machineList) {
      try {
        await this.generateQRCode(machine.id);
        generated++;
      } catch (error) {
        logger.error({
          msg: "Failed to generate QR code for machine",
          component: "qrCodeService.generateQRCodesForOrganization",
          context: {
            machineId: machine.id,
            operation: "bulk_generate",
            stats: { generated, failed, total },
          },
          error: {
            message: getErrorMessage(error),
          },
        });
        failed++;
      }
    }

    return { generated, failed, total };
  }

  /**
   * Generate QR codes for all machines in organization (including regeneration, RLS scoped)
   */
  async regenerateQRCodesForOrganization(): Promise<BulkGenerationResult> {
    const machineList = await this.db.query.machines.findMany({
      columns: { id: true },
    });

    let generated = 0;
    let failed = 0;
    const total = machineList.length;

    for (const machine of machineList) {
      try {
        await this.regenerateQRCode(machine.id);
        generated++;
      } catch (error) {
        logger.error({
          msg: "Failed to regenerate QR code for machine",
          component: "qrCodeService.regenerateQRCodesForOrganization",
          context: {
            machineId: machine.id,
            operation: "bulk_regenerate",
            stats: { generated, failed, total },
          },
          error: {
            message: getErrorMessage(error),
          },
        });
        failed++;
      }
    }

    return { generated, failed, total };
  }

  /**
   * Generate the QR code content URL based on machine and organization
   */
  private generateQRCodeContent(machine: {
    id: string;
    organization: { subdomain: string };
  }): string {
    return constructReportUrl(machine);
  }

  /**
   * Get QR code statistics for organization (RLS scoped)
   */
  async getOrganizationQRCodeStats(): Promise<{
    total: number;
    withQRCodes: number;
    withoutQRCodes: number;
  }> {
    const [totalResult, withoutQRCodesResult]: [
      CountResult[],
      CountResult[]
    ] = await Promise.all([
      this.db.select({ count: count() }).from(machines),
      this.db
        .select({ count: count() })
        .from(machines)
        .where(isNull(machines.qr_code_url)),
    ]);

    const total = safeCount(totalResult);
    const withoutQRCodes = safeCount(withoutQRCodesResult);
    const withQRCodes = total - withoutQRCodes;

    return {
      total,
      withQRCodes,
      withoutQRCodes,
    };
  }
}
