"use client";

import type React from "react";
import { cn } from "~/lib/utils";
import {
  docIsEmpty,
  docToPlainText,
  type ProseMirrorDoc,
} from "~/lib/tiptap/types";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import { EDITABLE_FIELD_CLASS } from "~/components/machines/settings/affordance";

interface InlineMarkdownFieldProps {
  value: ProseMirrorDoc | null;
  /**
   * Permission to edit (PP-43q3 always-live model). True → always render the
   * full RichTextEditor; every keystroke streams up via `onValueChange` so the
   * auto-save debounce in SettingsTab can persist it. False → RichTextDisplay
   * (or null when empty). There is no explicit Edit/Save/Cancel — auto-save
   * debounce is the only write boundary.
   *
   * Rich-text is DEBOUNCE-ONLY: RichTextEditor exposes no `onBlur`, so there
   * is no blur-flush path for this field. The debounce (800 ms) handles it.
   */
  canEdit: boolean;
  /**
   * Push the live editor doc into the working copy on every change (normalized:
   * a whitespace-only doc becomes null so an "invisible but saved" body never
   * persists). The auto-save timer in SettingsTab persists it.
   */
  onValueChange: (value: ProseMirrorDoc | null) => void;
  label?: string;
  placeholder?: string;
  /** Smaller (xs, muted) rendering for the card-header description. */
  compact?: boolean;
}

/** Normalize a draft for storage: a whitespace-only doc becomes null. */
function normalize(doc: ProseMirrorDoc | null): ProseMirrorDoc | null {
  return doc && docToPlainText(doc).trim() ? doc : null;
}

/**
 * The single markdown-editing primitive for the Settings tab. Unifies the
 * header description and the Rubbers / Post positions / Notes section bodies.
 *
 * Interaction model (PP-43q3 always-live auto-save):
 *  - `canEdit` true → the editor is ALWAYS open. No separate Save/Cancel.
 *    Every change streams up via `onValueChange` so the auto-save debounce
 *    can persist it. The editor carries a bordered black box so it reads as
 *    an editable field even when the toolbar is collapsed.
 *  - `canEdit` false → finished text via RichTextDisplay (or null when empty).
 *    No pencil, no hover tint, no click target.
 */
export function InlineMarkdownField({
  value,
  canEdit,
  onValueChange,
  label,
  placeholder = "Add text…",
  compact = false,
}: InlineMarkdownFieldProps): React.JSX.Element | null {
  const isEmpty = docIsEmpty(value);

  // Both modes render body text at the same size (14px) — "compact" only kills
  // prose's vertical rhythm so the field can sit flush with its container
  // (used by the card-header description).
  const textSize = "text-sm";

  if (canEdit) {
    return (
      <div className={compact ? undefined : "space-y-1.5"}>
        {label && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        )}
        {/* Bordered black box so the editor reads as an editable field.
            EDITABLE_FIELD_CLASS carries bg-black + border + focus ring.
            We apply it to the wrapper div, not the editor itself, since the
            editor's focus ring is managed by Tiptap internally. */}
        <div className={cn(EDITABLE_FIELD_CLASS, "rounded p-1")}>
          <RichTextEditor
            content={value}
            onChange={(doc) => {
              onValueChange(normalize(doc));
            }}
            // Settings descriptions/notes are documentation, not
            // conversation — @-mentions (which notify) make no sense here.
            mentionsEnabled={false}
            placeholder={placeholder}
            ariaLabel={label ?? "Edit text"}
            // Always the full editor (toolbar shown) — no mini/full toggle.
            showToolbar
            compact={false}
            className={textSize}
          />
        </div>
      </div>
    );
  }

  // Not permitted. An empty body renders nothing; a non-empty body renders
  // as finished text (RichTextDisplay).
  if (isEmpty) return null;

  return (
    <div className={compact ? undefined : "space-y-1.5"}>
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      )}
      <RichTextDisplay
        content={value}
        className={cn(
          textSize,
          compact &&
            "text-muted-foreground [&_*]:!my-0 [&_*]:!text-sm [&_*]:!leading-snug",
          !compact &&
            "max-md:leading-snug max-md:[&_p]:!my-1 max-md:[&_*]:!leading-snug"
        )}
      />
    </div>
  );
}
