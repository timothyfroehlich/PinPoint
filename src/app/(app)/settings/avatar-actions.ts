"use server";

import { createClient } from "~/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { uploadToBlob, deleteFromBlob } from "~/lib/blob/client";
import { validateImageFile } from "~/lib/blob/validation";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { type Result, ok, err } from "~/lib/result";
import {
  checkImageUploadLimit,
  getClientIp,
  formatResetTime,
} from "~/lib/rate-limit";
import { log } from "~/lib/logger";

/**
 * Check if a URL is a Vercel Blob or local upload URL (i.e., one we manage).
 * OAuth avatar URLs (Google, GitHub) should not be deleted.
 */
function isOurBlobUrl(url: string): boolean {
  return url.includes("blob.vercel-storage.com") || url.includes("/uploads/");
}

export type UploadAvatarResult = Result<
  { url: string },
  "AUTH" | "VALIDATION" | "BLOB" | "DATABASE" | "RATE_LIMIT"
>;

/**
 * Upload a new avatar image for the current user.
 *
 * 1. Auth check
 * 2. Rate limit check
 * 3. Validate file (type, size)
 * 4. Upload to Vercel Blob at avatars/{userId}/{timestamp}-{filename}
 * 5. Update userProfiles.avatarUrl
 * 6. Delete old avatar blob if it's ours
 * 7. Revalidate layout
 */
export async function uploadAvatarAction(
  formData: FormData
): Promise<UploadAvatarResult> {
  let uploadedBlobPathname: string | undefined;

  try {
    // 1. Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return err("AUTH", "You must be logged in to upload an avatar.");
    }

    // 2. Rate limit check
    const ip = await getClientIp();
    const { success, reset } = await checkImageUploadLimit(ip);
    if (!success) {
      return err(
        "RATE_LIMIT",
        `Too many uploads. Please try again in ${formatResetTime(reset)}.`
      );
    }

    // 3. Validate file
    const file = formData.get("avatar");
    if (!(file instanceof File)) {
      return err("VALIDATION", "No image file provided.");
    }

    // Check against avatar-specific size limit
    if (file.size > BLOB_CONFIG.AVATAR.MAX_FILE_SIZE_BYTES) {
      return err(
        "VALIDATION",
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${BLOB_CONFIG.AVATAR.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`
      );
    }

    const validation = validateImageFile(file);
    if (!validation.valid) {
      return err("VALIDATION", validation.error ?? "Invalid image file.");
    }

    // 4. Upload to Blob
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const pathname = `avatars/${user.id}/${timestamp}-${safeFilename}`;
    const blob = await uploadToBlob(file, pathname);
    uploadedBlobPathname = blob.pathname;

    // 5. Get the old avatar URL before updating
    const currentProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { avatarUrl: true },
    });
    const oldAvatarUrl = currentProfile?.avatarUrl;

    // 6. Update profile with new avatar URL
    try {
      await db
        .update(userProfiles)
        .set({
          avatarUrl: blob.url,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.id, user.id));
    } catch (dbErr) {
      log.error(
        {
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          blobPathname: uploadedBlobPathname,
        },
        "DB update failed for avatar, cleaning up blob"
      );
      if (uploadedBlobPathname) {
        await deleteFromBlob(uploadedBlobPathname);
      }
      return err("DATABASE", "Failed to update avatar in database.");
    }

    // 7. Delete old avatar blob if it's ours (not an OAuth URL)
    if (oldAvatarUrl && isOurBlobUrl(oldAvatarUrl)) {
      try {
        const url = new URL(oldAvatarUrl);
        const pathname = url.pathname.startsWith("/")
          ? url.pathname.slice(1)
          : url.pathname;
        if (pathname) {
          await deleteFromBlob(pathname);
        }
      } catch {
        // If the URL is malformed, skip blob deletion
      }
    }

    // 8. Revalidate layout so avatar updates everywhere
    revalidatePath("/", "layout");

    return ok({ url: blob.url });
  } catch (caughtErr) {
    log.error(
      {
        error:
          caughtErr instanceof Error ? caughtErr.message : String(caughtErr),
      },
      "Avatar upload action failed"
    );
    return err(
      "BLOB",
      caughtErr instanceof Error ? caughtErr.message : "Upload failed."
    );
  }
}

export type DeleteAvatarResult = Result<
  { success: boolean },
  "AUTH" | "DATABASE"
>;

/**
 * Delete the current user's avatar.
 *
 * 1. Auth check
 * 2. Get current avatarUrl
 * 3. Set avatarUrl to null
 * 4. Delete blob if it's ours
 * 5. Revalidate layout
 */
export async function deleteAvatarAction(): Promise<DeleteAvatarResult> {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("AUTH", "You must be logged in to delete your avatar.");
  }

  // 2. Get current avatar URL
  const currentProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { avatarUrl: true },
  });

  const oldAvatarUrl = currentProfile?.avatarUrl;

  // 3. Set avatarUrl to null
  try {
    await db
      .update(userProfiles)
      .set({
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.id, user.id));
  } catch (dbErr) {
    log.error(
      {
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      },
      "Failed to remove avatar from database"
    );
    return err("DATABASE", "Failed to remove avatar.");
  }

  // 4. Delete blob if it's ours
  if (oldAvatarUrl && isOurBlobUrl(oldAvatarUrl)) {
    try {
      const url = new URL(oldAvatarUrl);
      const pathname = url.pathname.startsWith("/")
        ? url.pathname.slice(1)
        : url.pathname;
      if (pathname) {
        await deleteFromBlob(pathname);
      }
    } catch {
      // If the URL is malformed, skip blob deletion
    }
  }

  // 5. Revalidate layout
  revalidatePath("/", "layout");

  return ok({ success: true });
}
