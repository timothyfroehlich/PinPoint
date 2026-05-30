"use client";

import type React from "react";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "~/lib/utils";
import { docToPlainText, type ProseMirrorDoc } from "~/lib/tiptap/types";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";

interface InlineMarkdownFieldProps {
  value: ProseMirrorDoc | null;
  canEdit: boolean;
  onValueChange: (value: ProseMirrorDoc | null) => void;
  label?: string;
  placeholder?: string;
  /** Smaller (xs, muted) rendering for the card-header description. */
  compact?: boolean;
}

/**
 * The single markdown-editing primitive for the Settings tab. Unifies the
 * header description and the Rubbers / Post positions / Notes sections.
 *
 * Interaction model (matches EditableCell's blur-save):
 *  - Click anywhere on the rendered text to open the editor (links inside
 *    still navigate — they're not absorbed by the click-to-open handler).
 *  - The editor commits when focus leaves the whole widget (blur-out): the
 *    toolbar mousedown-prevents focus loss, so formatting clicks don't
 *    commit; only moving focus to another field / the Done button / outside
 *    does. Esc also commits-and-closes.
 *  - No per-field Save / Cancel buttons.
 */
export function InlineMarkdownField({
  value,
  canEdit,
  onValueChange,
  label,
  placeholder = "Add text…",
  compact = false,
}: InlineMarkdownFieldProps): React.JSX.Element | null {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ProseMirrorDoc | null>(value);

  const firstNode = value?.content[0];
  const isEmpty =
    !value ||
    value.content.length === 0 ||
    (value.content.length === 1 &&
      firstNode?.type === "paragraph" &&
      !firstNode.content);

  // In view mode an empty field renders nothing (including its label).
  if (isEmpty && !canEdit) return null;

  function open(target: HTMLElement): void {
    // Let users click links in the rendered content without entering edit.
    if (target.closest("a")) return;
    setDraft(value);
    setIsEditing(true);
  }

  function commitAndClose(): void {
    const newValue = draft && docToPlainText(draft) ? draft : null;
    onValueChange(newValue);
    setIsEditing(false);
  }

  // Both modes render body text at the same size (14px) — "compact" only kills
  // prose's vertical rhythm so the field can sit flush with its container
  // (used by the card-header description).
  const textSize = "text-sm";

  return (
    <div className={compact ? undefined : "space-y-1.5"}>
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      )}

      {isEditing ? (
        <div
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) {
              return;
            }
            commitAndClose();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              commitAndClose();
            }
          }}
        >
          <RichTextEditor
            content={draft}
            onChange={setDraft}
            mentionsEnabled={true}
            placeholder={placeholder}
            ariaLabel={label ?? "Edit text"}
            compact
            className={textSize}
          />
        </div>
      ) : isEmpty ? (
        // Empty + editable: a real <button> (not a div[role=button]) so the
        // click fires reliably across browsers — Safari in particular drops
        // clicks on nested div[role=button], which made "add a description"
        // appear dead (CORE-A11Y-004). Full-width so the whole row is a target.
        <button
          type="button"
          aria-label={`Edit ${label ?? "text"}`}
          className={cn(
            "group/imf block w-full rounded text-left",
            textSize,
            "cursor-text transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none"
          )}
          onClick={(e) => {
            e.stopPropagation();
            open(e.currentTarget);
          }}
        >
          <span className="italic text-muted-foreground">{placeholder}</span>
        </button>
      ) : (
        // Non-empty: a plain wrapper holds the rendered markdown (which can
        // contain block elements + links, so it can't live inside a <button>).
        // A transparent overlay <button> captures the click-to-edit so the
        // open still fires reliably in Safari. Links sit above the overlay so
        // they remain clickable.
        <div className={cn("group/imf relative rounded", textSize)}>
          {canEdit && (
            <button
              type="button"
              aria-label={`Edit ${label ?? "text"}`}
              className="absolute inset-0 z-0 cursor-text rounded transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none"
              onClick={(e) => {
                e.stopPropagation();
                open(e.currentTarget);
              }}
            />
          )}
          <RichTextDisplay
            content={value}
            className={cn(
              "relative z-[1] [&_a]:pointer-events-auto",
              textSize,
              // Compact kills prose's vertical rhythm (margins + 1.7 leading)
              // so the description sits flush with its container while still
              // rendering at the same 14px as the surrounding body fields.
              compact &&
                "text-muted-foreground [&_*]:!my-0 [&_*]:!text-sm [&_*]:!leading-snug",
              canEdit && "pointer-events-none"
            )}
          />
          {canEdit && (
            <Pencil
              className="pointer-events-none absolute right-1 top-1 z-[2] size-3 text-muted-foreground opacity-0 transition-opacity group-hover/imf:opacity-100 motion-reduce:transition-none"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
}
