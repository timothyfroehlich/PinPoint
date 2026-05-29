"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface EditableCellProps {
  value: string;
  canEdit: boolean;
  onCommit: (newValue: string) => void;
  placeholder?: string;
  inputClassName?: string;
  textClassName?: string;
  ariaLabel?: string;
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
  autoFocusOnMount = false,
}: EditableCellProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(autoFocusOnMount);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus + select-all when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
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

  function commit(): void {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onCommit(trimmed);
    }
    setIsEditing(false);
  }

  function cancel(): void {
    setDraft(value);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        className={cn("h-7 px-1.5 py-0", inputClassName)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  // Read-only: a plain span, not a disabled <button> (a disabled interactive
  // element is needless noise in the AT tree for a value that can't change).
  if (!canEdit) {
    return (
      <span className={cn("px-1", textClassName)}>
        {value || (
          <span className="italic text-muted-foreground/60">{placeholder}</span>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "-mx-1 w-[calc(100%+0.5rem)] cursor-text rounded px-1 text-left hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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
