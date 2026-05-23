"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { docToPlainText, type ProseMirrorDoc } from "~/lib/tiptap/types";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";

interface DescriptionInlineProps {
  value: ProseMirrorDoc | null;
  canEdit: boolean;
  placeholder?: string;
  onValueChange: (value: ProseMirrorDoc | null) => void;
}

/**
 * Compact description editor for the settings-set card header.
 *
 * Differs from InlineEditableField:
 *  - No label rendered above the content
 *  - Click anywhere on the displayed text enters edit mode
 *  - Smaller default font size (xs)
 *  - Link clicks inside the rendered content still navigate (they
 *    are not absorbed by the click-to-edit handler)
 */
export function DescriptionInline({
  value,
  canEdit,
  placeholder = "Add a description…",
  onValueChange,
}: DescriptionInlineProps): React.JSX.Element | null {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<ProseMirrorDoc | null>(value);
  const [, startTransition] = useTransition();

  const firstNode = value?.content[0];
  const isEmpty =
    !value ||
    value.content.length === 0 ||
    (value.content.length === 1 &&
      firstNode?.type === "paragraph" &&
      !firstNode.content);

  function enterEdit(target: HTMLElement): void {
    // Let users click links inside the description without entering edit mode
    if (target.closest("a")) return;
    setEditValue(value);
    setIsEditing(true);
  }

  function save(): void {
    const newValue = editValue && docToPlainText(editValue) ? editValue : null;
    setIsEditing(false);
    startTransition(() => {
      onValueChange(newValue);
    });
  }

  function cancel(): void {
    setEditValue(value);
    setIsEditing(false);
  }

  if (isEmpty && !canEdit) return null;

  if (isEditing) {
    return (
      <div
        className="space-y-1.5"
        onClick={(e) => {
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
      >
        <RichTextEditor
          content={editValue}
          onChange={setEditValue}
          mentionsEnabled={true}
          placeholder={placeholder}
          ariaLabel="Description"
          compact
          className="text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      aria-label={canEdit ? "Edit description" : undefined}
      className={cn(
        "rounded text-xs",
        canEdit &&
          "cursor-text transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      )}
      onClick={(e) => {
        if (!canEdit) return;
        e.stopPropagation();
        enterEdit(e.target as HTMLElement);
      }}
      onKeyDown={(e) => {
        if (!canEdit) return;
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          enterEdit(e.target as HTMLElement);
        }
      }}
    >
      {isEmpty ? (
        <span className="italic text-muted-foreground">{placeholder}</span>
      ) : (
        <RichTextDisplay
          content={value}
          className="text-xs text-muted-foreground"
        />
      )}
    </div>
  );
}
