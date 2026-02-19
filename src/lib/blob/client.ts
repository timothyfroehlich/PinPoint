import { put, del } from "@vercel/blob";
import type { PutBlobResult } from "@vercel/blob";
import path from "path";
import fs from "fs/promises";
import { log } from "~/lib/logger";

function shouldUseMockBlobStorage(): boolean {
  if (process.env["MOCK_BLOB_STORAGE"] === "true") {
    return true;
  }

  // Local/dev fallback: if no blob token is configured, use mock storage.
  // Production should fail loudly when blob credentials are missing.
  return (
    process.env.NODE_ENV !== "production" &&
    !process.env["BLOB_READ_WRITE_TOKEN"]
  );
}

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
  if (shouldUseMockBlobStorage()) {
    // Determine local path in public/uploads and sanitize to prevent path traversal
    const publicDir = path.join(process.cwd(), "public", "uploads");
    // Remove any leading slashes or ../ segments to keep it within publicDir
    const safePathname = pathname
      .replace(/^(\.\.[/\\])+/, "")
      .replace(/^[/\\]/, "");
    const filePath = path.join(publicDir, safePathname);

    if (!filePath.startsWith(publicDir)) {
      throw new Error("Invalid pathname");
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Write file
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, globalThis.Buffer.from(arrayBuffer));

    // Return mock result with local URL
    const port = process.env["PORT"] ?? "3000";
    const baseUrl =
      process.env["NEXT_PUBLIC_SITE_URL"] ?? `http://localhost:${port}`;
    const url = `${baseUrl}/uploads/${pathname}`;

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
  } catch (err) {
    const errorDetails = {
      error: err instanceof Error ? err.message : String(err),
      pathname,
    };
    log.error(errorDetails, "Blob upload failed");
    throw new Error("Failed to upload image to storage", { cause: err });
  }
}

/**
 * Deletes a file from Vercel Blob storage.
 * @param pathname The pathname of the file to delete
 */
export async function deleteFromBlob(pathname: string): Promise<void> {
  // Mock implementation for local testing
  if (shouldUseMockBlobStorage()) {
    try {
      const publicDir = path.join(process.cwd(), "public", "uploads");
      // Extract pathname from full URLs (production stores URLs, not pathnames)
      let resolved = pathname;
      try {
        const url = new URL(pathname);
        resolved = url.pathname.replace(/^\/uploads\//, "");
      } catch {
        // Not a URL — use as-is
      }
      const safePathname = resolved
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
  } catch (err) {
    const errorDetails = {
      error: err instanceof Error ? err.message : String(err),
      pathname,
    };
    log.error(errorDetails, "Blob deletion failed");
    // Don't throw - deletion is idempotent and failures are non-blocking
  }
}
