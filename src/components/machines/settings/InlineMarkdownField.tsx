"use client";

import type React from "react";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  docIsEmpty,
  docToPlainText,
  type ProseMirrorDoc,
} from "~/lib/tiptap/types";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import {
  EDITABLE_FIELD_CLASS,
  EDITABLE_TEXT_CLASS,
} from "~/components/machines/settings/affordance";

interface InlineMarkdownFieldProps {
  value: ProseMirrorDoc | null;
  /**
   * Permission to edit (PP-43q3 always-live model). True → render the editor
   * (always-open, unless `clickToEdit`); every keystroke streams up via
   * `onValueChange` so the auto-save debounce in SettingsTab can persist it.
   * False → RichTextDisplay (or null when empty). No explicit Edit/Save/Cancel.
   */
  canEdit: boolean;
  /**
   * Push the live editor doc into the working copy on every change (normalized:
   * a whitespace-only doc becomes null so an "invisible but saved" body never
   * persists). The auto-save timer in SettingsTab persists it.
   */
  onValueChange: (value: ProseMirrorDoc | null) => void;
  /**
   * Called when the editor loses focus, so the parent can flush this set's
   * auto-save debounce immediately (the blur-flush path). Optional.
   */
  onBlur?: (() => void) | undefined;
  label?: string;
  placeholder?: string;
  /** Smaller (xs, muted) rendering for the card-header description. */
  compact?: boolean;
  /**
   * Opt-in click-to-edit: at rest show the finished text with a pencil button
   * (or a clickable one-line placeholder when empty), opening the editor only
   * on demand. Keeps at-rest cards compact — used by the card-header
   * description. Section bodies leave this off and stay always-live. (PP-tn6t)
   */
  clickToEdit?: boolean;
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
 *  - `canEdit` true → the editor is open. Every change streams up via
 *    `onValueChange` so the auto-save debounce can persist it; no Save/Cancel.
 *    With `clickToEdit`, the editor opens on click and closes on blur, showing
 *    finished text / a placeholder at rest.
 *  - `canEdit` false → finished text via RichTextDisplay (or null when empty).
 */
export function InlineMarkdownField({
  value,
  canEdit,
  onValueChange,
  onBlur,
  label,
  placeholder = "Add text…",
  compact = false,
  clickToEdit = false,
}: InlineMarkdownFieldProps): React.JSX.Element | null {
  const isEmpty = docIsEmpty(value);
  const [isEditing, setIsEditing] = useState(false);

  // Both modes render body text at the same size (14px) — "compact" only kills
  // prose's vertical rhythm so the field can sit flush with its container.
  const textSize = "text-sm";
  const displayClassName = cn(
    textSize,
    compact &&
      "text-muted-foreground [&_*]:!my-0 [&_*]:!text-sm [&_*]:!leading-snug",
    !compact &&
      "max-md:leading-snug max-md:[&_p]:!my-1 max-md:[&_*]:!leading-snug"
  );
  const wrapperClassName = compact ? undefined : "space-y-1.5";
  const labelEl = label ? (
    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
  ) : null;

  if (canEdit) {
    // Click-to-edit, at rest.
    if (clickToEdit && !isEditing) {
      const editLabel = `Edit ${label ?? "description"}`;

      // Empty: the placeholder itself is the button. Its only child is a
      // <span>, so there is no interactive-nesting problem, and the whole
      // one-liner stays an easy target.
      if (isEmpty) {
        return (
          <div className={wrapperClassName}>
            {labelEl}
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
              }}
              aria-label={editLabel}
              className={cn(
                "block w-full rounded text-left",
                EDITABLE_TEXT_CLASS
              )}
            >
              <span className={cn(textSize, "italic text-muted-foreground")}>
                {placeholder}
              </span>
            </button>
          </div>
        );
      }

      // Non-empty: render the rich text as real markup beside a pencil, NOT
      // inside a <button>. RichTextDisplay emits block content and `autolink`
      // turns any typed URL into an <a> — an anchor inside a button is invalid
      // interactive nesting, makes the link unfollowable, and flattens
      // headings/lists into the button's accessible name. (PP-tn6t review.)
      return (
        <div className={wrapperClassName}>
          {labelEl}
          <div className="flex items-start gap-1">
            <RichTextDisplay
              content={value}
              className={cn(displayClassName, "min-w-0 flex-1")}
            />
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
              }}
              aria-label={editLabel}
              className={cn(
                "shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none",
                EDITABLE_FIELD_CLASS
              )}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={wrapperClassName}>
        {labelEl}
        {/* Bordered black box so the editor reads as an editable field. */}
        <div className={cn(EDITABLE_FIELD_CLASS, "rounded p-1")}>
          <RichTextEditor
            content={value}
            onChange={(doc) => {
              onValueChange(normalize(doc));
            }}
            onBlur={() => {
              if (clickToEdit) setIsEditing(false);
              onBlur?.();
            }}
            // Settings descriptions/notes are documentation, not
            // conversation — @-mentions (which notify) make no sense here.
            mentionsEnabled={false}
            placeholder={placeholder}
            ariaLabel={label ?? "Edit text"}
            // Focus straight into the editor when opened via click-to-edit —
            // the user just clicked to edit, so focus follows their action.
            // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate focus-on-open for click-to-edit, PP-tn6t
            autoFocus={clickToEdit}
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
    <div className={wrapperClassName}>
      {labelEl}
      <RichTextDisplay content={value} className={displayClassName} />
    </div>
  );
}
