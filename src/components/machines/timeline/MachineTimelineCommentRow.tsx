"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import {
  deleteMachineCommentAction,
  editMachineCommentAction,
} from "~/app/(app)/m/[initials]/(tabs)/timeline/actions";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { RichTextEditor } from "~/components/editor/RichTextEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  MachineAttributionLine,
  type MachineLabel,
} from "~/components/machines/timeline/MachineAttributionLine";
import {
  TagPill,
  TagSelect,
  USER_TAGS,
} from "~/components/machines/timeline/TagSelect";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { formatRelative } from "~/lib/dates";
import { type TimelineTag } from "~/lib/timeline/machine-tags";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import { PersonHoverCard } from "~/components/people/PersonHoverCard";

export interface MachineCommentRowData {
  id: string;
  createdAt: Date;
  authorId: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  editedAt: Date | null;
  tag: TimelineTag;
  content: ProseMirrorDoc;
}

interface Props {
  row: MachineCommentRowData;
  canEdit: boolean;
  canDelete: boolean;
  /** See `MachineTimelineSystemRow` for the rationale. */
  showRelativeTime?: boolean;
  /**
   * Absolute date ("May 14") for rows inside a Tier-2 (month) bucket. Shares
   * the right-pinned timestamp slot with the relative time — month rows show
   * the date there instead of "N ago". Tier-1 (day) buckets leave this
   * undefined since the bucket banner names the day.
   */
  rowDateLabel?: string;
  /**
   * Opt-in machine attribution line for combined (collection) feeds.
   * Per-machine timelines never set this — their rendering is unchanged.
   */
  machineLabel?: MachineLabel;
}

/**
 * Renders a single user comment row in the machine timeline.
 *
 * Edit and delete actions live in a kebab menu (mirrors `IssueTimeline`).
 * Edit is gated by `machines.timeline.comment.edit` (own only); delete by
 * `machines.timeline.comment.delete` (own_or_owner; admin override). Both
 * checks happen in the parent page and are passed in.
 *
 * Email privacy (AGENTS.md rule 10): only `authorName` is rendered.
 *
 * Marked `"use client"` because the edit form, kebab menu, delete dialog,
 * and action submissions need browser-side state and `useTransition`.
 */
export function MachineTimelineCommentRow({
  row,
  canEdit,
  canDelete,
  showRelativeTime = true,
  rowDateLabel,
  machineLabel,
}: Props): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const canShowActions = canEdit || canDelete;

  // Right-pinned timestamp slot (matches issue/system rows): relative time
  // for "today" rows, the absolute date for month-rollup rows. One slot,
  // never both. `<RelativeTime>` ticks every 60s so the label stays accurate
  // while the page is open; a raw formatRelative() would freeze at first
  // render. `(edited)` keeps the static `formatRelative` for the hover-title
  // — only paints when hovered and doesn't need to tick.
  const rightMeta: React.ReactNode = showRelativeTime ? (
    <RelativeTime value={row.createdAt} />
  ) : (
    rowDateLabel
  );

  return (
    <div className="flex gap-3 border-b py-3">
      <Avatar className="size-10 shrink-0 border border-border/60 ring-4 ring-background">
        {row.authorAvatarUrl ? (
          <AvatarImage
            src={row.authorAvatarUrl}
            alt={row.authorName ?? "Author"}
          />
        ) : null}
        <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
          {(row.authorName ?? "??").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        {machineLabel ? (
          <MachineAttributionLine machine={machineLabel} />
        ) : null}
        <div className="flex items-center gap-2 text-xs">
          {/*
           * Left cluster: author + tag. The tag pill sits *inline* with the
           * name (PP-0x98 V2 design pass) so the comment row's left cluster
           * matches the issue row's `[id] [verb] [badges]` pattern. The
           * timestamp is right-pinned (below) so it lines up with the
           * issue/system rows' time column.
           */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <PersonHoverCard
              userId={row.authorId}
              displayName={row.authorName ?? "Unknown"}
              className="font-semibold"
            />
            <TagPill tag={row.tag} />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {row.editedAt ? (
              <span
                className="whitespace-nowrap italic text-muted-foreground/70"
                title={`Edited ${formatRelative(row.editedAt)}`}
              >
                (edited)
              </span>
            ) : null}
            {rightMeta ? (
              <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                {rightMeta}
              </span>
            ) : null}
            {canShowActions && !isEditing ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-my-1 -mr-1"
                    aria-label="Comment actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit ? (
                    <DropdownMenuItem
                      onSelect={() => {
                        setIsEditing(true);
                      }}
                    >
                      <Pencil className="mr-2 size-4" />
                      <span>Edit</span>
                    </DropdownMenuItem>
                  ) : null}
                  {canDelete ? (
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onSelect={() => {
                        setIsDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="mr-2 size-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
        {isEditing ? (
          <CommentEditForm
            commentId={row.id}
            initialContent={row.content}
            initialTag={row.tag}
            onCancel={() => {
              setIsEditing(false);
            }}
          />
        ) : (
          <div className="pt-1 text-sm">
            <RichTextDisplay content={row.content} />
          </div>
        )}
      </div>
      {canDelete ? (
        <DeleteCommentDialog
          commentId={row.id}
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
        />
      ) : null}
    </div>
  );
}

interface CommentEditFormProps {
  commentId: string;
  initialContent: ProseMirrorDoc;
  initialTag: TimelineTag;
  onCancel: () => void;
}

function CommentEditForm({
  commentId,
  initialContent,
  initialTag,
  onCancel,
}: CommentEditFormProps): React.JSX.Element {
  const [doc, setDoc] = useState<ProseMirrorDoc>(initialContent);
  // initialTag may be a reserved tag (lifecycle/issue) if this row was
  // accidentally classified that way, but new user comments only allow
  // USER_TAGS. Fall back to the neutral default "note" (not a work type like
  // "maintenance") if the current tag is reserved, so a data-integrity edge
  // case can't silently retag content as maintenance.
  const initialUserTag: TimelineTag = (
    USER_TAGS as readonly TimelineTag[]
  ).includes(initialTag)
    ? initialTag
    : "note";
  const [tag, setTag] = useState<TimelineTag>(initialUserTag);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = (): void => {
    setError(null);
    startTransition(async () => {
      const result = await editMachineCommentAction({
        id: commentId,
        tag,
        contentJson: JSON.stringify(doc),
      });
      if (result.success) {
        onCancel();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="mt-2 rounded-md border bg-card p-2">
      <RichTextEditor
        content={doc}
        onChange={setDoc}
        placeholder="Edit your entry…"
        compact
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <TagSelect value={tag} onChange={setTag} disabled={pending} />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={handleSave}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

interface DeleteCommentDialogProps {
  commentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DeleteCommentDialog({
  commentId,
  open,
  onOpenChange,
}: DeleteCommentDialogProps): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent): void => {
    // AlertDialogAction auto-closes the dialog on click (Radix). Prevent that
    // so a failed delete keeps the dialog open to render `error`; we close it
    // ourselves only on success.
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteMachineCommentAction({ id: commentId });
        if (result.success) {
          onOpenChange(false);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the entry as deleted. The text will no longer be
            visible to others.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={pending}
            type="button"
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
