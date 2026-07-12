"use client";

import type React from "react";
import { useEffect, useState, useTransition } from "react";

import { addMachineCommentAction } from "~/app/(app)/m/[initials]/(tabs)/timeline/actions";
import { RichTextEditor } from "~/components/editor/RichTextEditor";
import { TagSelect } from "~/components/machines/timeline/TagSelect";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
import { type TimelineTag } from "~/lib/timeline/machine-tags";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

interface Props {
  machineId: string;
  onPosted: () => void;
  /** Optional Cancel affordance (shown when composing inside a sheet). */
  onCancel?: (() => void) | undefined;
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
 *
 * `Cmd`/`Ctrl`+`Enter` submits. `beforeunload` guards tab-close / reload
 * while dirty (in-app Link clicks are not covered — Next App Router has no
 * route-change hook).
 */
export function MachineTimelineComposer({
  machineId,
  onPosted,
  onCancel,
  autoFocus = false,
}: Props): React.ReactElement {
  const [tag, setTag] = useState<TimelineTag>("note");
  const [doc, setDoc] = useState<ProseMirrorDoc>({ type: "doc", content: [] });
  const [fullMode, setFullMode] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Stable across retries: a 504-then-retry of the SAME post reuses this key so
  // the server dedups it (PP-e5th). Regenerated only after a successful post so
  // the next genuine note gets a distinct key. A failed post keeps the key, so
  // the user's retry is recognised as the same submission.
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID()
  );

  const hasBody = docHasText(doc);
  const isDirty = hasBody || tag !== "note" || fullMode;
  const canPost = hasBody && !pending;

  // Tab-close / reload guard. Will NOT fire for in-app Link clicks — that's
  // a Next App Router limitation, not a bug here.
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      // Legacy browsers require returnValue to be set.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [isDirty]);

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
          setDoc({ type: "doc", content: [] });
          setTag("note");
          setFullMode(false);
          // Fresh key — the next note is a new logical submission.
          setIdempotencyKey(crypto.randomUUID());
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
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handlePost();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- keyboard shortcut on form wrapper, PP-u4cp
    <div
      className="@container rounded-md border bg-card p-3"
      onKeyDown={handleKeyDown}
    >
      <RichTextEditor
        content={doc}
        onChange={setDoc}
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
          <TagSelect value={tag} onChange={setTag} disabled={pending} />
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          ) : null}
          <Button disabled={!canPost} onClick={handlePost}>
            {pending ? "Posting…" : "Post"}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
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
