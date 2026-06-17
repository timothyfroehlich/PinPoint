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
  /** This section unit's edit mode (PP-43q3). Gates the editable title input
   *  and opens the body editor; at rest both render as finished text. */
  editing: boolean;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: ProseMirrorDoc | null) => void;
}

/**
 * One free-form titled note within a settings set. Presets render a fixed
 * heading; Other/Notes entries expose an editable title (when the section unit
 * is editing). The body is the shared markdown field, opened by this section's
 * Edit/Done. Reordering and deletion are handled by the surrounding
 * SortableSection's grip + kebab.
 */
export function NoteSection({
  note,
  editing,
  onTitleChange,
  onBodyChange,
}: NoteSectionProps): React.JSX.Element {
  return (
    <div className="py-2.5 max-md:py-1.5">
      {/* pr-14 in edit mode keeps the title input clear of SortableSection's
          floating grip/kebab cluster at the row's right end. */}
      <div className={cn("mb-1.5", note.customTitle && editing && "pr-14")}>
        {note.customTitle ? (
          <span className={SECTION_TITLE_CLASS}>
            <InlineEditableText
              value={note.title}
              onValueChange={onTitleChange}
              canEdit={editing}
              required
              placeholder="Section title"
              ariaLabel="section title"
              inputClassName="h-7 text-sm font-semibold"
            />
          </span>
        ) : (
          <p className={SECTION_TITLE_CLASS}>{note.title || "Untitled"}</p>
        )}
      </div>
      {/* Section content hangs indented under the heading so headings read as the structural landmarks. */}
      <div className="pl-2">
        <InlineMarkdownField
          value={note.body}
          editing={editing}
          placeholder={`Add ${(note.title || "notes").toLowerCase()}…`}
          onValueChange={onBodyChange}
        />
      </div>
    </div>
  );
}
