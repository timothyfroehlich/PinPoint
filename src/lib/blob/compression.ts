import imageCompression from "browser-image-compression";
import { BLOB_CONFIG } from "./config";

/**
 * Compresses an image file based on the specified mode.
 */
export async function compressImage(
  file: File,
  mode: "full" | "cropped" = "full"
): Promise<File> {
  const options = {
    maxSizeMB:
      mode === "full"
        ? BLOB_CONFIG.COMPRESSION.FULL_IMAGE_MAX_MB
        : BLOB_CONFIG.COMPRESSION.CROPPED_IMAGE_MAX_MB,
    maxWidthOrHeight: BLOB_CONFIG.MAX_DIMENSIONS,
    useWebWorker: true,
    initialQuality:
      mode === "full"
        ? BLOB_CONFIG.COMPRESSION.FULL_IMAGE_QUALITY
        : BLOB_CONFIG.COMPRESSION.CROPPED_IMAGE_QUALITY,
  };

  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error("Compression failed:", error);
    return file; // Fallback to original
  }
}
