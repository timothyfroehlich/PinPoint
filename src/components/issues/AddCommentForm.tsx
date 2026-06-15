"use client";

import type React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  addCommentAction,
  type AddCommentResult,
} from "~/app/(app)/issues/actions";
import { ImageUploadButton } from "~/components/images/ImageUploadButton";
import { ImageGallery } from "~/components/images/ImageGallery";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { type ImageMetadata } from "~/types/images";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "~/components/editor/RichTextEditorDynamic";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";

interface AddCommentFormProps {
  issueId: string;
  onSubmitSuccess?: () => void;
}

export function AddCommentForm({
  issueId,
  onSubmitSuccess,
}: AddCommentFormProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [state, formAction, isPending] = useActionState<
    AddCommentResult | undefined,
    FormData
  >(addCommentAction, undefined);
  const [uploadedImages, setUploadedImages] = useState<ImageMetadata[]>([]);
  const [comment, setComment] = useState<ProseMirrorDoc | null>(null);
  // Stable across retries so a 504-then-retry of the same comment is deduped
  // server-side (PP-e5th). `form.reset()` does not touch React state, so the
  // key is regenerated explicitly on success — a failed submit keeps it, so the
  // retry is recognised as the same submission.
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID()
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Comment added");
      formRef.current?.reset();
      setUploadedImages([]);
      setComment(null);
      editorRef.current?.clear();
      // Fresh key — the next comment is a new logical submission.
      setIdempotencyKey(crypto.randomUUID());
      // Container handles focus / sheet-close / next-action.
      onSubmitSuccess?.();
    }
  }, [state, onSubmitSuccess]);

  const handleUploadComplete = (imageData: ImageMetadata): void => {
    setUploadedImages((prev) => [...prev, imageData]);
  };

  return (
    <form action={formAction} ref={formRef} className="space-y-4">
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input
        type="hidden"
        name="imagesMetadata"
        value={JSON.stringify(uploadedImages)}
      />
      <RichTextEditor
        ref={editorRef}
        content={comment}
        onChange={setComment}
        mentionsEnabled={true}
        placeholder="Leave a comment..."
        ariaLabel="Comment"
        disabled={isPending}
        className="min-h-[100px]"
      />
      <input
        type="hidden"
        name="comment"
        value={comment ? JSON.stringify(comment) : ""}
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

      <div className="flex flex-col gap-3 @xl:flex-row @xl:items-center @xl:justify-between @xl:gap-4">
        <div className="min-w-0 @xl:max-w-[200px]">
          <ImageUploadButton
            issueId={issueId}
            currentCount={uploadedImages.length}
            maxCount={BLOB_CONFIG.LIMITS.COMMENT_MAX}
            onUploadComplete={handleUploadComplete}
            disabled={isPending}
          />
        </div>

        <Button type="submit" size="sm" loading={isPending}>
          Add Comment
        </Button>
      </div>
      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
