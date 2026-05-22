// src/components/inline-editable-field.tsx
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Pencil } from "lucide-react";
import { type ProseMirrorDoc, docToPlainText } from "~/lib/tiptap/types";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";

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
  /** Placeholder text shown when value is empty and canEdit is true */
  placeholder?: string;
  /** data-testid for the component root */
  testId?: string;
}

export function InlineEditableField({
  label,
  value,
  onSave,
  machineId,
  canEdit,
  placeholder,
  testId,
}: InlineEditableFieldProps): React.JSX.Element | null {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<ProseMirrorDoc | null>(
    value ?? null
  );
  const [optimisticValue, setOptimisticValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const displayValue = optimisticValue ?? value;
  const firstNode = displayValue?.content[0];
  const isEmpty =
    !displayValue ||
    displayValue.content.length === 0 ||
    (displayValue.content.length === 1 &&
      firstNode?.type === "paragraph" &&
      !firstNode.content);

  function handleEdit(): void {
    setEditValue(displayValue ?? null);
    setError(null);
    setIsEditing(true);
  }

  function handleCancel(): void {
    setIsEditing(false);
    setEditValue(displayValue ?? null);
    setError(null);
  }

  function handleSave(): void {
    setError(null);

    // Normalize empty Tiptap doc (e.g. { type: "doc", content: [{ type: "paragraph" }] }) to null
    // so clearing a field persists NULL to the DB rather than a semantically-empty JSON blob.
    const valueToSave =
      editValue && docToPlainText(editValue) ? editValue : null;

    // Optimistic update
    setOptimisticValue(valueToSave);
    setIsEditing(false);

    startTransition(async () => {
      const result = await onSave(machineId, valueToSave);
      if (!result.ok) {
        // Revert optimistic update
        setOptimisticValue(value);
        setError(result.message ?? "Failed to save. Please try again.");
        setIsEditing(true);
      }
    });
  }

  // If the field is empty and the user cannot edit, hide entirely
  if (isEmpty && !canEdit) {
    return null;
  }

  return (
    <div data-testid={testId} className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      {isEditing ? (
        <div className="space-y-2">
          <RichTextEditor
            content={editValue}
            onChange={setEditValue}
            mentionsEnabled={true}
            placeholder={placeholder}
            ariaLabel={label}
            compact
            className="min-h-[40px]"
          />
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
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
        </div>
      ) : canEdit ? (
        // RichTextDisplay can render <a> tags (mentions/urls). Nesting links
        // inside a <button> is invalid HTML, so the content sits as a sibling
        // of the Edit button rather than inside it. The Edit button is the
        // only interactive control here — clicking the content itself does
        // not enter edit mode.
        <div
          className="group relative min-h-[1.5rem] w-full rounded-md"
          data-testid={testId ? `${testId}-display` : undefined}
        >
          {isEmpty ? (
            <p className="py-1 text-sm italic text-muted-foreground/60">
              {placeholder ?? `Add ${label.toLowerCase()}...`}
            </p>
          ) : (
            <RichTextDisplay content={displayValue} className="py-1 pr-8" />
          )}
          <button
            type="button"
            aria-label={`Edit ${label}`}
            onClick={handleEdit}
            className="absolute right-1 top-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:bg-surface-variant/50 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
            data-testid={testId ? `${testId}-edit` : undefined}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div
          className="relative min-h-[1.5rem]"
          data-testid={testId ? `${testId}-display` : undefined}
        >
          {isEmpty ? null : (
            <RichTextDisplay content={displayValue} className="py-1" />
          )}
        </div>
      )}
    </div>
  );
}
