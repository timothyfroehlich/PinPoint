"use client";

import type React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
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
  /** Called once per posted comment, with the new comment's id. */
  onSubmitSuccess?: (commentId: string) => void;
  /**
   * Composer quick mode (design-bible §17), for the mobile comment sheet: the
   * editor opens focused as a compact jot with its toolbar hidden, an "Aa"
   * toggle reveals the toolbar (two-way, lossless), Cmd/Ctrl+Enter posts, and
   * the Post row sticks to the bottom of the sheet so it stays reachable above
   * the on-screen keyboard.
   */
  quick?: boolean;
}

export function AddCommentForm({
  issueId,
  onSubmitSuccess,
  quick = false,
}: AddCommentFormProps): React.JSX.Element {
  const [showFormatting, setShowFormatting] = useState(!quick);
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

  // The result this form has already acted on. The effect below also re-runs
  // when `onSubmitSuccess` or `quick` change identity, and must not toast,
  // reset, or mint a new idempotency key twice for one post.
  const handledStateRef = useRef<AddCommentResult | undefined>(undefined);

  useEffect(() => {
    if (state?.ok && handledStateRef.current !== state) {
      handledStateRef.current = state;
      toast.success("Comment added");
      formRef.current?.reset();
      setUploadedImages([]);
      setComment(null);
      editorRef.current?.clear();
      if (quick) setShowFormatting(false);
      // Fresh key — the next comment is a new logical submission.
      setIdempotencyKey(crypto.randomUUID());
      // Container handles focus / sheet-close / next-action.
      onSubmitSuccess?.(state.value.commentId);
    }
  }, [state, onSubmitSuccess, quick]);

  const handleUploadComplete = (imageData: ImageMetadata): void => {
    setUploadedImages((prev) => [...prev, imageData]);
  };

  // Cmd/Ctrl+Enter posts — expected by anyone who has used a chat composer.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>): void => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!isPending) formRef.current?.requestSubmit();
    }
  };

  const submitButton = (
    <Button
      type="submit"
      size="sm"
      loading={isPending}
      className={quick ? "min-h-11 px-4" : undefined}
    >
      Add Comment
    </Button>
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Cmd/Ctrl+Enter shortcut on the composer form, as in MachineTimelineComposer
    <form
      action={formAction}
      ref={formRef}
      className="space-y-4"
      onKeyDown={quick ? handleKeyDown : undefined}
    >
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
        showToolbar={showFormatting}
        compact={!showFormatting}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the quick composer opens in a sheet the author just asked for
        autoFocus={quick}
        className={quick ? undefined : "min-h-[100px]"}
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

      {quick ? (
        <>
          <ImageUploadButton
            issueId={issueId}
            currentCount={uploadedImages.length}
            maxCount={BLOB_CONFIG.LIMITS.COMMENT_MAX}
            onUploadComplete={handleUploadComplete}
            disabled={isPending}
            buttonClassName="max-md:min-h-11"
            successMessage="Photo uploaded"
          />
          {state && !state.ok && (
            <p role="alert" className="text-sm text-destructive-text">
              {state.message}
            </p>
          )}
          {/* Sticky so Post stays in view above the keyboard while the
              sheet's content scrolls. */}
          <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-outline-variant bg-background px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            <Toggle
              pressed={showFormatting}
              onPressedChange={setShowFormatting}
              disabled={isPending}
              aria-label="Formatting"
              className="min-h-11 min-w-11 text-muted-foreground data-[state=on]:text-foreground"
            >
              <span
                className="text-base font-semibold leading-none tracking-tight"
                aria-hidden="true"
              >
                Aa
              </span>
            </Toggle>
            <div className="ml-auto">{submitButton}</div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 @xl:flex-row @xl:items-center @xl:justify-between @xl:gap-4">
            <div className="min-w-0 @xl:max-w-[200px]">
              <ImageUploadButton
                issueId={issueId}
                currentCount={uploadedImages.length}
                maxCount={BLOB_CONFIG.LIMITS.COMMENT_MAX}
                onUploadComplete={handleUploadComplete}
                disabled={isPending}
                buttonClassName="max-md:min-h-11"
                successMessage="Photo uploaded"
              />
            </div>

            {submitButton}
          </div>
          {state && !state.ok && (
            <p role="alert" className="text-sm text-destructive-text">
              {state.message}
            </p>
          )}
        </>
      )}
    </form>
  );
}
