"use client";

import type React from "react";
import { useTransition } from "react";

import { deleteMachineCommentAction } from "~/app/(app)/m/[initials]/(tabs)/timeline/actions";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatRelative } from "~/lib/dates";
import type { TimelineTag } from "~/lib/timeline/machine-tags";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

export interface MachineCommentRowData {
  id: string;
  createdAt: Date;
  authorId: string | null;
  authorName: string | null;
  tag: TimelineTag;
  content: ProseMirrorDoc;
}

interface Props {
  row: MachineCommentRowData;
  canDelete: boolean;
}

/**
 * Renders a single user comment row in the machine timeline.
 *
 * Layout uses component-internal Tailwind utilities only — no viewport
 * breakpoints (AGENTS.md rule 13: this is a row in a list whose page-level
 * structure is set by the parent in Task 19).
 *
 * Email privacy (AGENTS.md rule 10): only `authorName` is rendered;
 * email is never accepted or displayed.
 *
 * Marked `"use client"` because the delete button uses `useTransition`.
 */
export function MachineTimelineCommentRow({
  row,
  canDelete,
}: Props): React.JSX.Element {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-3 border-b py-3">
      <Avatar className="size-6 shrink-0">
        <AvatarFallback>
          {(row.authorName ?? "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-semibold">{row.authorName ?? "Unknown"}</span>{" "}
            <span className="text-muted-foreground">
              · {formatRelative(row.createdAt)}
            </span>
          </div>
          <Badge variant="secondary">{row.tag}</Badge>
        </div>
        <div className="pt-1 text-sm">
          <RichTextDisplay content={row.content} />
        </div>
        {canDelete ? (
          <div className="pt-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await deleteMachineCommentAction({ id: row.id });
                });
              }}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
