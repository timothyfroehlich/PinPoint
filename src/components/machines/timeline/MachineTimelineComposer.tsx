"use client";

import type React from "react";
import { useId, useRef, useState, useTransition } from "react";

import { addMachineCommentAction } from "~/app/(app)/m/[initials]/(tabs)/timeline/actions";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "~/components/editor/RichTextEditor";
import {
  machineNoteDraftKey,
  useCommentDraft,
  useDraftEditorSync,
} from "~/components/issues/comment-draft";
import { TagSelect } from "~/components/machines/timeline/TagSelect";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
import { tagSchema, type TimelineTag } from "~/lib/timeline/machine-tags";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

const EMPTY_DOC: ProseMirrorDoc = { type: "doc", content: [] };

interface Props {
  machineId: string;
  /** The signed-in author; drafts are kept per person and per machine. */
  userId: string;
  onPosted: () => void;
  /** Autofocus the editor on mount (sheet entry point). */
  autoFocus?: boolean | undefined;
}

/**
 * Compose form for new timeline entries — three-tier capture (design-bible §17).
 *
 * - **Tier 1 (quick note):** the default. Tag defaults to `note`, the
 *   formatting toolbar is hidden, and Post is enabled the moment there is
 *   body text — the author is never forced to classify. Reads as a quick
 *   jot, not a document.
 * - **Tier 2 (full note):** the "Aa" format toggle reveals the rich-text
 *   toolbar. Two-way — the content is the same Tiptap document in either
 *   mode, so flipping back is lossless.
 * - **Tier 3 (issue):** out of scope here — photos / structured fields live
 *   on issues.
 * `Cmd`/`Ctrl`+`Enter` submits. The text and tag are kept as a draft
 * (`comment-draft.ts`) until the note posts, so closing the sheet or reloading
 * the page loses nothing.
 */
export function MachineTimelineComposer({
  machineId,
  userId,
  onPosted,
  autoFocus = false,
}: Props): React.ReactElement {
  const [fullMode, setFullMode] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const composerId = useId();
  const draft = useCommentDraft(
    machineNoteDraftKey(userId, machineId),
    composerId
  );
  const { onDocChange, clear } = useDraftEditorSync({
    draft,
    composerId,
    editorRef,
    containerRef,
  });
  // The idempotency key lives in the draft: stable across retries (and
  // reloads) so a 504-then-retry of the same note is deduped server-side
  // (PP-e5th), and replaced only when a post succeeds or the note changes.
  const { idempotencyKey } = draft.snapshot.draft;
  const doc = draft.snapshot.draft.doc ?? EMPTY_DOC;
  // Notes default to `note`; a stored tag that is no longer valid falls back.
  const storedTag = tagSchema.safeParse(draft.snapshot.draft.tag);
  const tag: TimelineTag = storedTag.success ? storedTag.data : "note";

  const hasBody = docHasText(doc);
  const canPost = hasBody && !pending;

  const handlePost = (): void => {
    if (!hasBody || pending) return;
    setError(null);
    const chosenTag = tag;
    startTransition(async () => {
      try {
        const result = await addMachineCommentAction({
          machineId,
          tag: chosenTag,
          contentJson: JSON.stringify(doc),
          idempotencyKey,
        });
        if (result.success) {
          clear();
          setFullMode(false);
          onPosted();
        } else {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  // Cmd/Ctrl+Enter to submit — expected by anyone who has used a chat or
  // code-review composer.
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.target instanceof Node && !e.currentTarget.contains(e.target)) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handlePost();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- keyboard shortcut on composer wrapper div, PP-u4cp
    <div
      ref={containerRef}
      className="@container rounded-md border bg-card p-3"
      onKeyDown={handleKeyDown}
    >
      <RichTextEditor
        ref={editorRef}
        content={doc}
        onChange={onDocChange}
        placeholder="Add a quick note… (⌘/Ctrl + Enter to post)"
        showToolbar={fullMode}
        compact={!fullMode}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate focus-on-open in sheet, PP-u4cp
        autoFocus={autoFocus}
      />
      <div className="mt-3 flex items-center gap-2">
        <Toggle
          size="sm"
          pressed={fullMode}
          onPressedChange={setFullMode}
          disabled={pending}
          aria-label={fullMode ? "Hide formatting" : "Show formatting"}
          title={fullMode ? "Hide formatting" : "Show formatting"}
          className="gap-1.5 text-muted-foreground data-[state=on]:text-foreground"
        >
          <span className="text-base font-semibold leading-none tracking-tight">
            Aa
          </span>
          {/* Bare "Aa" in a narrow composer (iOS-style); the word appears
              once the composer card is wide enough (e.g. the centered desktop
              sheet) so it reads more explicitly. Container query, not viewport
              — the label tracks the composer's own width (CORE-RESP-003). */}
          <span className="hidden text-xs font-medium @lg:inline">
            Formatting
          </span>
        </Toggle>
        <div className="ml-auto flex items-center gap-2">
          <TagSelect value={tag} onChange={draft.setTag} disabled={pending} />
          <Button disabled={!canPost} onClick={handlePost}>
            {pending ? "Posting…" : "Post"}
          </Button>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive-text">{error}</p>
      ) : null}
    </div>
  );
}

/** ProseMirror "has any non-whitespace text" check — gates the Post button. */
function docHasText(doc: ProseMirrorDoc): boolean {
  for (const node of doc.content) {
    if (nodeHasText(node)) return true;
  }
  return false;
}

function nodeHasText(node: { text?: string; content?: unknown[] }): boolean {
  if (typeof node.text === "string" && node.text.trim().length > 0) {
    return true;
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child === "object" && child !== null && nodeHasText(child)) {
        return true;
      }
    }
  }
  return false;
}
