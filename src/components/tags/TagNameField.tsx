"use client";

import type React from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  normalizeTagName,
  TAG_NAME_MAX,
  tagNameLength,
} from "~/lib/tags/names";

interface TagNameFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Id of the element describing the current error, when there is one. */
  errorId?: string | undefined;
}

/** The required name input shared by the tag and tag type dialogs (spec 11.2–11.3). */
export function TagNameField({
  id,
  value,
  onChange,
  errorId,
}: TagNameFieldProps): React.JSX.Element {
  // The limit applies to the stored name: spaces collapsed, an emoji counting
  // once. A raw maxLength would cut pasted text short of a valid name.
  const tooLong = tagNameLength(normalizeTagName(value)) > TAG_NAME_MAX;
  const describedBy =
    [tooLong ? `${id}-too-long` : undefined, errorId]
      .filter((part) => part !== undefined)
      .join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        Name
        <span aria-hidden="true" className="text-destructive-text">
          {" "}
          *
        </span>
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        autoComplete="off"
        enterKeyHint="done"
        aria-invalid={tooLong || errorId !== undefined}
        aria-describedby={describedBy}
      />
      {tooLong ? (
        <p id={`${id}-too-long`} className="text-sm text-destructive-text">
          Name over {TAG_NAME_MAX} characters
        </p>
      ) : null}
    </div>
  );
}
