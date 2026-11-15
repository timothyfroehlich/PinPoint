import { put, del } from "@vercel/blob";
import type { PutBlobResult } from "@vercel/blob";
import path from "path";
import fs from "fs/promises";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import { errorMessage } from "~/lib/errors";
import { assertNotInTransaction } from "~/server/db/transaction-context";
import {
  getMockUploadsDir,
  MOCK_UPLOADS_URL_PREFIX,
  shouldUseMockBlobStorage,
} from "~/lib/blob/mock-storage";

/**
 * Uploads a file to Vercel Blob storage.
 * @param file The file to upload
 * @param pathname The destination pathname in the blob storage
 */
export async function uploadToBlob(
  file: File,
  pathname: string
): Promise<PutBlobResult> {
  // CORE-ARCH-011 tripwire: blob I/O runs post-commit, never inside a
  // transaction (the Doodle Bug, PP-2053).
  assertNotInTransaction("uploadToBlob");

  // Mock implementation for local testing without Vercel credentials
  if (shouldUseMockBlobStorage()) {
    // Determine local path in public/uploads and sanitize to prevent path traversal
    const publicDir = getMockUploadsDir();
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
    // `next start` only serves public/ files that existed when it started, so
    // a fresh upload falls through to the mock-upload route
    // (src/app/uploads/[...path]/route.ts), which reads the same directory.
    const url = `${baseUrl}${MOCK_UPLOADS_URL_PREFIX}${pathname}`;

    return {
      url,
      downloadUrl: url,
      pathname,
      contentType: file.type,
      contentDisposition: `inline; filename="${file.name}"`,
      etag: "mock-etag",
    };
  }

  try {
    return await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });
  } catch (err) {
    const errorDetails = {
      err: errorMessage(err),
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
  // CORE-ARCH-011 tripwire: blob I/O runs post-commit, never inside a
  // transaction (the Doodle Bug, PP-2053).
  assertNotInTransaction("deleteFromBlob");

  // Mock implementation for local testing
  if (shouldUseMockBlobStorage()) {
    try {
      const publicDir = getMockUploadsDir();
      // Extract pathname from full URLs (production stores URLs, not pathnames)
      let resolved = pathname;
      try {
        const url = new URL(pathname);
        resolved = url.pathname.replace(/^\/uploads\//, "");
      } catch (error) {
        // Not a URL — use as-is (only catch TypeError from URL parsing)
        if (!(error instanceof TypeError)) throw error;
      }
      const safePathname = resolved
        .replace(/^(\.\.[/\\])+/, "")
        .replace(/^[/\\]/, "");
      const filePath = path.join(publicDir, safePathname);

      if (!filePath.startsWith(publicDir)) {
        return; // Ignore invalid paths
      }
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore only if file doesn't exist (ENOENT), similar to blob behavior.
      // Re-throw everything else (including non-Error throws and Errors
      // without a `code` property) so unrelated bugs aren't swallowed.
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error;
    }
    return;
  }

  try {
    await del(pathname);
  } catch (err) {
    const errorDetails = {
      err: errorMessage(err),
      pathname,
    };
    log.error(errorDetails, "Blob deletion failed");
    reportError(err, {
      action: "blob.delete",
      bestEffort: true,
      pathname,
    });
    // Don't throw - deletion is idempotent and failures are non-blocking
  }
}
