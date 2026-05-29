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
  /** Field can't be left empty: starts open when empty, shows invalid
   *  styling while blank, and marks the placeholder with a required hint. */
  required?: boolean;
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
  required = false,
  placeholder = "Click to edit…",
  className,
  inputClassName,
  ariaLabel,
}: InlineEditableTextProps): React.JSX.Element {
  // A required field that mounts empty (e.g. a freshly created set) opens
  // straight into the input so the user lands on it without an extra click.
  const [isEditing, setIsEditing] = useState(
    canEdit && required && value.trim() === ""
  );
  const [draft, setDraft] = useState(value);
  // Required-field errors stay silent until the user actually tries to leave
  // the field empty — a freshly-opened blank field shows no red flair.
  const [showRequiredError, setShowRequiredError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEmptyRequired = required && draft.trim() === "";
  const showInvalid = isEmptyRequired && showRequiredError;

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
    if (required && trimmed === "") {
      // Tried to leave a required field blank: reveal the error and keep the
      // field open instead of silently closing it empty.
      setShowRequiredError(true);
      return;
    }
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
        aria-label={
          showInvalid && ariaLabel ? `${ariaLabel} (required)` : ariaLabel
        }
        aria-invalid={showInvalid || undefined}
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

  // View mode without permission: plain text, not interactive.
  if (!canEdit) {
    return (
      <span className={className}>
        {value || (
          <span className="italic text-muted-foreground">{placeholder}</span>
        )}
      </span>
    );
  }

  // Editable: the whole field is the click target (click-anywhere),
  // with a pencil that appears on hover as a hint.
  return (
    <button
      type="button"
      aria-label={ariaLabel ? `Edit ${ariaLabel}` : "Edit"}
      className={cn(
        "group/iet -mx-1 inline-flex items-center gap-1.5 rounded px-1 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none",
        className
      )}
      onClick={startEdit}
    >
      <span>
        {value || (
          <span
            className={cn(
              "italic",
              showInvalid ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {placeholder}
            {showInvalid && " *"}
          </span>
        )}
      </span>
      <Pencil
        className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/iet:opacity-100 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </button>
  );
}
