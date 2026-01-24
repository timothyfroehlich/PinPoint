import imageCompression from "browser-image-compression";
import { BLOB_CONFIG, type AllowedMimeType } from "./config";

/**
 * Validates an image file against configuration constraints.
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  if (!BLOB_CONFIG.ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed: ${BLOB_CONFIG.ALLOWED_MIME_TYPES.join(
        ", "
      )}`,
    };
  }

  if (file.size > BLOB_CONFIG.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(
        1
      )}MB. Max: ${BLOB_CONFIG.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    };
  }

  if (file.size < BLOB_CONFIG.MIN_FILE_SIZE_BYTES) {
    return { valid: false, error: "File too small" };
  }

  return { valid: true };
}

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

/**
 * Retrieves dimensions (width/height) of an image file.
 */
export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      reject(new Error("Failed to load image for dimensions"));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}
