import type { ImageMetadata } from "~/types/images";
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
 * Guard for image metadata read back from browser storage (the report and
 * comment drafts): only rows carrying every field `imagesMetadataArraySchema`
 * requires survive, so a malformed draft can't silently poison submission
 * (PP-2053.6). An `imageId`, when present, must be a string.
 */
export function isValidImageMetadata(img: unknown): img is ImageMetadata {
  if (typeof img !== "object" || img === null) return false;
  const m: Record<string, unknown> = { ...img };
  return (
    typeof m["blobUrl"] === "string" &&
    typeof m["blobPathname"] === "string" &&
    typeof m["originalFilename"] === "string" &&
    m["originalFilename"].length > 0 &&
    typeof m["fileSizeBytes"] === "number" &&
    m["fileSizeBytes"] > 0 &&
    typeof m["mimeType"] === "string" &&
    m["mimeType"].startsWith("image/") &&
    (m["imageId"] === undefined || typeof m["imageId"] === "string")
  );
}
