"use client";

import type React from "react";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";
import { InlineMarkdownField } from "~/components/machines/settings/InlineMarkdownField";
import { SECTION_TITLE_CLASS } from "~/components/machines/settings/styles";
import { cn } from "~/lib/utils";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import type { NoteSectionData } from "~/lib/machines/settings-types";

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
    <div className="py-2.5 max-md:py-1.5">
      {/* pr-14 in edit mode keeps the title input clear of SortableSection's
          floating grip/delete cluster at the row's right end. */}
      <div className={cn("mb-1.5", note.customTitle && canEdit && "pr-14")}>
        {note.customTitle && canEdit ? (
          <InlineEditableText
            value={note.title}
            onValueChange={onTitleChange}
            canEdit
            required
            placeholder="Section title"
            ariaLabel="section title"
            className={SECTION_TITLE_CLASS}
            inputClassName="h-7 text-sm font-semibold"
          />
        ) : (
          <p className={SECTION_TITLE_CLASS}>{note.title || "Untitled"}</p>
        )}
      </div>
      {/* Section content hangs indented under the heading so headings read as the structural landmarks. */}
      <div className="pl-2">
        <InlineMarkdownField
          value={note.body}
          canEdit={canEdit}
          placeholder={`Add ${(note.title || "notes").toLowerCase()}…`}
          onValueChange={onBodyChange}
        />
      </div>
    </div>
  );
}
