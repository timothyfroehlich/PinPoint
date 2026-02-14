"use server";

import { createClient } from "~/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { uploadToBlob, deleteFromBlob } from "~/lib/blob/client";
import { validateImageFile, getImageDimensions } from "~/lib/blob/validation";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { type Result, ok, err } from "~/lib/result";
import {
  checkImageUploadLimit,
  getClientIp,
  formatResetTime,
} from "~/lib/rate-limit";
import { log } from "~/lib/logger";

/** Only allow deletion of blobs within the user's own avatar folder. */
function validateAvatarPrefix(pathname: string, userId: string): string | null {
  return pathname.startsWith(`avatars/${userId}/`) ? pathname : null;
}

/**
 * Parse avatar URLs and return a managed blob pathname if it belongs to us.
 * Returns null for OAuth/external URLs or if the pathname doesn't belong
 * to the specified user's avatar folder.
 */
function getManagedAvatarPathname(url: string, userId: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.startsWith("/")
      ? parsedUrl.pathname.slice(1)
      : parsedUrl.pathname;

    if (!pathname) {
      return null;
    }

    // Production Vercel Blob URL
    if (parsedUrl.hostname.endsWith("blob.vercel-storage.com")) {
      return validateAvatarPrefix(pathname, userId);
    }

    // Local mock storage URL: http://localhost:<port>/uploads/<pathname>
    const configuredHost = process.env["NEXT_PUBLIC_SITE_URL"]
      ? new URL(process.env["NEXT_PUBLIC_SITE_URL"]).hostname
      : null;
    const isLocalHost =
      parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
    const isConfiguredHost =
      configuredHost !== null && parsedUrl.hostname === configuredHost;

    if ((isLocalHost || isConfiguredHost) && pathname.startsWith("uploads/")) {
      const localPathname = pathname.slice("uploads/".length);
      return localPathname.length > 0
        ? validateAvatarPrefix(localPathname, userId)
        : null;
    }

    return null;
  } catch {
    // Malformed URL or invalid configured host
    return null;
  }
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

    // 3b. Validate image dimensions server-side (defense against bypassed client compression)
    if (typeof file.arrayBuffer === "function") {
      const imageBytes = new Uint8Array(await file.arrayBuffer());
      const dimensions = getImageDimensions(imageBytes);
      if (dimensions === null) {
        return err(
          "VALIDATION",
          "Could not read image dimensions. The file may be malformed."
        );
      }
      if (
        dimensions.width > BLOB_CONFIG.AVATAR.MAX_DIMENSIONS ||
        dimensions.height > BLOB_CONFIG.AVATAR.MAX_DIMENSIONS
      ) {
        return err(
          "VALIDATION",
          `Image dimensions ${dimensions.width}x${dimensions.height} exceed maximum ${BLOB_CONFIG.AVATAR.MAX_DIMENSIONS}x${BLOB_CONFIG.AVATAR.MAX_DIMENSIONS}px.`
        );
      }
    }

    // 4. Upload to Blob
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const pathname = `avatars/${user.id}/${timestamp}-${safeFilename}`;
    const blob = await uploadToBlob(file, pathname);
    uploadedBlobPathname = blob.pathname;

    // 5-6. Read current avatar and update profile
    let oldAvatarUrl: string | null = null;
    try {
      const currentProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { avatarUrl: true },
      });
      oldAvatarUrl = currentProfile?.avatarUrl ?? null;

      const updated = await db
        .update(userProfiles)
        .set({
          avatarUrl: blob.url,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.id, user.id))
        .returning({ id: userProfiles.id });

      if (updated.length === 0) {
        log.error(
          { userId: user.id, blobPathname: uploadedBlobPathname },
          "Avatar update matched 0 rows — profile missing, cleaning up blob"
        );
        if (uploadedBlobPathname) {
          await deleteFromBlob(uploadedBlobPathname);
        }
        return err("DATABASE", "User profile not found.");
      }
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
    const oldAvatarPathname =
      oldAvatarUrl !== null
        ? getManagedAvatarPathname(oldAvatarUrl, user.id)
        : null;
    if (oldAvatarPathname) {
      await deleteFromBlob(oldAvatarPathname);
    }

    // 8. Revalidate layout so avatar updates everywhere
    revalidatePath("/", "layout");

    return ok({ url: blob.url });
  } catch (caughtErr) {
    // Safety net: if anything failed after upload, clean up the new blob.
    if (uploadedBlobPathname) {
      await deleteFromBlob(uploadedBlobPathname);
    }

    log.error(
      {
        error:
          caughtErr instanceof Error ? caughtErr.message : String(caughtErr),
      },
      "Avatar upload action failed"
    );
    return err("BLOB", "Avatar upload failed.");
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

  try {
    // 2. Get current avatar URL
    const currentProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { avatarUrl: true },
    });
    const oldAvatarUrl = currentProfile?.avatarUrl ?? null;

    // 3. Set avatarUrl to null
    await db
      .update(userProfiles)
      .set({
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.id, user.id));

    // 4. Delete blob if it's ours
    const oldAvatarPathname =
      oldAvatarUrl !== null
        ? getManagedAvatarPathname(oldAvatarUrl, user.id)
        : null;
    if (oldAvatarPathname) {
      await deleteFromBlob(oldAvatarPathname);
    }

    // 5. Revalidate layout
    revalidatePath("/", "layout");

    return ok({ success: true });
  } catch (dbErr) {
    log.error(
      {
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      },
      "Failed to remove avatar from database"
    );
    return err("DATABASE", "Failed to remove avatar.");
  }
}
