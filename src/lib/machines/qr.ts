import QRCode from "qrcode";

/**
 * Generates a PNG data URL for the given target URL.
 */
export async function generateQrPngDataUrl(targetUrl: string): Promise<string> {
  return await QRCode.toDataURL(targetUrl, {
    errorCorrectionLevel: "M",
    type: "image/png",
    margin: 1,
    scale: 6,
  });
}
