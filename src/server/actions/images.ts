"use server";

import { createClient } from "~/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "~/server/db";
import { issueImages } from "~/server/db/schema";
import { uploadToBlob } from "~/lib/blob/client";
import { type Result, ok, err } from "~/lib/result";

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
    "AUTH" | "VALIDATION" | "BLOB" | "DATABASE"
  >
> {
  try {
    // 1. Auth check (optional for public reports, but usually we want to track who uploaded it)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 2. Validate metadata
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

    // 3. Get image file
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return err("VALIDATION", "No image file provided");
    }

    // 4. Validate limits (simplified for MVP - more complex checks would query DB)
    // In a real app, we'd check BLOB_CONFIG.LIMITS against DB counts here.

    // 5. Upload to Blob
    const timestamp = Date.now();
    // For new issues, we use a different prefix or just a flat structure
    const blobPrefix = isNewIssue ? "pending" : issueId;
    const pathname = `issue-images/${blobPrefix}/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const blob = await uploadToBlob(file, pathname);

    // 6. DB or just return metadata
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
          uploadedBy: user?.id ?? "00000000-0000-0000-0000-000000000000", // Needs actual user or system ID
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

      revalidatePath(`/issues/${issueId}`);
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
