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

  console.log("[Compression] Starting compression with useWebWorker: true", {
    mode,
    fileSize: file.size,
    options,
  });

  try {
    const startTime = Date.now();
    const compressed = await imageCompression(file, options);
    const duration = Date.now() - startTime;
    console.log("[Compression] Compression successful", {
      duration: `${duration}ms`,
      originalSize: file.size,
      compressedSize: compressed.size,
      reduction: `${(((file.size - compressed.size) / file.size) * 100).toFixed(1)}%`,
    });
    return compressed;
  } catch (error) {
    console.error(
      "[Compression] Compression failed, using original file:",
      error
    );
    return file; // Fallback to original
  }
}
