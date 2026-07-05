// src/components/inline-editable-field.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Pencil, ChevronDown } from "lucide-react";
import {
  type ProseMirrorDoc,
  docIsEmpty,
  docToPlainText,
  docsEqualByText,
} from "~/lib/tiptap/types";
import type { SettingsInstructionsPreset } from "~/lib/machines/settings-instructions-presets";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

export interface InlineEditSaveResult {
  ok: boolean;
  message?: string;
}

interface InlineEditableFieldProps {
  /** The field label displayed above the content */
  label: string;
  /** Current value (null/undefined/empty treated as empty) */
  value: ProseMirrorDoc | null | undefined;
  /** Server action to save the updated value */
  onSave: (
    machineId: string,
    value: ProseMirrorDoc | null
  ) => Promise<InlineEditSaveResult>;
  /** Machine ID to pass to the save action */
  machineId: string;
  /** Whether the current user can edit this field */
  canEdit: boolean;
  /** Placeholder text shown inside the (empty) editor box for a permitted user */
  placeholder?: string;
  /** data-testid for the component root */
  testId?: string;
  /**
   * Optional starting-template presets. When provided, a small "Start from a
   * preset" control is surfaced ABOVE the open editor; picking one inserts its
   * text into the editor for the owner to edit. Inserting over existing content
   * asks for confirmation first. (PP-8a5r section 2: "How to change settings".)
   */
  presets?: readonly SettingsInstructionsPreset[];
  /**
   * When true, the EMPTY state for a permitted user is an already-open editor
   * box (with its placeholder) instead of a passive placeholder + hidden Edit
   * pencil — the owner types directly, and an explicit Save/Cancel appears once
   * the draft is dirty (PP-8a5r: the two machine-level Settings-tab sections).
   * Defaults to false so the machine name/description/notes callers keep their
   * click-to-edit empty state. Has no effect for viewers (empty + viewer still
   * renders nothing) or for the filled state.
   */
  openWhenEmpty?: boolean;
  /**
   * When true, the field renders as a tinted callout box with a left primary
   * accent, and its heading becomes a real section title (`text-sm font-bold`
   * with an optional leading `icon`) rather than the default tiny uppercase
   * muted field-label style. PP-8a5r: the two machine-level Settings sections
   * are real section callouts, not field labels. Defaults to false; only the
   * two machine-wide Settings-tab blocks pass it.
   */
  headingProminent?: boolean;
  /**
   * Optional leading icon rendered before the heading text. Only shown in the
   * `headingProminent` callout mode. Callers pass a sized, `aria-hidden` lucide
   * icon (e.g. `<Info className="size-4 shrink-0 text-primary" aria-hidden />`).
   */
  icon?: React.ReactNode;
  /**
   * Notified whenever this field's draft becomes dirty / clean. These always-
   * open machine-level fields hold their draft HERE (not in the parent's per-
   * unit edit state), so the parent wires this into its page-level unsaved-
   * changes guard to warn before navigating away from an uncommitted edit.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

export function InlineEditableField({
  label,
  value,
  onSave,
  machineId,
  canEdit,
  placeholder,
  testId,
  presets,
  openWhenEmpty = false,
  headingProminent = false,
  icon,
  onDirtyChange,
}: InlineEditableFieldProps): React.JSX.Element | null {
  // `isEditing` only tracks an EXPLICIT edit opened from the filled state (the
  // Pencil). The empty state for a permitted user is ALSO an open editor, but it
  // is derived (see `editorOpen` below) rather than flagged — so an owner can
  // type into an empty section without first clicking anything.
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<ProseMirrorDoc | null>(
    value ?? null
  );
  // Optimistic override of the server `value` while a save is in flight. The
  // WRAPPER being null means "no override — render the prop"; a present wrapper
  // with an inner `null` is an optimistic CLEAR (which `optimisticValue ?? value`
  // could not represent — it fell back to the stale prop). Reset to "no
  // override" whenever a fresh server `value` arrives (revalidation, or an edit
  // from another tab) so external changes always win.
  const [optimistic, setOptimistic] = useState<{
    value: ProseMirrorDoc | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPreset, setPendingPreset] = useState<ProseMirrorDoc | null>(
    null
  );
  // RichTextEditor (TipTap) takes `content` as an INITIAL prop and is
  // uncontrolled afterward, so a bare `setEditValue` from a preset never reaches
  // the already-mounted editor. Bumping this seed forces a remount (via the
  // editor `key`) that re-seeds it from the freshly-set `editValue`. The handle
  // exposes only clear()/focus() — no imperative setContent — so the remount is
  // the only viable injection path (bug #6).
  const [editorSeed, setEditorSeed] = useState(0);
  const [isPending, startTransition] = useTransition();

  const displayValue = optimistic ? optimistic.value : (value ?? null);
  const isEmpty = docIsEmpty(displayValue);

  // A fresh server value supersedes any optimistic guess (post-save
  // revalidation, or a concurrent edit from another tab/client). Without this,
  // the optimistic state would mask later prop changes until a full remount.
  useEffect(() => {
    setOptimistic(null);
  }, [value]);

  function handleEdit(): void {
    setEditValue(displayValue ?? null);
    setError(null);
    setIsEditing(true);
  }

  function handleCancel(): void {
    // Discard the draft back to the committed value. For an explicit edit this
    // closes the editor; for the always-open empty state it just clears the box
    // (the editor stays open because the field is still empty).
    setIsEditing(false);
    setEditValue(displayValue ?? null);
    setError(null);
  }

  // Insert a preset into the editor. If the editor already holds text, defer to
  // a confirmation so a stray pick can't wipe a customized note.
  function applyPreset(doc: ProseMirrorDoc): void {
    if (docToPlainText(editValue)) {
      setPendingPreset(doc);
      return;
    }
    setEditValue(doc);
    // Remount the editor so the empty-field direct insert is seeded with the
    // preset (the editor is uncontrolled after mount — bug #6).
    setEditorSeed((s) => s + 1);
    setError(null);
  }

  function confirmPreset(): void {
    if (pendingPreset) {
      setEditValue(pendingPreset);
      // Remount the editor so the overwrite-after-confirm is seeded with the
      // preset (the editor is uncontrolled after mount — bug #6).
      setEditorSeed((s) => s + 1);
      setError(null);
    }
    setPendingPreset(null);
  }

  function handleSave(): void {
    setError(null);

    // Normalize empty Tiptap doc (e.g. { type: "doc", content: [{ type: "paragraph" }] }) to null
    // so clearing a field persists NULL to the DB rather than a semantically-empty JSON blob.
    const valueToSave =
      editValue && docToPlainText(editValue) ? editValue : null;

    // Optimistic update (an explicit wrapper so a CLEAR shows empty immediately,
    // rather than falling back to the stale prop).
    setOptimistic({ value: valueToSave });
    setIsEditing(false);

    startTransition(async () => {
      const result = await onSave(machineId, valueToSave);
      if (!result.ok) {
        // Revert: drop the override so the field renders the server prop again.
        setOptimistic(null);
        setError(result.message ?? "Failed to save. Please try again.");
        setIsEditing(true);
      }
    });
  }

  // The editor box is open when: the user explicitly entered edit mode (Pencil
  // on a filled field), OR — for opt-in callers — the field is empty and the
  // user may edit (PP-8a5r: an empty machine-level section presents an already-
  // open box, not a button). Non-opt-in callers keep the passive placeholder +
  // hidden Edit pencil empty state.
  const editorOpen = isEditing || (openWhenEmpty && canEdit && isEmpty);

  // Save/Cancel are EXPLICIT and appear only once the draft is dirty relative to
  // the committed value (we never blur-save rich text). A clean empty box just
  // shows its placeholder; an explicit edit of a filled field is dirty the
  // moment it diverges. Compared on plain text — what actually persists.
  const isDirty = useMemo(
    () => !docsEqualByText(editValue, displayValue),
    [editValue, displayValue]
  );

  // Surface dirtiness to the parent's unsaved-changes guard (these always-open
  // machine-level fields hold their draft here, not in the parent's per-unit
  // edit state). Clears on unmount so a removed field never leaves the guard
  // armed.
  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => {
      onDirtyChange?.(false);
    };
  }, [isDirty, onDirtyChange]);

  // Empty + can't edit: hide entirely. (Placed after all hooks so the hook order
  // stays stable — see rules of hooks.)
  if (isEmpty && !canEdit) {
    return null;
  }

  const hasPresets = presets != null && presets.length > 0;

  function renderPresetControl(): React.JSX.Element | null {
    if (!presets || presets.length === 0) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid={testId ? `${testId}-preset-trigger` : undefined}
          >
            Start from a preset
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-[18rem]">
          <DropdownMenuLabel>Start from a platform</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {presets.map((preset) => (
            <DropdownMenuItem
              key={preset.key}
              onSelect={() => {
                applyPreset(preset.doc);
              }}
              data-testid={
                testId ? `${testId}-preset-${preset.key}` : undefined
              }
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div
      data-testid={testId}
      className={
        headingProminent
          ? "space-y-1.5 rounded-lg border border-outline-variant/60 border-l-[3px] border-l-primary bg-primary/[0.06] p-4"
          : "space-y-1.5"
      }
    >
      {/* The heading always renders for a permitted user (the empty state is an
          open box, so there's always something below it) and for anyone viewing
          filled content; the only no-heading case is empty + viewer, handled by
          the early return above. `headingProminent` swaps the tiny uppercase
          field-label style for a 14px bold section title with an optional
          leading icon (the machine-wide callout blocks). */}
      <p
        className={
          headingProminent
            ? "flex items-center gap-2 text-sm font-bold text-foreground"
            : "text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
        }
      >
        {headingProminent && icon}
        {label}
      </p>

      {/* Presets (section 2) sit directly UNDER the title as a "Start from a
          preset" control; picking one inserts its text into the editor below for
          the owner to edit. Shown only while the editor is open. */}
      {editorOpen && hasPresets && <div>{renderPresetControl()}</div>}

      {editorOpen ? (
        <div className="space-y-2">
          <RichTextEditor
            key={editorSeed}
            content={editValue}
            onChange={setEditValue}
            mentionsEnabled={true}
            placeholder={placeholder}
            ariaLabel={label}
            // The always-open machine-level sections want a roomy multi-line box
            // (non-compact) so the placeholder/content sits comfortably INSIDE
            // the box; compact one-line mode stays for the name/notes callers.
            compact={!openWhenEmpty}
            className={openWhenEmpty ? "min-h-[140px]" : "min-h-[40px]"}
          />
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          {/* Save/Cancel are explicit (never blur-save). In an EXPLICIT edit of
              filled content they always show (Cancel is the way back out); in
              the always-open empty state they appear only once the draft is
              dirty, so an empty untouched box shows just its placeholder. */}
          {(isEditing || isDirty) && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending}
                data-testid={testId ? `${testId}-save` : undefined}
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isPending}
                data-testid={testId ? `${testId}-cancel` : undefined}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      ) : canEdit ? (
        // Permitted, editor not open: rendered text (or, for non-opt-in callers
        // with an empty field, a passive placeholder) with a hover/focus Edit
        // affordance. RichTextDisplay can render <a> tags (mentions/urls).
        // Nesting links inside a <button> is invalid HTML, so the content sits
        // as a sibling of the Edit button rather than inside it. The Edit button
        // is the only interactive control — clicking the content does not enter
        // edit mode.
        <div
          className="group relative min-h-[1.5rem] w-full rounded-md"
          data-testid={testId ? `${testId}-display` : undefined}
        >
          {isEmpty ? (
            <p className="py-1 text-sm italic text-muted-foreground">
              {placeholder ?? `Add ${label.toLowerCase()}...`}
            </p>
          ) : (
            <RichTextDisplay
              content={displayValue}
              className={`py-1 pr-8${headingProminent ? " text-sm" : ""}`}
            />
          )}
          <button
            type="button"
            aria-label={`Edit ${label}`}
            onClick={handleEdit}
            // Hidden until hover/focus on pointer devices, but touch has neither:
            // always show it where the primary input can't hover so the affordance
            // is discoverable (CORE-A11Y — no hover-only controls on touch).
            className="absolute right-1 top-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:bg-surface-variant/50 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            data-testid={testId ? `${testId}-edit` : undefined}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        // Filled + viewer: read-only rendered text (the empty + viewer case
        // already returned null above).
        <div
          className="relative min-h-[1.5rem]"
          data-testid={testId ? `${testId}-display` : undefined}
        >
          <RichTextDisplay
            content={displayValue ?? null}
            className={`py-1${headingProminent ? " text-sm" : ""}`}
          />
        </div>
      )}

      <AlertDialog
        open={pendingPreset !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPreset(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current text?</AlertDialogTitle>
            <AlertDialogDescription>
              Applying this preset will overwrite what&apos;s currently in the{" "}
              {label.toLowerCase()} editor. You can still edit it afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPreset}
              data-testid={testId ? `${testId}-preset-confirm` : undefined}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
