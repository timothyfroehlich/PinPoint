import { put, del } from "@vercel/blob";
import type { PutBlobResult } from "@vercel/blob";
import path from "path";
import fs from "fs/promises";

/**
 * Uploads a file to Vercel Blob storage.
 * @param file The file to upload
 * @param pathname The destination pathname in the blob storage
 */
export async function uploadToBlob(
  file: File,
  pathname: string
): Promise<PutBlobResult> {
  // Mock implementation for local testing without Vercel credentials
  if (process.env["MOCK_BLOB_STORAGE"] === "true") {
    console.log("[BlobClient] Using mock blob storage");
    // Determine local path in public/uploads and sanitize to prevent path traversal
    const publicDir = path.join(process.cwd(), "public", "uploads");
    // Remove any leading slashes or ../ segments to keep it within publicDir
    const safePathname = pathname
      .replace(/^(\.\.[/\\])+/, "")
      .replace(/^[/\\]/, "");
    const filePath = path.join(publicDir, safePathname);

    console.log("[BlobClient] Mock storage paths", {
      publicDir,
      safePathname,
      filePath,
    });

    if (!filePath.startsWith(publicDir)) {
      throw new Error("Invalid pathname");
    }

    // Ensure directory exists
    console.log("[BlobClient] Creating directory:", path.dirname(filePath));
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Write file
    console.log("[BlobClient] Writing file to disk");
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, globalThis.Buffer.from(arrayBuffer));
    console.log("[BlobClient] File written successfully");

    // Return mock result with local URL
    const port = process.env["PORT"] ?? "3000";
    const baseUrl =
      process.env["NEXT_PUBLIC_SITE_URL"] ?? `http://localhost:${port}`;
    const url = `${baseUrl}/uploads/${pathname}`;

    console.log("[BlobClient] Mock upload complete", { url });

    return {
      url,
      downloadUrl: url,
      pathname,
      contentType: file.type,
      contentDisposition: `inline; filename="${file.name}"`,
    };
  }

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
  // Mock implementation for local testing
  if (process.env["MOCK_BLOB_STORAGE"] === "true") {
    try {
      const publicDir = path.join(process.cwd(), "public", "uploads");
      const safePathname = pathname
        .replace(/^(\.\.[/\\])+/, "")
        .replace(/^[/\\]/, "");
      const filePath = path.join(publicDir, safePathname);

      if (!filePath.startsWith(publicDir)) {
        return; // Ignore invalid paths
      }
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist, similar to blob behavior
    }
    return;
  }

  try {
    await del(pathname);
  } catch (error) {
    console.error("Blob deletion failed:", error);
    // Don't throw - deletion is idempotent and failures are non-blocking
  }
}
