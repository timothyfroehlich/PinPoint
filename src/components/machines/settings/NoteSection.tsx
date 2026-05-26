"use client";

import type React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";
import { InlineMarkdownField } from "~/components/machines/settings/InlineMarkdownField";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

export interface NoteSectionData {
  id: string;
  title: string;
  body: ProseMirrorDoc | null;
  /** Other/Notes entries own an editable title; presets (Post positions,
   *  Rubbers) keep a fixed heading. */
  customTitle: boolean;
}

const HEADING_CLASS =
  "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

interface NoteSectionProps {
  note: NoteSectionData;
  canEdit: boolean;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: ProseMirrorDoc | null) => void;
  onDelete: () => void;
}

/**
 * One free-form titled note within a settings set. Presets render a fixed
 * heading; Other/Notes entries expose an editable title. Body is the shared
 * click-anywhere markdown field. Deletable in edit mode.
 */
export function NoteSection({
  note,
  canEdit,
  onTitleChange,
  onBodyChange,
  onDelete,
}: NoteSectionProps): React.JSX.Element {
  return (
    <div className="group/note py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {note.customTitle && canEdit ? (
          <InlineEditableText
            value={note.title}
            onValueChange={onTitleChange}
            canEdit
            required
            placeholder="Section title"
            ariaLabel="section title"
            className={HEADING_CLASS}
            inputClassName="h-6 text-xs"
          />
        ) : (
          <p className={HEADING_CLASS}>{note.title || "Untitled"}</p>
        )}

        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/note:opacity-100 focus-visible:opacity-100"
            onClick={onDelete}
            aria-label={`Delete ${note.title || "note"} section`}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      <InlineMarkdownField
        value={note.body}
        canEdit={canEdit}
        placeholder={`Add ${(note.title || "notes").toLowerCase()}…`}
        onValueChange={onBodyChange}
      />
    </div>
  );
}
