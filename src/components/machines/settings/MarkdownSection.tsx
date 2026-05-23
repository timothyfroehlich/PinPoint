"use client";

import type React from "react";
import { InlineMarkdownField } from "~/components/machines/settings/InlineMarkdownField";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

interface MarkdownSectionProps {
  title: string;
  value: ProseMirrorDoc | null;
  canEdit: boolean;
  onValueChange?: (value: ProseMirrorDoc | null) => void;
}

/**
 * A labelled markdown section (Rubbers / Post positions / Notes) built on the
 * shared InlineMarkdownField: click-anywhere to edit, commit-on-blur-out, no
 * per-field Save/Cancel.
 */
export function MarkdownSection({
  title,
  value,
  canEdit,
  onValueChange,
}: MarkdownSectionProps): React.JSX.Element {
  return (
    <div className="py-2.5">
      <InlineMarkdownField
        label={title}
        value={value}
        canEdit={canEdit}
        placeholder={`Add ${title.toLowerCase()}…`}
        onValueChange={(v) => {
          onValueChange?.(v);
        }}
      />
    </div>
  );
}
