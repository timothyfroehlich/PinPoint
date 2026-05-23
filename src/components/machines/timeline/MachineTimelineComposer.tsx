"use client";

import type React from "react";
import { useEffect, useState, useTransition } from "react";

import { addMachineCommentAction } from "~/app/(app)/m/[initials]/(tabs)/timeline/actions";
import { RichTextEditor } from "~/components/editor/RichTextEditor";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import {
  TIMELINE_TAGS,
  RESERVED_TAGS,
  getTagLabel,
  type TimelineTag,
  userTagSchema,
} from "~/lib/timeline/machine-tags";
import {
  USER_TAG_DECORATION,
  isUserTag,
  tagTextColor,
} from "~/lib/timeline/user-tag-decoration";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import { cn } from "~/lib/utils";

const USER_TAGS = TIMELINE_TAGS.filter(
  (t): t is Exclude<TimelineTag, (typeof RESERVED_TAGS)[number]> =>
    !(RESERVED_TAGS as readonly string[]).includes(t)
);

interface Props {
  machineId: string;
  onPosted: () => void;
}

/**
 * Compose form for new timeline entries.
 *
 * - 3-line min-height by default so it feels like a writing surface, not a
 *   chat input.
 * - Tag selector lives next to Post (mirrors issue-detail badge-update
 *   pattern: shadcn Select with the chosen tag rendered as a colored pill).
 * - Tag has no default — Post is disabled until the author has picked one
 *   AND the body is non-empty. This is intentional: forces an explicit
 *   classification choice rather than silently shipping everything as
 *   "maintenance".
 * - No Cancel button. Once you start composing, you commit by posting.
 *   `beforeunload` guard warns on tab close / reload only — in-app Link
 *   clicks don't trigger it (Next App Router has no route-change hook).
 */
export function MachineTimelineComposer({
  machineId,
  onPosted,
}: Props): React.ReactElement {
  const [tag, setTag] = useState<TimelineTag | null>(null);
  const [doc, setDoc] = useState<ProseMirrorDoc>({ type: "doc", content: [] });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasBody = docHasText(doc);
  const isDirty = hasBody || tag !== null;
  const canPost = hasBody && tag !== null && !pending;

  // Tab-close / reload guard. Will NOT fire for in-app Link clicks — that's
  // a Next App Router limitation, not a bug here. Users still lose work if
  // they click a nav Link mid-compose.
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [isDirty]);

  const handlePost = (): void => {
    if (tag === null || !hasBody || pending) return;
    setError(null);
    const chosenTag = tag;
    startTransition(async () => {
      const result = await addMachineCommentAction({
        machineId,
        tag: chosenTag,
        contentJson: JSON.stringify(doc),
      });
      if (result.success) {
        setDoc({ type: "doc", content: [] });
        setTag(null);
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
        className="min-h-[80px]"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <TagSelect value={tag} onChange={setTag} disabled={pending} />
        <Button disabled={!canPost} onClick={handlePost}>
          {pending ? "Posting…" : "Post"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

interface TagSelectProps {
  value: TimelineTag | null;
  onChange: (next: TimelineTag) => void;
  disabled?: boolean;
}

/**
 * Colored tag picker — mirrors the issue-detail inline-edit pattern
 * (`UpdateIssueStatusForm`): a shadcn Select whose trigger renders the
 * chosen value as a styled pill. When unset, shows a neutral "Add tag"
 * placeholder.
 */
function TagSelect({
  value,
  onChange,
  disabled = false,
}: TagSelectProps): React.JSX.Element {
  const selectedDecoration =
    value && isUserTag(value) ? USER_TAG_DECORATION[value] : null;
  const SelectedIcon = selectedDecoration?.Icon;
  return (
    <Select
      {...(value !== null ? { value } : {})}
      disabled={disabled}
      onValueChange={(v) => {
        const parsed = userTagSchema.safeParse(v);
        if (parsed.success) onChange(parsed.data);
      }}
    >
      <SelectTrigger
        aria-label="Tag"
        className={cn(
          "h-9 w-36 justify-between gap-2 border text-sm font-semibold",
          selectedDecoration
            ? selectedDecoration.badgeClass
            : "border-dashed border-outline-variant text-muted-foreground"
        )}
      >
        {selectedDecoration && SelectedIcon && value ? (
          <span className="flex items-center gap-1">
            <SelectedIcon aria-hidden="true" className="size-4" />
            {getTagLabel(value)}
          </span>
        ) : (
          <span>Add tag</span>
        )}
      </SelectTrigger>
      <SelectContent>
        {USER_TAGS.map((t) => {
          const deco = USER_TAG_DECORATION[t];
          // Apply the tag's text-color directly to the icon SVG. SelectItem
          // carries `[&_svg:not([class*='text-'])]:text-muted-foreground`,
          // which would otherwise grey out an icon that only inherits color
          // from its parent span.
          const textColor = tagTextColor(deco.badgeClass);
          return (
            <SelectItem key={t} value={t}>
              <span className={cn("flex items-center gap-2", textColor)}>
                <deco.Icon
                  aria-hidden="true"
                  className={cn("size-4", textColor)}
                />
                {getTagLabel(t)}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** ProseMirror "has any non-whitespace text" check — gates the Post button. */
function docHasText(doc: ProseMirrorDoc): boolean {
  for (const node of doc.content) {
    if (nodeHasText(node)) return true;
  }
  return false;
}

function nodeHasText(node: { text?: string; content?: unknown[] }): boolean {
  if (typeof node.text === "string" && node.text.trim().length > 0) {
    return true;
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child === "object" && child !== null && nodeHasText(child)) {
        return true;
      }
    }
  }
  return false;
}
