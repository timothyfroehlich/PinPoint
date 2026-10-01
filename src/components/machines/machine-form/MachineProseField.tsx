"use client";

import type React from "react";
import { Label } from "~/components/ui/label";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

/**
 * One of the machine form's rich-text fields — Description or Owner's
 * Requirements — with the hidden input that carries its doc to the action.
 *
 * The editor is uncontrolled after mount (`initial` is its starting content),
 * so the caller mirrors the doc through `onChange` and hands it back as
 * `value` for the hidden field. An empty editor posts "", which the action
 * reads as "clear".
 */
export function MachineProseField({
  label,
  name,
  ariaLabel,
  placeholder,
  initial,
  value,
  onChange,
  minHeightClass,
}: {
  label: string;
  /** The FormData key the action reads. */
  name: "description" | "ownerRequirements";
  ariaLabel: string;
  placeholder: string;
  initial: ProseMirrorDoc | null;
  value: ProseMirrorDoc | null;
  onChange: (doc: ProseMirrorDoc) => void;
  minHeightClass: string;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      {/* No htmlFor: RichTextEditor is a contenteditable widget with no
          focusable `id`. Its accessible name comes from `ariaLabel`. */}
      <Label className="text-foreground">{label}</Label>
      <RichTextEditor
        content={initial}
        onChange={onChange}
        mentionsEnabled={false}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        compact={false}
        className={minHeightClass}
      />
      <input
        type="hidden"
        name={name}
        value={value ? JSON.stringify(value) : ""}
      />
    </div>
  );
}
