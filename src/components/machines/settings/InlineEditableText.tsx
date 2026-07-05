"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  EDITABLE_FIELD_CLASS,
  EDITABLE_TEXT_CLASS,
} from "~/components/machines/settings/affordance";

interface InlineEditableTextProps {
  value: string;
  onValueChange: (newValue: string) => void;
  /**
   * Permission to edit (PP-43q3 always-live model). True → always render an
   * <input> with the editable-field affordance; the field is live at all times
   * for permitted users with no explicit Edit/Save mode.
   * False → finished, non-interactive text with NO hover affordance.
   */
  canEdit?: boolean;
  /** Field can't be left empty: shows invalid styling while blank and marks the
   *  placeholder with a required hint when a commit is attempted empty. */
  required?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
  /** autocomplete token for the input (e.g. "off" for the always-on set name). */
  autoComplete?: string;
  /**
   * Called on blur so the parent can flush the auto-save debounce immediately
   * (plain-text blur path — Task 6 Step 9).
   */
  onBlurCommit?: (() => void) | undefined;
}

/**
 * Single-line settings field in the always-live auto-save model (PP-43q3
 * pivot). Two flat states with no hover mode between them:
 *  - NOT permitted (`canEdit` false): finished, non-interactive text — just
 *    the value (or an italic placeholder). No pencil, no hover tint, no click
 *    target. Indistinguishable from static copy.
 *  - Permitted (`canEdit` true): an always-open <input> with the black-fill /
 *    border / glow affordance. Each keystroke pushes the working copy via
 *    `onValueChange`; blur / Enter flushes the auto-save debounce via
 *    `onBlurCommit`. Esc reverts the draft to the current working-copy value.
 *    Required-field validation stays: `:user-invalid` / `aria-invalid` on
 *    blur; the unit's empty-name guard remains in SettingsTab.
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
  autoComplete,
  onBlurCommit,
}: InlineEditableTextProps): React.JSX.Element {
  const [draft, setDraft] = useState(value);
  // Required-field errors stay silent until the user actually tries to leave
  // the field empty — a freshly-opened blank field shows no red flair.
  const [showRequiredError, setShowRequiredError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocused = useRef(false);

  const isEmptyRequired = required && draft.trim() === "";
  const showInvalid = isEmptyRequired && showRequiredError;
  // Mark required fields up front (design-bible §683 asterisk convention):
  // a trailing " *" in the placeholder plus aria-required.
  const editPlaceholder = required ? `${placeholder} *` : placeholder;

  // Keep the draft in sync with the working copy whenever the field is NOT
  // focused (e.g. a duplicate/preferred mutation or a Cancel-restore rewrote
  // the working copy). While focused, the input owns the draft.
  useEffect(() => {
    if (!isFocused.current) setDraft(value);
  }, [value]);

  function commit(): void {
    const trimmed = draft.trim();
    if (required && trimmed === "") {
      // Tried to leave a required field blank: reveal the error. The input
      // stays open (permitted users are always editing), so they can fix it.
      setShowRequiredError(true);
      return;
    }
    setShowRequiredError(false);
    if (trimmed !== value) onValueChange(trimmed);
  }

  // View mode (no permission): finished text. No pencil, no hover tint.
  if (!canEdit) {
    return (
      <span className={className}>
        {value || (
          <span className="italic text-muted-foreground">{placeholder}</span>
        )}
      </span>
    );
  }

  // Permitted: the always-open input with the editable-field affordance.
  return (
    <Input
      ref={inputRef}
      value={draft}
      className={cn(
        "h-7",
        EDITABLE_FIELD_CLASS,
        EDITABLE_TEXT_CLASS,
        inputClassName
      )}
      placeholder={editPlaceholder}
      aria-label={
        showInvalid && ariaLabel ? `${ariaLabel} (required)` : ariaLabel
      }
      aria-required={required || undefined}
      aria-invalid={showInvalid || undefined}
      // Commit-on-Enter single field: tell mobile keyboards the Enter key
      // finishes the field. Titles/names are prose, so spellcheck and
      // sentence-case stay at their (on) defaults.
      enterKeyHint="done"
      autoComplete={autoComplete}
      onFocus={() => {
        isFocused.current = true;
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const trimmed = raw.trim();
        // Push into the working copy immediately so the auto-save timer sees
        // the latest text. For required fields, skip propagating blank (the
        // required guard on blur/Enter is the canonical empty block).
        if (!(required && trimmed === "") && trimmed !== value) {
          onValueChange(trimmed);
        }
      }}
      onBlur={() => {
        isFocused.current = false;
        commit();
        onBlurCommit?.();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          onBlurCommit?.();
        } else if (e.key === "Escape") {
          e.preventDefault();
          // Revert the draft display AND restore the working copy to the
          // current external value (undoes any partial edit that was pushed
          // via onChange above).
          setDraft(value);
          setShowRequiredError(false);
          if (draft.trim() !== value) onValueChange(value);
        }
      }}
    />
  );
}
