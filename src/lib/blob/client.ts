import { put, del } from "@vercel/blob";
import type { PutBlobResult } from "@vercel/blob";

/**
 * Uploads a file to Vercel Blob storage.
 * @param file The file to upload
 * @param pathname The destination pathname in the blob storage
 */
export async function uploadToBlob(
  file: File,
  pathname: string
): Promise<PutBlobResult> {
  try {
    return await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });
  } catch (error) {
    console.error("Blob upload failed:", error);
    throw new Error("Failed to upload image to storage");
  }
}

/**
 * Deletes a file from Vercel Blob storage.
 * @param pathname The pathname of the file to delete
 */
export async function deleteFromBlob(pathname: string): Promise<void> {
  try {
    await del(pathname);
  } catch (error) {
    console.error("Blob deletion failed:", error);
    // Don't throw - deletion is idempotent and failures are non-blocking
  }
}
