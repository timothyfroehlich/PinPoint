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
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatRelative } from "~/lib/dates";
import {
  RESERVED_TAGS,
  TIMELINE_TAGS,
  type TimelineTag,
  getTagLabel,
  userTagSchema,
} from "~/lib/timeline/machine-tags";
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
  canEdit: boolean;
  canDelete: boolean;
}

const USER_TAGS = TIMELINE_TAGS.filter(
  (t): t is Exclude<TimelineTag, (typeof RESERVED_TAGS)[number]> =>
    !(RESERVED_TAGS as readonly string[]).includes(t)
);

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
}: Props): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const canShowActions = canEdit || canDelete;

  return (
    <div className="flex gap-3 border-b py-3">
      <Avatar className="size-10 shrink-0 border border-border/60 ring-4 ring-background">
        <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
          {(row.authorName ?? "??").slice(0, 2).toUpperCase()}
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
          <div className="flex items-center gap-1">
            <Badge variant="secondary">{row.tag}</Badge>
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
  // USER_TAGS. Fall back to "maintenance" if the current tag is reserved.
  const initialUserTag: TimelineTag = (
    USER_TAGS as readonly TimelineTag[]
  ).includes(initialTag)
    ? initialTag
    : "maintenance";
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
        <Select
          value={tag}
          onValueChange={(v) => {
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

  const handleDelete = (): void => {
    startTransition(async () => {
      await deleteMachineCommentAction({ id: commentId });
      onOpenChange(false);
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
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
