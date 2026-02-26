"use client";

import type React from "react";
import { useState, useRef, useEffect, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Pencil } from "lucide-react";
import { cn } from "~/lib/utils";

export interface InlineEditSaveResult {
  ok: boolean;
  message?: string;
}

interface InlineEditableFieldProps {
  /** The field label displayed above the content */
  label: string;
  /** Optional icon displayed next to the label */
  icon?: React.ElementType;
  /** Current value (null/undefined/empty treated as empty) */
  value: string | null | undefined;
  /** Server action to save the updated value */
  onSave: (machineId: string, value: string) => Promise<InlineEditSaveResult>;
  /** Machine ID to pass to the save action */
  machineId: string;
  /** Whether the current user can edit this field */
  canEdit: boolean;
  /** Placeholder text shown when value is empty and canEdit is true */
  placeholder?: string;
  /** data-testid for the component root */
  testId?: string;
  /** Visual variation. 'private' adds a distinct border and background */
  variant?: "default" | "private";
}

export function InlineEditableField({
  label,
  icon: Icon,
  value,
  onSave,
  machineId,
  canEdit,
  placeholder,
  testId,
  variant = "default",
}: InlineEditableFieldProps): React.JSX.Element | null {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");
  const [optimisticValue, setOptimisticValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayValue = optimisticValue ?? value;
  const isEmpty = !displayValue || displayValue.trim() === "";

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  function handleEdit(): void {
    setEditValue(displayValue ?? "");
    setError(null);
    setIsEditing(true);
  }

  function handleCancel(): void {
    setIsEditing(false);
    setEditValue(displayValue ?? "");
    setError(null);
  }

  function handleSave(): void {
    setError(null);

    // Optimistic update
    const newValue = editValue.trim() === "" ? null : editValue.trim();
    setOptimisticValue(newValue);
    setIsEditing(false);

    startTransition(async () => {
      const result = await onSave(machineId, editValue);
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
    <div
      data-testid={testId}
      className={cn(
        "space-y-1.5",
        variant === "private" &&
          "bg-primary/5 border border-primary/20 rounded-xl p-4"
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && (
          <Icon
            className={cn(
              "size-3.5",
              variant === "private"
                ? "text-primary/60"
                : "text-on-surface-variant/60"
            )}
            aria-hidden="true"
          />
        )}
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider",
            variant === "private" ? "text-primary" : "text-on-surface-variant"
          )}
        >
          {label}
        </p>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className="min-h-[80px] resize-y text-sm"
            maxLength={5000}
            data-testid={testId ? `${testId}-textarea` : undefined}
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
            "group relative min-h-[80px]",
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
            <p className="whitespace-pre-wrap py-1 text-sm text-on-surface">
              {displayValue}
            </p>
          )}
          {canEdit && (
            <Pencil
              className="absolute right-2 top-1 size-3.5 text-on-surface-variant opacity-30 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
}
