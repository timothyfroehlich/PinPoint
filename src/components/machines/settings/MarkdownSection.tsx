"use client";

import type React from "react";
import { InlineEditableField } from "~/components/inline-editable-field";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

interface MarkdownSectionProps {
  title: string;
  value: ProseMirrorDoc | null;
  canEdit: boolean;
  onValueChange?: (value: ProseMirrorDoc | null) => void;
}

/**
 * Renders a labelled markdown/rich-text field using InlineEditableField.
 * In the scaffold, save is a no-op at the server boundary — the new value is
 * forwarded to onValueChange so the parent's local state stays in sync.
 */
export function MarkdownSection({
  title,
  value,
  canEdit,
  onValueChange,
}: MarkdownSectionProps): React.JSX.Element {
  return (
    <div className="py-2.5">
      <InlineEditableField
        label={title}
        value={value}
        machineId="scaffold-noop"
        canEdit={canEdit}
        placeholder={`Add ${title.toLowerCase()}…`}
        onSave={(_machineId, newValue) => {
          onValueChange?.(newValue);
          return Promise.resolve({ ok: true });
        }}
      />
    </div>
  );
}
