import { BLOB_CONFIG } from "~/lib/blob/config";

function isBodySizeLimitError(message: string): boolean {
  return /body exceeded .*limit/i.test(message);
}

export function getUploadErrorMessage(error: unknown): string {
  if (error instanceof Error && isBodySizeLimitError(error.message)) {
    const maxSizeMb = BLOB_CONFIG.MAX_FILE_SIZE_BYTES / (1024 * 1024);
    return `Image exceeds the upload size limit. Please use an image under ${maxSizeMb}MB.`;
  }

  return "An unexpected error occurred during upload";
}
