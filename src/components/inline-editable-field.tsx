// src/components/inline-editable-field.tsx
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Pencil } from "lucide-react";
import { cn } from "~/lib/utils";
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
      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
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
      ) : (
        <div
          className={cn(
            "group relative min-h-[1.5rem]",
            canEdit && "cursor-pointer rounded-md hover:bg-surface-variant/50"
          )}
          onClick={canEdit ? handleEdit : undefined}
          onKeyDown={
            canEdit
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleEdit();
                  }
                }
              : undefined
          }
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          data-testid={testId ? `${testId}-display` : undefined}
        >
          {isEmpty ? (
            <p className="py-1 text-sm italic text-on-surface-variant/60">
              {placeholder ?? `Add ${label.toLowerCase()}...`}
            </p>
          ) : (
            <RichTextDisplay content={displayValue} className="py-1" />
          )}
          {canEdit && (
            <Pencil
              className="absolute right-2 top-1 size-3.5 text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
}
