"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { uploadToBlob, deleteFromBlob } from "~/lib/blob/client";
import { validateImageFile } from "~/lib/blob/validation";
import { type Result, ok, err } from "~/lib/result";
import {
  serverActionError,
  reportError,
} from "~/lib/observability/report-error";

export type UploadAvatarResult = Result<
  { avatarUrl: string },
  "AUTH" | "VALIDATION" | "BLOB" | "DATABASE"
>;

export async function uploadAvatarAction(
  formData: FormData
): Promise<UploadAvatarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("AUTH", "Unauthorized");

  const file = formData.get("avatar");
  if (!(file instanceof File)) return err("VALIDATION", "No file provided");

  const validation = validateImageFile(file);
  if (!validation.valid)
    return err("VALIDATION", validation.error ?? "Invalid image");

  const existing = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { avatarUrl: true },
  });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pathname = `user-avatars/${user.id}/${Date.now()}-${safeName}`;

  let blobUrl: string;
  try {
    const blob = await uploadToBlob(file, pathname);
    blobUrl = blob.url;
  } catch (error) {
    return serverActionError(error, "BLOB", "Failed to upload avatar", {
      action: "uploadAvatarAction",
      userId: user.id,
    });
  }

  try {
    await db
      .update(userProfiles)
      .set({ avatarUrl: blobUrl, updatedAt: new Date() })
      .where(eq(userProfiles.id, user.id));
  } catch (error) {
    return serverActionError(error, "DATABASE", "Failed to save avatar", {
      action: "uploadAvatarAction",
      userId: user.id,
    });
  }

  if (existing?.avatarUrl && existing.avatarUrl !== blobUrl) {
    try {
      await deleteFromBlob(existing.avatarUrl);
    } catch (error) {
      reportError(error, {
        action: "uploadAvatarAction.cleanup",
        bestEffort: true,
        userId: user.id,
      });
    }
  }

  revalidatePath(`/u/${user.id}`);
  revalidatePath("/", "layout");
  return ok({ avatarUrl: blobUrl });
}
