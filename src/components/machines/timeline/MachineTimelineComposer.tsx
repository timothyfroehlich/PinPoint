"use client";

import type React from "react";
import { useState, useTransition } from "react";

import { addMachineCommentAction } from "~/app/(app)/m/[initials]/timeline/actions";
import { RichTextEditor } from "~/components/editor/RichTextEditor";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  TIMELINE_TAGS,
  RESERVED_TAGS,
  getTagLabel,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

const USER_TAGS = TIMELINE_TAGS.filter(
  (t): t is Exclude<TimelineTag, (typeof RESERVED_TAGS)[number]> =>
    !(RESERVED_TAGS as readonly string[]).includes(t)
);

interface Props {
  machineId: string;
}

export function MachineTimelineComposer({
  machineId,
}: Props): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [tag, setTag] = useState<TimelineTag>("maintenance");
  const [doc, setDoc] = useState<ProseMirrorDoc>({ type: "doc", content: [] });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
        }}
        onFocus={() => {
          setExpanded(true);
        }}
        className="flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm text-muted-foreground hover:border-foreground/20"
      >
        What did you do?
      </button>
    );
  }

  const handleCancel = (): void => {
    setExpanded(false);
    setDoc({ type: "doc", content: [] });
    setError(null);
  };

  const handlePost = (): void => {
    setError(null);
    startTransition(async () => {
      const result = await addMachineCommentAction({
        machineId,
        tag,
        contentJson: JSON.stringify(doc),
      });
      if (result.success) {
        setDoc({ type: "doc", content: [] });
        setExpanded(false);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="rounded-md border bg-card p-3">
      <RichTextEditor
        content={doc}
        onChange={setDoc}
        placeholder="Describe what you did…"
        compact
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <Select
          value={tag}
          onValueChange={(v) => {
            setTag(v as TimelineTag);
          }}
        >
          <SelectTrigger aria-label="Tag" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_TAGS.map((t) => (
              <SelectItem key={t} value={t}>
                {getTagLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleCancel} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={handlePost}>
            {pending ? "Posting…" : "Post"}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
