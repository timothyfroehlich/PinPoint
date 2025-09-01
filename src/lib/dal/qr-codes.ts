/**
 * QR Codes Data Access Layer
 * QR code resolution and machine lookup operations
 */

import "server-only";

import { cache } from "react";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { ServiceFactory } from "~/server/services/factory";
import { constructReportUrl } from "~/server/utils/qrCodeUtils";
import type { 
  QRCodeResolution,
  QRCodeResolutionError, 
  QRCodeResolutionResult 
} from "~/lib/types";

/**
 * Resolve QR code to machine and construct report URL
 * Handles the full workflow from QR code ID to redirect URL
 */
export const resolveQRCodeToReportUrl = cache(async (
  qrCodeId: string
): Promise<QRCodeResolutionResult> => {
  if (!qrCodeId) {
    return {
      success: false,
      error: "invalid_id",
      message: "QR code ID is required"
    };
  }

  const dbProvider = getGlobalDatabaseProvider();
  const drizzle = dbProvider.getClient();
  
  try {
    // Initialize services
    const services = new ServiceFactory(drizzle);
    const qrCodeService = services.createQRCodeService();

    // Resolve machine information from QR code
    const machine = await qrCodeService.resolveMachineFromQR(qrCodeId);

    if (!machine) {
      return {
        success: false,
        error: "not_found",
        message: "Invalid QR code"
      };
    }

    // Construct the report issue URL
    const reportUrl = constructReportUrl(machine);

    return {
      success: true,
      reportUrl,
      machine: {
        id: machine.id,
        name: machine.name,
        organizationId: machine.organizationId,
        locationId: machine.locationId,
      }
    };
  } catch (error) {
    console.error("QR code resolution failed:", error);

    return {
      success: false,
      error: "server_error",
      message: "Failed to resolve QR code"
    };
  } finally {
    await dbProvider.disconnect();
  }
});

/**
 * Check if QR code exists (for HEAD requests)
 * Lightweight check without full resolution
 */
export const checkQRCodeExists = cache(async (
  qrCodeId: string
): Promise<boolean> => {
  if (!qrCodeId) {
    return false;
  }

  const dbProvider = getGlobalDatabaseProvider();
  const drizzle = dbProvider.getClient();
  
  try {
    const services = new ServiceFactory(drizzle);
    const qrCodeService = services.createQRCodeService();
    const machine = await qrCodeService.resolveMachineFromQR(qrCodeId);
    
    return machine !== null;
  } catch (error) {
    console.error("QR code existence check failed:", error);
    return false;
  } finally {
    await dbProvider.disconnect();
  }
});