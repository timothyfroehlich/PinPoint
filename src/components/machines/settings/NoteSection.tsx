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
  /** Permission to edit (PP-43q3 always-live model). Gates whether the title
   *  input and body editor are always-live or rendered as finished text. */
  canEdit: boolean;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: ProseMirrorDoc | null) => void;
  /** Called on title blur so the parent can flush the auto-save debounce. */
  onTitleBlur?: (() => void) | undefined;
}

/**
 * One free-form titled note within a settings set. Presets render a fixed
 * heading; Other/Notes entries expose an always-live editable title (for
 * permitted users). The body is the shared markdown field. Reordering and
 * deletion are handled by the surrounding SortableSection's grip + kebab.
 */
export function NoteSection({
  note,
  canEdit,
  onTitleChange,
  onBodyChange,
  onTitleBlur,
}: NoteSectionProps): React.JSX.Element {
  return (
    <div className="py-2.5 max-md:py-1.5">
      {/* pr-14 keeps the title input clear of SortableSection's floating
          grip/kebab cluster at the row's right end when editing is permitted. */}
      <div className={cn("mb-1.5", note.customTitle && canEdit && "pr-14")}>
        {note.customTitle ? (
          <span className={SECTION_TITLE_CLASS}>
            <InlineEditableText
              value={note.title}
              onValueChange={onTitleChange}
              canEdit={canEdit}
              required
              placeholder="Section title"
              ariaLabel="section title"
              inputClassName="h-7 text-sm font-semibold"
              onBlurCommit={onTitleBlur}
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
          canEdit={canEdit}
          placeholder={`Add ${(note.title || "notes").toLowerCase()}…`}
          onValueChange={onBodyChange}
        />
      </div>
    </div>
  );
}
