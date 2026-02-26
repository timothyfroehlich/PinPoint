"use client";

import type React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  addCommentAction,
  type AddCommentResult,
} from "~/app/(app)/issues/actions";
import { ImageUploadButton } from "~/components/images/ImageUploadButton";
import { ImageGallery } from "~/components/images/ImageGallery";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { type ImageMetadata } from "~/types/images";

interface AddCommentFormProps {
  issueId: string;
}

export function AddCommentForm({
  issueId,
}: AddCommentFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    AddCommentResult | undefined,
    FormData
  >(addCommentAction, undefined);
  const [uploadedImages, setUploadedImages] = useState<ImageMetadata[]>([]);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Comment added");
      formRef.current?.reset();
      setUploadedImages([]);
    }
  }, [state]);

  const handleUploadComplete = (imageData: ImageMetadata): void => {
    setUploadedImages((prev) => [...prev, imageData]);
  };

  return (
    <form action={formAction} ref={formRef} className="space-y-4">
      <input type="hidden" name="issueId" value={issueId} />
      <input
        type="hidden"
        name="imagesMetadata"
        value={JSON.stringify(uploadedImages)}
      />
      <Textarea
        name="comment"
        placeholder="Leave a comment..."
        aria-label="Comment"
        required
        disabled={isPending}
        className="border-outline-variant bg-surface text-on-surface"
      />

      {uploadedImages.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <ImageGallery
            images={uploadedImages.map((img, idx) => ({
              id: `pending-${idx}`,
              fullImageUrl: img.blobUrl,
              originalFilename: img.originalFilename,
            }))}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Button type="submit" size="sm" loading={isPending}>
          Add Comment
        </Button>

        <div className="min-w-0 sm:max-w-[200px]">
          <ImageUploadButton
            issueId={issueId}
            currentCount={uploadedImages.length}
            maxCount={BLOB_CONFIG.LIMITS.COMMENT_MAX}
            onUploadComplete={handleUploadComplete}
            disabled={isPending}
          />
        </div>
      </div>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
