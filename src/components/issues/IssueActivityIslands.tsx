"use client";

import React, { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteCommentAction,
  editCommentAction,
  type EditCommentResult,
} from "~/app/(app)/issues/actions";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import { SaveCancelButtons } from "~/components/save-cancel-buttons";
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
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { cn } from "~/lib/utils";

/**
 * The interactive parts of Activity (spec issue-detail §7). `IssueActivity`
 * is a Server Component: comment bodies render to sanitized HTML on the
 * server, so neither the rich-text renderer nor the issue's full relations
 * reach the browser. These islands get only what they act on.
 */

// ----------------------------------------------------------------------
// Activity feed: the Comments only toggle and the filtered list
// ----------------------------------------------------------------------

export interface ActivityFeedItem {
  id: string;
  isSystem: boolean;
  /** The row, rendered on the server. */
  node: React.ReactNode;
}

/**
 * The Activity heading row and list. Comments only hides system events
 * (§7.3) — it starts off on every visit and is never remembered — and the
 * resulting count is announced politely.
 */
export function ActivityFeed({
  items,
  heading,
  empty,
}: {
  items: ActivityFeedItem[];
  /** The Activity heading, rendered on the server. */
  heading: React.ReactNode;
  /** Shown after the list while there are no comments. */
  empty: React.ReactNode;
}): React.JSX.Element {
  const [commentsOnly, setCommentsOnly] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");
  const commentCount = items.filter((item) => !item.isSystem).length;
  const visible = commentsOnly ? items.filter((item) => !item.isSystem) : items;

  const toggle = (): void => {
    const next = !commentsOnly;
    setCommentsOnly(next);
    setAnnouncement(
      next
        ? `Showing ${commentCount} ${commentCount === 1 ? "comment" : "comments"}`
        : "Showing all activity"
    );
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {heading}
        <button
          type="button"
          aria-pressed={commentsOnly}
          onClick={toggle}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8",
            commentsOnly
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-outline-variant text-foreground hover:bg-muted/40"
          )}
          data-testid="comments-only-toggle"
        >
          Comments only
        </button>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>

      <div className="flex flex-col gap-3">
        {visible.map((item) => (
          <React.Fragment key={item.id}>{item.node}</React.Fragment>
        ))}
        {commentCount === 0 ? empty : null}
      </div>
    </>
  );
}

// ----------------------------------------------------------------------
// A comment: its actions menu, in-place edit, and delete confirmation
// ----------------------------------------------------------------------

function CommentEditFormButtons({
  onCancel,
}: {
  onCancel: () => void;
}): React.JSX.Element {
  const { pending } = useFormStatus();
  return <SaveCancelButtons isPending={pending} onCancel={onCancel} />;
}

function CommentEditForm({
  commentId,
  initialContent,
  onCancel,
}: {
  commentId: string;
  initialContent: ProseMirrorDoc;
  onCancel: () => void;
}): React.JSX.Element {
  const [state, formAction] = useActionState<
    EditCommentResult | undefined,
    FormData
  >(editCommentAction, undefined);
  const [content, setContent] = React.useState<ProseMirrorDoc | null>(
    initialContent
  );

  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Comment updated");
      onCancel();
    } else if (state?.ok === false) {
      toast.error(state.message);
    }
  }, [state, onCancel]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="commentId" value={commentId} />
      <RichTextEditor
        content={content}
        onChange={setContent}
        mentionsEnabled={true}
        ariaLabel="Edit comment"
        className="min-h-32"
      />
      <input
        type="hidden"
        name="comment"
        value={content ? JSON.stringify(content) : ""}
      />
      <CommentEditFormButtons onCancel={onCancel} />
    </form>
  );
}

function DeleteCommentDialog({
  commentId,
  isOpen,
  onOpenChange,
}: {
  commentId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}): React.JSX.Element {
  const [isPending, startTransition] = useTransition();

  const handleDelete = (): void => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("commentId", commentId);
      const result = await deleteCommentAction(undefined, formData);
      if (result.ok) {
        toast.success("Comment deleted");
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete comment?</AlertDialogTitle>
          <AlertDialogDescription>
            The comment and its photos are removed. Activity records the
            deletion.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              // Stay open until the delete settles; success closes it.
              event.preventDefault();
              handleDelete();
            }}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A comment's `<article>`, named by its author and time. Its header and body
 * are rendered on the server; this island adds the actions menu (§7.9), the
 * in-place editor (§7.10), and the delete confirmation (§7.11).
 */
export function CommentShell({
  commentId,
  labelledBy,
  header,
  canEdit,
  canDelete,
  editContent,
  children,
}: {
  commentId: string;
  /** Ids of the author name and time, which name the article. */
  labelledBy: string;
  header: React.ReactNode;
  canEdit: boolean;
  canDelete: boolean;
  /** The comment's document, sent only when the viewer can edit it. */
  editContent: ProseMirrorDoc | null;
  /** The rendered body and photos. */
  children: React.ReactNode;
}): React.JSX.Element {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const stopEditing = React.useCallback(() => setIsEditing(false), []);

  return (
    <article
      id={`comment-${commentId}`}
      aria-labelledby={labelledBy}
      className="rounded-lg border border-outline-variant bg-card p-3 md:p-4"
      data-testid={`timeline-item-${commentId}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          {header}
        </div>

        {canEdit || canDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-my-2.5 -mr-2.5 size-11 text-muted-foreground md:-my-1.5 md:-mr-1.5 md:size-8"
                aria-label="Comment actions"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit ? (
                <DropdownMenuItem onSelect={() => setIsEditing(true)}>
                  <Pencil className="mr-2 size-4" aria-hidden="true" />
                  <span>Edit</span>
                </DropdownMenuItem>
              ) : null}
              {canDelete ? (
                <DropdownMenuItem
                  className="text-destructive-text focus:bg-destructive/10 focus:text-destructive-text"
                  onSelect={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 size-4" aria-hidden="true" />
                  <span>Delete</span>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {isEditing && canEdit ? (
        <CommentEditForm
          commentId={commentId}
          initialContent={
            editContent ?? { type: "doc", content: [{ type: "paragraph" }] }
          }
          onCancel={stopEditing}
        />
      ) : (
        children
      )}

      {canDelete ? (
        <DeleteCommentDialog
          commentId={commentId}
          isOpen={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        />
      ) : null}
    </article>
  );
}
