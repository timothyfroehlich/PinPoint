"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";

interface NameListInputProps {
  id: string;
  /** Form field name; each name posts as its own entry, in order. */
  name: string;
  /** Singular noun for the remove button's accessible name ("Remove designer …"). */
  itemLabel: string;
  value: readonly string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
}

/**
 * An ordered list of names entered one at a time (spec machine-editing 3.5).
 * Controlled: the list lives with the caller, so it survives this input
 * unmounting (switching Source away and back).
 *
 * A name is added on Enter or when the box loses focus, so a name typed and
 * then left behind by clicking Save still posts. It is never split on commas or
 * any other punctuation: "Kaneda, Pat" or "Python Anghelo, Jr." stay one name.
 */
export function NameListInput({
  id,
  name,
  itemLabel,
  value: names,
  onChange,
  disabled = false,
}: NameListInputProps): React.JSX.Element {
  const [draft, setDraft] = useState("");

  const commitDraft = (): void => {
    const next = draft.trim();
    if (next === "") return;
    onChange([...names, next]);
    setDraft("");
  };

  const remove = (index: number): void => {
    onChange(names.filter((_, i) => i !== index));
  };

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-outline bg-surface px-1.5 py-1",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      {names.map((entry, index) => (
        // Names may repeat (two people can share one), so the index is part
        // of the key.
        <span
          key={`${String(index)}-${entry}`}
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-2 text-sm text-foreground"
        >
          <span className="truncate">{entry}</span>
          <input type="hidden" name={name} value={entry} />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              remove(index);
            }}
            aria-label={`Remove ${itemLabel} ${entry}`}
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        disabled={disabled}
        maxLength={100}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Enter adds the name; it must not submit the surrounding form.
            e.preventDefault();
            commitDraft();
          } else if (
            e.key === "Backspace" &&
            draft === "" &&
            names.length > 0
          ) {
            remove(names.length - 1);
          }
        }}
        onBlur={commitDraft}
        placeholder="Add a name"
        className="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
      />
    </div>
  );
}
