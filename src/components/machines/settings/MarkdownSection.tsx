"use client";

import type React from "react";
import { InlineEditableField } from "~/components/inline-editable-field";
import { type ProseMirrorDoc, plainTextToDoc } from "~/lib/tiptap/types";

interface MarkdownSectionProps {
  title: string;
  value: string;
  canEdit: boolean;
}

/**
 * Renders a labelled markdown/rich-text field using InlineEditableField.
 * Save callback is a no-op stub (scaffold only — no persistence).
 */
export function MarkdownSection({
  title,
  value,
  canEdit,
}: MarkdownSectionProps): React.JSX.Element {
  const doc: ProseMirrorDoc = plainTextToDoc(value);

  return (
    <div className="py-2.5">
      <InlineEditableField
        label={title}
        value={doc}
        machineId="scaffold-noop"
        canEdit={canEdit}
        placeholder={`Add ${title.toLowerCase()}…`}
        onSave={() => Promise.resolve({ ok: true })}
      />
    </div>
  );
}
