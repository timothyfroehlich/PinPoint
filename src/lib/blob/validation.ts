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
