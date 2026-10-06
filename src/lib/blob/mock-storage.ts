import path from "path";

/**
 * Local stand-in for Vercel Blob, used when no blob token is configured
 * (local development, CI, and E2E). Uploads are written under
 * `public/uploads` and served at `/uploads/<pathname>`.
 */

/** URL path prefix that mock uploads are served from. */
export const MOCK_UPLOADS_URL_PREFIX = "/uploads/";

/**
 * Whether uploads go to local disk instead of Vercel Blob.
 *
 * `MOCK_BLOB_STORAGE=true` forces it. Otherwise it is the fallback for a
 * development build with no `BLOB_READ_WRITE_TOKEN`; a production build with
 * no token fails loudly at upload time instead.
 */
export function shouldUseMockBlobStorage(): boolean {
  if (process.env["MOCK_BLOB_STORAGE"] === "true") {
    return true;
  }

  return (
    process.env.NODE_ENV !== "production" &&
    !process.env["BLOB_READ_WRITE_TOKEN"]
  );
}

/** Absolute directory that mock uploads are stored in. */
export function getMockUploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads");
}
