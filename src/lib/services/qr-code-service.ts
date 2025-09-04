/**
 * QR Code Generation Service
 * Phase 3B: Actual QR code generation for machine reporting
 */

import QRCode from "qrcode";
import { env } from "~/env";

export interface QRCodeOptions {
  size?: number;
  margin?: number;
  color?: {
    dark: string;
    light: string;
  };
}

export interface GeneratedQRCode {
  id: string;
  url: string;
  dataUrl: string;
  machineId: string;
  generatedAt: Date;
}

/**
 * Generate QR code for machine reporting
 * Creates actual QR code image as base64 data URL
 */
export async function generateMachineQRCode(
  machineId: string,
  options: QRCodeOptions = {},
): Promise<GeneratedQRCode> {
  try {
    // Build the reporting URL that the QR code will link to
    const baseUrl = env.NEXT_PUBLIC_APP_URL;
    const reportingUrl = `${baseUrl}/report?machine=${machineId}`;

    // QR code generation options
    const qrOptions = {
      width: options.size ?? 256,
      margin: options.margin ?? 2,
      color: {
        dark: options.color?.dark ?? "#000000",
        light: options.color?.light ?? "#FFFFFF",
      },
      errorCorrectionLevel: "M" as const,
    };

    // Generate QR code as base64 data URL
    const dataUrl = await QRCode.toDataURL(reportingUrl, qrOptions);

    // Generate unique ID for this QR code
    const qrCodeId = crypto.randomUUID();

    // For now, we'll use the data URL as both the URL and dataUrl
    // In a production app, you might want to save the image to storage
    // and return a URL to the stored image

    return {
      id: qrCodeId,
      url: dataUrl, // In production, this might be a stored image URL
      dataUrl,
      machineId,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error("QR code generation error:", error);
    throw new Error("Failed to generate QR code");
  }
}

/**
 * Generate QR code as PNG buffer for downloads
 */
export async function generateMachineQRCodeBuffer(
  machineId: string,
  options: QRCodeOptions = {},
): Promise<Buffer> {
  try {
    const baseUrl = env.NEXT_PUBLIC_APP_URL;
    const reportingUrl = `${baseUrl}/report?machine=${machineId}`;

    const qrOptions = {
      width: options.size ?? 256,
      margin: options.margin ?? 2,
      color: {
        dark: options.color?.dark ?? "#000000",
        light: options.color?.light ?? "#FFFFFF",
      },
      errorCorrectionLevel: "M" as const,
    };

    // Generate QR code as PNG buffer
    const buffer = await QRCode.toBuffer(reportingUrl, qrOptions);
    return buffer;
  } catch (error) {
    console.error("QR code buffer generation error:", error);
    throw new Error("Failed to generate QR code buffer");
  }
}

/**
 * Validate QR code generation parameters
 */
export function validateQRCodeParams(machineId: string): boolean {
  if (!machineId || typeof machineId !== "string") {
    return false;
  }

  if (machineId.length < 1 || machineId.length > 100) {
    return false;
  }

  // Basic UUID format validation
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(machineId);
}

/**
 * Get default QR code options
 */
export function getDefaultQROptions(): QRCodeOptions {
  return {
    size: 256,
    margin: 2,
    color: {
      dark: "#1f2937", // Dark gray
      light: "#ffffff", // White
    },
  };
}
