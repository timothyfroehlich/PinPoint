"use server";

import { createClient } from "~/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "~/server/db";
import { issueImages } from "~/server/db/schema";
import { uploadToBlob, deleteFromBlob } from "~/lib/blob/client";
import { validateImageFile } from "~/lib/blob/compression";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { type Result, ok, err } from "~/lib/result";
import {
  checkImageUploadLimit,
  getClientIp,
  formatResetTime,
} from "~/lib/rate-limit";
import { eq, count, and, isNull } from "drizzle-orm";

const uploadSchema = z.object({
  issueId: z.string(), // Can be real UUID or 'new'
  commentId: z.string().uuid().optional(),
});

export async function uploadIssueImage(formData: FormData): Promise<
  Result<
    {
      imageId?: string;
      blobUrl: string;
      blobPathname: string;
      originalFilename: string;
      fileSizeBytes: number;
      mimeType: string;
    },
    "AUTH" | "VALIDATION" | "BLOB" | "DATABASE" | "RATE_LIMIT"
  >
> {
  let uploadedBlobPathname: string | undefined;

  try {
    // 1. Rate Limit Check
    const ip = await getClientIp();
    const { success, reset } = await checkImageUploadLimit(ip);
    if (!success) {
      return err(
        "RATE_LIMIT",
        `Too many uploads. Please try again in ${formatResetTime(reset)}.`
      );
    }

    // 2. Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 3. Validate metadata
    const rawData = {
      issueId: formData.get("issueId"),
      commentId: (formData.get("commentId") as string | null) ?? undefined,
    };

    const validated = uploadSchema.safeParse(rawData);
    if (!validated.success) {
      return err("VALIDATION", "Invalid metadata");
    }

    const { issueId, commentId } = validated.data;
    const isNewIssue = issueId === "new";

    // 4. Get and Validate image file (Server-side)
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return err("VALIDATION", "No image file provided");
    }

    const validation = validateImageFile(file);
    if (!validation.valid) {
      return err("VALIDATION", validation.error ?? "Invalid image file");
    }

    // 5. Enforce Limits
    // Check per-user limit for authenticated users.
    // Anonymous users are limited solely via IP-based rate limiting.
    if (user) {
      const userImagesCount = await db
        .select({ val: count() })
        .from(issueImages)
        .where(
          and(
            eq(issueImages.uploadedBy, user.id),
            isNull(issueImages.deletedAt)
          )
        );

      if (
        (userImagesCount[0]?.val ?? 0) >=
        BLOB_CONFIG.LIMITS.AUTHENTICATED_USER_MAX
      ) {
        return err("VALIDATION", "You have reached your upload limit.");
      }
    }

    // Check per-issue limit
    if (!isNewIssue) {
      const issueImagesCount = await db
        .select({ val: count() })
        .from(issueImages)
        .where(
          and(eq(issueImages.issueId, issueId), isNull(issueImages.deletedAt))
        );

      if (
        (issueImagesCount[0]?.val ?? 0) >= BLOB_CONFIG.LIMITS.ISSUE_TOTAL_MAX
      ) {
        return err("VALIDATION", "This issue has reached its image limit.");
      }
    }

    // 6. Upload to Blob
    const timestamp = Date.now();
    const blobPrefix = isNewIssue ? "pending" : issueId;
    const pathname = `issue-images/${blobPrefix}/${timestamp}-${file.name.replace(
      /[^a-zA-Z0-9.]/g,
      "_"
    )}`;
    const blob = await uploadToBlob(file, pathname);
    uploadedBlobPathname = blob.pathname;

    // 7. DB or just return metadata
    if (isNewIssue) {
      return ok({
        blobUrl: blob.url,
        blobPathname: blob.pathname,
        originalFilename: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type,
      });
    }

    try {
      const [imageRecord] = await db
        .insert(issueImages)
        .values({
          issueId,
          commentId,
          uploadedBy: user?.id ?? null,
          fullImageUrl: blob.url,
          fullBlobPathname: blob.pathname,
          fileSizeBytes: file.size,
          mimeType: file.type,
          originalFilename: file.name,
        })
        .returning();

      if (!imageRecord) {
        throw new Error("Failed to insert image record");
      }

      // Revalidate broader paths to ensure all relevant pages update
      revalidatePath("/m");
      revalidatePath("/report");

      return ok({
        imageId: imageRecord.id,
        blobUrl: blob.url,
        blobPathname: blob.pathname,
        originalFilename: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type,
      });
    } catch (dbError) {
      console.error("DB insert failed for image, cleaning up blob:", dbError);
      // Step 4: Actual cleanup
      if (uploadedBlobPathname) {
        await deleteFromBlob(uploadedBlobPathname);
      }
      return err("DATABASE", "Failed to record image in database");
    }
  } catch (error) {
    console.error("Upload action failed:", error);
    return err(
      "BLOB",
      error instanceof Error ? error.message : "Upload failed"
    );
  }
}
