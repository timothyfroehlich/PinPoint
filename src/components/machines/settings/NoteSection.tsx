"use client";

import type React from "react";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";
import { InlineMarkdownField } from "~/components/machines/settings/InlineMarkdownField";
import { SECTION_LABEL_CLASS } from "~/components/machines/settings/styles";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

export interface NoteSectionData {
  id: string;
  title: string;
  body: ProseMirrorDoc | null;
  /** Other/Notes entries own an editable title; presets (Post positions,
   *  Rubbers) keep a fixed heading. */
  customTitle: boolean;
}

interface NoteSectionProps {
  note: NoteSectionData;
  canEdit: boolean;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: ProseMirrorDoc | null) => void;
}

/**
 * One free-form titled note within a settings set. Presets render a fixed
 * heading; Other/Notes entries expose an editable title. Body is the shared
 * click-anywhere markdown field. Reordering and deletion are handled by the
 * surrounding SortableSection.
 */
export function NoteSection({
  note,
  canEdit,
  onTitleChange,
  onBodyChange,
}: NoteSectionProps): React.JSX.Element {
  return (
    <div className="py-2.5">
      <div className="mb-1.5">
        {note.customTitle && canEdit ? (
          <InlineEditableText
            value={note.title}
            onValueChange={onTitleChange}
            canEdit
            required
            placeholder="Section title"
            ariaLabel="section title"
            className={SECTION_LABEL_CLASS}
            inputClassName="h-6 text-xs"
          />
        ) : (
          <p className={SECTION_LABEL_CLASS}>{note.title || "Untitled"}</p>
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
