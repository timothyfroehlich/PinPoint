import { list, del } from "@vercel/blob";
import { db } from "~/server/db";
import { userProfiles, issueImages } from "~/server/db/schema";
import { sql } from "drizzle-orm";
import { log } from "~/lib/logger";

/** Blobs older than this threshold are eligible for cleanup. */
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CleanupResult {
  /** Total blobs found in storage */
  totalBlobs: number;
  /** Number of blobs that were referenced by the database */
  referencedBlobs: number;
  /** Number of orphaned blobs deleted */
  deletedBlobs: number;
  /** Number of orphaned blobs skipped (within grace period) */
  skippedGracePeriod: number;
  /** URLs of blobs that failed to delete */
  errors: string[];
}

/**
 * Collects all blob URLs currently referenced in the database.
 *
 * Sources:
 * - `user_profiles.avatar_url` (avatar uploads)
 * - `issue_images.full_image_url` (issue image originals)
 * - `issue_images.cropped_image_url` (issue image crops)
 */
export async function getReferencedBlobUrls(): Promise<Set<string>> {
  const urls = new Set<string>();

  // Avatar URLs from user profiles
  const avatars = await db
    .select({ url: userProfiles.avatarUrl })
    .from(userProfiles)
    .where(sql`${userProfiles.avatarUrl} IS NOT NULL`);

  for (const row of avatars) {
    if (row.url) urls.add(row.url);
  }

  // Full and cropped image URLs from issue images (including soft-deleted)
  const images = await db
    .select({
      fullUrl: issueImages.fullImageUrl,
      croppedUrl: issueImages.croppedImageUrl,
    })
    .from(issueImages);

  for (const row of images) {
    urls.add(row.fullUrl);
    if (row.croppedUrl) urls.add(row.croppedUrl);
  }

  return urls;
}

/**
 * Lists all blobs in Vercel Blob storage, paginating through results.
 */
async function listAllBlobs(): Promise<{ url: string; uploadedAt: Date }[]> {
  const allBlobs: { url: string; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await list({
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });

    for (const blob of result.blobs) {
      allBlobs.push({ url: blob.url, uploadedAt: blob.uploadedAt });
    }

    hasMore = result.hasMore;
    cursor = result.cursor;
  }

  return allBlobs;
}

/**
 * Cleans up orphaned blobs from Vercel Blob storage.
 *
 * A blob is considered orphaned if its URL is not referenced by any
 * database record AND it was uploaded more than 24 hours ago.
 */
export async function cleanupOrphanedBlobs(): Promise<CleanupResult> {
  const result: CleanupResult = {
    totalBlobs: 0,
    referencedBlobs: 0,
    deletedBlobs: 0,
    skippedGracePeriod: 0,
    errors: [],
  };

  // Step 1: Get all referenced URLs from the database
  const referencedUrls = await getReferencedBlobUrls();

  // Step 2: List all blobs in storage
  const allBlobs = await listAllBlobs();
  result.totalBlobs = allBlobs.length;

  // Step 3: Identify orphaned blobs
  const now = Date.now();
  const orphanedUrls: string[] = [];

  for (const blob of allBlobs) {
    if (referencedUrls.has(blob.url)) {
      result.referencedBlobs++;
      continue;
    }

    // Check grace period
    const age = now - blob.uploadedAt.getTime();
    if (age < GRACE_PERIOD_MS) {
      result.skippedGracePeriod++;
      continue;
    }

    orphanedUrls.push(blob.url);
  }

  // Step 4: Delete orphaned blobs in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < orphanedUrls.length; i += BATCH_SIZE) {
    const batch = orphanedUrls.slice(i, i + BATCH_SIZE);
    try {
      await del(batch);
      result.deletedBlobs += batch.length;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log.error(
        { error: errorMessage, batchStart: i, batchSize: batch.length },
        "Failed to delete blob batch"
      );
      result.errors.push(...batch);
    }
  }

  log.info(
    {
      totalBlobs: result.totalBlobs,
      referencedBlobs: result.referencedBlobs,
      deletedBlobs: result.deletedBlobs,
      skippedGracePeriod: result.skippedGracePeriod,
      errorCount: result.errors.length,
    },
    "Blob cleanup completed"
  );

  return result;
}
