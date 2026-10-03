"use client";

import type React from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { TAG_NAME_MAX } from "~/lib/tags/names";

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
        maxLength={TAG_NAME_MAX}
        autoComplete="off"
        enterKeyHint="done"
        aria-invalid={errorId !== undefined}
        aria-describedby={errorId}
      />
    </div>
  );
}
