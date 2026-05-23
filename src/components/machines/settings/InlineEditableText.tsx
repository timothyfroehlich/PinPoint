"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface InlineEditableTextProps {
  value: string;
  onValueChange: (newValue: string) => void;
  canEdit?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}

/**
 * Click-to-edit single-line text. Commits on blur or Enter, reverts on Esc.
 * Pencil affordance appears on hover when not editing.
 */
export function InlineEditableText({
  value,
  onValueChange,
  canEdit = true,
  placeholder = "Click to edit…",
  className,
  inputClassName,
  ariaLabel,
}: InlineEditableTextProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function startEdit(e: React.MouseEvent | React.KeyboardEvent): void {
    if (!canEdit) return;
    e.stopPropagation();
    setDraft(value);
    setIsEditing(true);
  }

  function commit(): void {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onValueChange(trimmed);
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
        className={cn("h-7", inputClassName)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
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

  return (
    <span
      className={cn(
        "group/iet relative inline-flex items-center gap-1.5",
        className
      )}
    >
      <span>
        {value || (
          <span className="italic text-muted-foreground">{placeholder}</span>
        )}
      </span>
      {canEdit && (
        <button
          type="button"
          aria-label={ariaLabel ? `Edit ${ariaLabel}` : "Edit"}
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/iet:opacity-100"
          onClick={startEdit}
        >
          <Pencil className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
