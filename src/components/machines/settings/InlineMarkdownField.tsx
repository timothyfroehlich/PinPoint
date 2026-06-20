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

interface InlineMarkdownFieldProps {
  value: ProseMirrorDoc | null;
  /**
   * Per-unit edit gate (PP-43q3 explicit edit model). The rich body has no
   * click-to-open of its own anymore: the owning unit's Edit/Done drives this.
   *  - true  → the editor is ALWAYS open (no separate Save/Cancel — the unit's
   *            Done commits the draft, the unit's Cancel discards it). Each
   *            keystroke flows up via `onValueChange` so the unit can persist the
   *            current value on Done without reaching into this component.
   *  - false → finished text via RichTextDisplay (or nothing when empty). No
   *            pencil, no hover tint, no click target.
   */
  editing: boolean;
  /**
   * Push the live editor doc into the working copy on every change (normalized:
   * a whitespace-only doc becomes null so an "invisible but saved" body never
   * persists). The unit reads this working copy when its Save enqueues the
   * whole-row write; SettingsTab snapshots the committed baseline so its Cancel
   * can restore the slice and the navigation guard can detect dirtiness.
   */
  onValueChange: (value: ProseMirrorDoc | null) => void;
  label?: string;
  placeholder?: string;
  /** Smaller (xs, muted) rendering for the card-header description. */
  compact?: boolean;
}

/** Normalize a draft for storage: a whitespace-only doc becomes null (matches
 *  the timeline comment actions, which reject docToPlainText(...).trim()
 *  empties) so clearing the body persists NULL, not an invisible blob. */
function normalize(doc: ProseMirrorDoc | null): ProseMirrorDoc | null {
  return doc && docToPlainText(doc).trim() ? doc : null;
}

/**
 * The single markdown-editing primitive for the Settings tab. Unifies the
 * header description and the Rubbers / Post positions / Notes section bodies.
 *
 * Interaction model (PP-43q3 explicit per-unit edit — rich-on-Done commit):
 *  - There is NO click-to-open and NO per-field Save/Cancel. The owning unit's
 *    Edit/Save button drives `editing`. While editing, the editor is open and
 *    every change streams up via `onValueChange`, keeping the working copy live
 *    so the unit's Save can persist the current value. The unit's Cancel
 *    restores the slice from the committed baseline (this component holds no
 *    draft of its own to roll back).
 *  - At rest the body is just finished text (RichTextDisplay) — no border, no
 *    fill, no pencil. An empty body at rest renders nothing; the unit's visible
 *    Edit button is the only affordance.
 *  - The editor always opens in full mode (formatting toolbar shown). There is
 *    no mini/full toggle — entering edit gives you the whole editor.
 */
export function InlineMarkdownField({
  value,
  editing,
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

  if (editing) {
    return (
      <div className={compact ? undefined : "space-y-1.5"}>
        {label && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        )}
        <RichTextEditor
          content={value}
          onChange={(doc) => {
            // Stream the live doc into the working copy (normalized) so the
            // unit's Done persists the current value and Cancel can restore.
            onValueChange(normalize(doc));
          }}
          // Settings descriptions/notes are documentation, not conversation —
          // @-mentions (which notify) make no sense here (PP-43q3).
          mentionsEnabled={false}
          placeholder={placeholder}
          ariaLabel={label ?? "Edit text"}
          // Always the full editor (toolbar shown) — no mini/full toggle. The
          // unit's Save/Cancel own the commit; this editor has no controls of
          // its own.
          showToolbar
          compact={false}
          className={textSize}
        />
      </div>
    );
  }

  // Not editing. An empty body renders nothing at all (the unit's Edit button is
  // the affordance for adding one); a non-empty body renders as finished text.
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
          // Compact kills prose's vertical rhythm (margins + 1.7 leading) so the
          // description sits flush with its container while still rendering at
          // the same 14px as the surrounding body fields.
          compact &&
            "text-muted-foreground [&_*]:!my-0 [&_*]:!text-sm [&_*]:!leading-snug",
          // Non-compact (note/section bodies): tighten leading and shrink
          // paragraph margins on mobile only for the density redesign; desktop
          // keeps prose's default rhythm.
          !compact &&
            "max-md:leading-snug max-md:[&_p]:!my-1 max-md:[&_*]:!leading-snug"
        )}
      />
    </div>
  );
}
