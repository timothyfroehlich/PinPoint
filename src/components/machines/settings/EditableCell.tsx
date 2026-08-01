"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  EDITABLE_FIELD_CLASS,
  EDITABLE_TEXT_CLASS,
} from "~/components/machines/settings/affordance";

interface EditableCellProps {
  value: string;
  canEdit: boolean;
  /**
   * Push the trimmed value into the WORKING COPY (PP-43q3 always-live auto-save
   * model). Fires on every change so the working copy stays current; auto-save
   * debounce handles the actual persistence.
   */
  onCommit: (newValue: string) => void;
  /**
   * Fired on blur (and Enter) so the parent can flush the auto-save debounce
   * immediately (plain-text blur path — Task 6 Step 9).
   */
  onCommitBlur?: (() => void) | undefined;
  placeholder?: string;
  inputClassName?: string;
  textClassName?: string;
  ariaLabel?: string;
  /**
   * Code-like cell (setting IDs, DIP switch numbers) rather than prose. Turns
   * off autocorrect / autocapitalize / spellcheck so "DS-1" isn't "helpfully"
   * rewritten to "Ds-1" or red-underlined. Prose cells (setting names/values)
   * keep the defaults. Never use type="number" here — these are codes, not
   * quantities.
   */
  codeLike?: boolean;
  /**
   * When true, focus this input on mount. Used by "+ Add row" handlers to drop
   * the user straight into the first cell of a newly created row.
   */
  autoFocusOnMount?: boolean;
}

/**
 * Always-live table cell input for the auto-save Machine Settings editor
 * (PP-43q3 pivot). Permitted users get an always-open <Input> with the
 * editable-field affordance (black fill + border + glow). Read-only viewers
 * get a plain span. There is no click-to-edit mode, no display button, no
 * Save/Cancel — auto-save debounce in SettingsTab handles persistence.
 *
 * Pairs with shadcn <TableCell> as its parent.
 */
export function EditableCell({
  value,
  canEdit,
  onCommit,
  onCommitBlur,
  placeholder = "—",
  inputClassName,
  textClassName,
  ariaLabel,
  codeLike = false,
  autoFocusOnMount = false,
}: EditableCellProps): React.JSX.Element {
  // Local draft buffers raw typed characters (pre-trim) while the working copy
  // holds the trimmed committed value.  Kept in sync with `value` when not
  // focused so that an external working-copy update (structural-op restore) is
  // reflected in the displayed text.
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocused = useRef(false);
  // Set to true when Enter or Esc triggers a programmatic blur, so the onBlur
  // handler doesn't double-fire onCommitBlur.
  const committedByKeyRef = useRef(false);

  // Sync draft with the working copy whenever the input isn't held by the user.
  useEffect(() => {
    if (!isFocused.current) setDraft(value);
  }, [value]);

  // Focus the input on mount when requested (freshly-added row, first cell).
  useEffect(() => {
    if (autoFocusOnMount && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocusOnMount]);

  // Read-only: a plain span, not a disabled <button>.
  if (!canEdit) {
    return (
      <span className={textClassName}>
        {value || <span className="text-muted-foreground/60">—</span>}
      </span>
    );
  }

  // Permitted user: always-live input with the editable-field affordance.
  return (
    <Input
      ref={inputRef}
      value={draft}
      className={cn(
        // `scroll-my-2` reserves a gap so the focus `scrollIntoView` below lands
        // the cell clear of the on-screen keyboard's top edge (PP-a0pl).
        "h-7 scroll-my-2 px-1.5 py-0 max-md:text-[13px]",
        EDITABLE_FIELD_CLASS,
        EDITABLE_TEXT_CLASS,
        inputClassName
      )}
      placeholder={placeholder}
      aria-label={ariaLabel}
      // Commit-on-Enter single cell → the mobile Enter key reads "done".
      enterKeyHint="done"
      // Code-like cells (IDs, switch numbers) opt out of the autocorrect /
      // autocapitalize / spellcheck machinery so "DS-1" survives intact.
      {...(codeLike
        ? {
            autoCorrect: "off",
            autoCapitalize: "off",
            spellCheck: false,
          }
        : {})}
      onFocus={(e) => {
        isFocused.current = true;
        // Pull the focused cell above the on-screen keyboard once it resizes the
        // content area. Belt-and-suspenders beyond the root `interactive-widget=
        // resizes-content` viewport (PP-a0pl), which iOS Safari ignores.
        // `block: "nearest"` is a no-op when the cell is already visible, so
        // desktop tab-through between inline cells never jumps.
        e.currentTarget.scrollIntoView({ block: "nearest" });
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const trimmed = raw.trim();
        if (trimmed !== value) onCommit(trimmed);
      }}
      onBlur={(e) => {
        isFocused.current = false;
        const trimmed = e.target.value.trim();
        setDraft(trimmed); // normalize display on blur
        if (trimmed !== value) onCommit(trimmed);
        // Skip onCommitBlur if the blur was triggered programmatically by
        // Enter/Esc — those already called it directly.
        if (!committedByKeyRef.current) onCommitBlur?.();
        committedByKeyRef.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const trimmed = (e.target as HTMLInputElement).value.trim();
          setDraft(trimmed);
          if (trimmed !== value) onCommit(trimmed);
          committedByKeyRef.current = true;
          onCommitBlur?.();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          // Revert the draft display AND restore the working copy to the
          // current external value (undoes any onChange push made during this
          // edit session).
          setDraft(value);
          if (draft.trim() !== value) onCommit(value);
          committedByKeyRef.current = true;
          isFocused.current = false;
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
