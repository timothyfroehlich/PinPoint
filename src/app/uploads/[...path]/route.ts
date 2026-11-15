import fs from "fs/promises";
import path from "path";
import {
  getMockUploadsDir,
  shouldUseMockBlobStorage,
} from "~/lib/blob/mock-storage";
import { isProductionRuntime } from "~/lib/runtime-env";

/**
 * Serves mock blob uploads (`public/uploads/**`) when mock blob storage is in
 * use. `next dev` serves those files statically, but `next start` only serves
 * public/ files that existed when it started, so an image uploaded during an
 * E2E run against a production build falls through to this handler.
 *
 * Refused (404) on the production deployment and whenever uploads go to real
 * blob storage. Serves only regular files inside the uploads directory whose
 * bytes are a JPEG, PNG, or WebP image, with the type taken from those bytes.
 */

export const dynamic = "force-dynamic";

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/u;

type ImageType = "image/jpeg" | "image/png" | "image/webp";

function sniffImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (signature: number[], offset = 0): boolean =>
    signature.every((byte, i) => bytes[offset + i] === byte);

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // "RIFF" <size> "WEBP"
  if (
    startsWith([0x52, 0x49, 0x46, 0x46]) &&
    startsWith([0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

function notFound(): Response {
  return new Response("Not Found", { status: 404 });
}

async function resolveUpload(segments: string[]): Promise<string | null> {
  if (
    segments.length === 0 ||
    !segments.every(
      (segment) =>
        SAFE_SEGMENT.test(segment) && segment !== "." && segment !== ".."
    )
  ) {
    return null;
  }

  try {
    // realpath on both sides so a symlink cannot point outside the directory.
    const root = await fs.realpath(getMockUploadsDir());
    const filePath = await fs.realpath(path.join(root, ...segments));
    if (!filePath.startsWith(root + path.sep)) return null;
    const stat = await fs.stat(filePath);
    return stat.isFile() ? filePath : null;
  } catch {
    // Missing directory or file.
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  if (isProductionRuntime() || !shouldUseMockBlobStorage()) {
    return notFound();
  }

  const { path: segments } = await params;
  const filePath = await resolveUpload(segments);
  if (!filePath) return notFound();

  const bytes = new Uint8Array(await fs.readFile(filePath));
  const contentType = sniffImageType(bytes);
  if (!contentType) return notFound();

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
