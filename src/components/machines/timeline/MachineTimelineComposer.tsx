"use client";

import type React from "react";
import { useState, useTransition } from "react";

import { addMachineCommentAction } from "~/app/(app)/m/[initials]/(tabs)/timeline/actions";
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
  userTagSchema,
} from "~/lib/timeline/machine-tags";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

const USER_TAGS = TIMELINE_TAGS.filter(
  (t): t is Exclude<TimelineTag, (typeof RESERVED_TAGS)[number]> =>
    !(RESERVED_TAGS as readonly string[]).includes(t)
);

interface Props {
  machineId: string;
  onCancel: () => void;
  onPosted: () => void;
}

/**
 * Controlled compose form. The collapsed "+ New entry" trigger lives on the
 * filter row (`MachineTimelineActionsRow`) so the parent owns the expand
 * state — there is no longer an internal collapsed-trigger variant.
 */
export function MachineTimelineComposer({
  machineId,
  onCancel,
  onPosted,
}: Props): React.ReactElement {
  const [tag, setTag] = useState<TimelineTag>("maintenance");
  const [doc, setDoc] = useState<ProseMirrorDoc>({ type: "doc", content: [] });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCancel = (): void => {
    setDoc({ type: "doc", content: [] });
    setError(null);
    onCancel();
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
        onPosted();
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
            // Validate via userTagSchema rather than blind-casting — guards
            // against accidentally accepting a reserved tag if the Select
            // options ever change (PP-0x98 review).
            const parsed = userTagSchema.safeParse(v);
            if (parsed.success) setTag(parsed.data);
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
