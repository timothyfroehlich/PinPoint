"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface InlineEditableTextProps {
  value: string;
  onValueChange: (newValue: string) => void;
  /**
   * Per-unit edit gate (PP-43q3 atomic per-unit commit model). True means "this
   * unit is in edit mode" — the field renders as an always-open <input> whose
   * commits update the WORKING COPY ONLY (no persistence here). The owning unit's
   * Save is the sole persist boundary; this field never writes to the server.
   * False renders finished, non-interactive text with NO hover affordance.
   * Editability is exactly (canEdit AND the owning unit is editing), folded into
   * this single flag by the parent.
   */
  canEdit?: boolean;
  /** Field can't be left empty: shows invalid styling while blank and marks the
   *  placeholder with a required hint when a commit is attempted empty. */
  required?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}

/**
 * Single-line settings field. Under the atomic per-unit commit model (PP-43q3)
 * this has two flat states with no hover behavior between them:
 *  - NOT editing (`canEdit` false): finished, non-interactive text — just the
 *    value (or an italic placeholder). No pencil, no hover tint, no click
 *    target. A field at rest is indistinguishable from static copy.
 *  - editing (`canEdit` true): an always-open <input>. Commit on blur/Enter
 *    pushes the typed value into the WORKING COPY via `onValueChange` — it does
 *    NOT persist. Persistence is the unit's Save (see SettingsTab); buffering
 *    all field edits until that one atomic write is the whole point of the
 *    model. Esc reverts the draft to the working copy.
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
  const [draft, setDraft] = useState(value);
  // Required-field errors stay silent until the user actually tries to leave
  // the field empty — a freshly-opened blank field shows no red flair.
  const [showRequiredError, setShowRequiredError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEmptyRequired = required && draft.trim() === "";
  const showInvalid = isEmptyRequired && showRequiredError;
  // Mark required fields up front (design-bible §683 asterisk convention,
  // adapted for these label-less inline inputs): a trailing " *" in the
  // placeholder plus aria-required, so the requirement is visible/announced
  // before the user tries (and fails) to Save empty.
  const editPlaceholder = required ? `${placeholder} *` : placeholder;

  // The freshest working-copy value, mirrored so the edit-transition effect can
  // seed the draft from it WITHOUT depending on `value` (which would re-run the
  // effect on every external change and clobber an in-progress draft).
  const valueRef = useRef(value);
  valueRef.current = value;

  // Keep the draft in sync with the working copy whenever the field is NOT in
  // edit mode (e.g. a duplicate/preferred mutation, or a Cancel that restored
  // the baseline slice, rewrote it). While editing, the input owns the draft.
  useEffect(() => {
    if (!canEdit) setDraft(value);
  }, [value, canEdit]);

  // The edit transition: when this field becomes editable, seed the input from
  // the current value and focus + select it so the owner lands on it without an
  // extra click. Keyed on `canEdit` alone (value comes from the ref).
  useEffect(() => {
    if (canEdit) {
      setDraft(valueRef.current);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [canEdit]);

  function commit(): void {
    const trimmed = draft.trim();
    if (required && trimmed === "") {
      // Tried to leave a required field blank: reveal the error. The input stays
      // open (the unit is still editing), so the user can fix it.
      setShowRequiredError(true);
      return;
    }
    // Push the committed value into the working copy only — no persist. The
    // unit's Save reads this working copy and writes it as one atomic row.
    // Compare on value alone (not `trimmed && …`): the required guard above
    // already blocks empty for required fields, so for OPTIONAL fields a
    // clear-to-empty is a real edit and must propagate (otherwise the old value
    // silently sticks — e.g. an unnamed DIP bank could never be re-blanked).
    if (trimmed !== value) {
      onValueChange(trimmed);
    }
  }

  // View mode (not editing, or no permission): finished text. No pencil, no
  // hover tint, no interactivity — a resting field reads as plain copy.
  if (!canEdit) {
    return (
      <span className={className}>
        {value || (
          <span className="italic text-muted-foreground">{placeholder}</span>
        )}
      </span>
    );
  }

  // Editing: the always-open input. Commit on blur or Enter buffers the value
  // into the working copy; Esc reverts the draft to the working copy.
  return (
    <Input
      ref={inputRef}
      value={draft}
      // Opaque fill (not the default translucent bg-input/30) so the box reads
      // clearly as an editable field — the set name in particular sits on the
      // tinted header band, where a translucent input vanishes. (PP-43q3)
      className={cn("h-7 bg-background", inputClassName)}
      placeholder={editPlaceholder}
      aria-label={
        showInvalid && ariaLabel ? `${ariaLabel} (required)` : ariaLabel
      }
      aria-required={required || undefined}
      aria-invalid={showInvalid || undefined}
      // Commit-on-Enter single field: tell mobile keyboards the Enter key
      // finishes the field. Titles/names are prose, so leave spellcheck and
      // sentence-case capitalization at their (on) defaults.
      enterKeyHint="done"
      onClick={(e) => {
        e.stopPropagation();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onBlur={() => {
        commit();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(value);
        }
      }}
    />
  );
}
