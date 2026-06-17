"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface EditableCellProps {
  value: string;
  canEdit: boolean;
  /**
   * Commit the cell's edit into the WORKING COPY (PP-43q3 atomic per-unit
   * commit). It does NOT persist — the owning section unit's Save is the sole
   * write boundary, so every cell edit buffers until then.
   */
  onCommit: (newValue: string) => void;
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
   * When true, mount directly in edit mode with the input focused. Used by
   * "+ Add row" handlers to drop the user straight into the first cell of a
   * newly created row.
   */
  autoFocusOnMount?: boolean;
}

/**
 * Click-to-edit table cell with blur-save semantics.
 *  - Click the value or Tab to it → press Enter to enter edit mode
 *  - Type, then blur OR Enter to commit (calls onCommit only on change)
 *  - Esc reverts to the previous value
 *
 * "Commit" here means "buffer into the working copy" — there is no persistence;
 * the section unit's Save writes the whole row atomically (PP-43q3).
 *
 * Pairs with shadcn <TableCell> as its parent. The cell renders a borderless
 * <button> in display mode and a normal Input in edit mode.
 */
export function EditableCell({
  value,
  canEdit,
  onCommit,
  placeholder = "—",
  inputClassName,
  textClassName,
  ariaLabel,
  codeLike = false,
  autoFocusOnMount = false,
}: EditableCellProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(autoFocusOnMount);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // A keyboard commit/cancel collapses the input back to the display button;
  // the unmounting <input> would otherwise drop focus to <body>, stranding
  // keyboard users mid-table. Flag the close so the effect restores focus to
  // the trigger and Tab order is preserved. Blur closes leave this false so we
  // don't yank focus back from wherever the user clicked/tabbed next.
  const restoreFocusOnClose = useRef(false);

  // Focus + select-all when entering edit mode; restore focus to the trigger
  // when a keyboard close collapses the input.
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    } else if (!isEditing && restoreFocusOnClose.current) {
      restoreFocusOnClose.current = false;
      triggerRef.current?.focus();
    }
  }, [isEditing]);

  // Sync draft with external value changes when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [value, isEditing]);

  function startEdit(): void {
    if (!canEdit) return;
    setDraft(value);
    setIsEditing(true);
  }

  function commit(fromKeyboard = false): void {
    const trimmed = draft.trim();
    // Buffer the change into the working copy only — the unit's Save persists.
    if (trimmed !== value) {
      onCommit(trimmed);
    }
    restoreFocusOnClose.current = fromKeyboard;
    setIsEditing(false);
  }

  function cancel(fromKeyboard = false): void {
    setDraft(value);
    restoreFocusOnClose.current = fromKeyboard;
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        className={cn("h-7 px-1.5 py-0 max-md:text-[13px]", inputClassName)}
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
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={() => {
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel(true);
          }
        }}
      />
    );
  }

  // Read-only: a plain span, not a disabled <button> (a disabled interactive
  // element is needless noise in the AT tree for a value that can't change).
  // No padding: the editable trigger re-pads with p-2 after a -m-2, so its text
  // sits at the cell's content edge — exactly where this span sits.
  // Empty values render an em-dash, not the editing placeholder — "S-…" is an
  // input hint and reads as noise to viewers who can't edit.
  if (!canEdit) {
    return (
      <span className={textClassName}>
        {value || <span className="text-muted-foreground/60">—</span>}
      </span>
    );
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      // Fill the whole cell, not just the text: a -m-2 cancels the TableCell's
      // p-2 and a calc width spans both side paddings, with p-2 re-added inside so
      // the text stays at the content edge. The entire cell (and its hover/focus
      // highlight) is now the click target. Desktop only — mobile rows edit in
      // the sheet and never render this button (rowEditable = canEdit && !mobile).
      className={cn(
        "-m-2 block min-w-0 w-[calc(100%+1rem)] cursor-text rounded p-2 text-left hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        textClassName
      )}
      onClick={startEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startEdit();
        }
      }}
      aria-label={ariaLabel}
    >
      {value || (
        <span className="italic text-muted-foreground/60">{placeholder}</span>
      )}
    </button>
  );
}
