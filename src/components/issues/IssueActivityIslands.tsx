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
import { ACTIVITY_HEADING_ID } from "~/components/issues/activity-ids";

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
 * resulting count is announced politely. With no entries there is nothing to
 * filter, so the toggle is not offered. Entries are an ordered list: the
 * order is the history.
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
        {items.length > 0 ? (
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
        ) : null}
      </div>
      <div role="status" className="sr-only">
        {announcement}
      </div>

      {visible.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {visible.map((item) => (
            <li key={item.id}>{item.node}</li>
          ))}
        </ol>
      ) : null}
      {commentCount === 0 ? empty : null}
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
  onDone,
}: {
  commentId: string;
  initialContent: ProseMirrorDoc;
  /** Saved or canceled: the editor closes. */
  onDone: () => void;
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
      onDone();
    } else if (state?.ok === false) {
      toast.error(state.message);
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="commentId" value={commentId} />
      <RichTextEditor
        content={content}
        onChange={setContent}
        mentionsEnabled={true}
        ariaLabel="Edit comment"
        // Edit was just chosen from the comment's menu.
        // eslint-disable-next-line jsx-a11y/no-autofocus -- focus follows the Edit choice
        autoFocus
        className="min-h-32"
      />
      <input
        type="hidden"
        name="comment"
        value={content ? JSON.stringify(content) : ""}
      />
      <CommentEditFormButtons onCancel={onDone} />
    </form>
  );
}

function DeleteCommentDialog({
  commentId,
  isOpen,
  onOpenChange,
  returnFocusTo,
}: {
  commentId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Where focus goes when the dialog closes without deleting. */
  returnFocusTo: () => HTMLElement | null;
}): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  // Set once the delete succeeds: the comment (and its ⋯ button) is about to
  // become a system event, so focus moves to the Activity heading instead.
  const deletedRef = React.useRef(false);

  const handleDelete = (): void => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("commentId", commentId);
      const result = await deleteCommentAction(undefined, formData);
      if (result.ok) {
        deletedRef.current = true;
        toast.success("Comment deleted");
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent
        // Radix calls this on close and also when the dialog unmounts with
        // its comment, so it covers a delete that re-renders Activity first.
        onCloseAutoFocus={(event) => {
          const target = deletedRef.current
            ? document.getElementById(ACTIVITY_HEADING_ID)
            : returnFocusTo();
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete comment?</AlertDialogTitle>
          <AlertDialogDescription>
            The comment and its photos are removed. Activity records the
            deletion.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} className="max-md:min-h-11">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="max-md:min-h-11"
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
 *
 * Focus never falls to `<body>`: choosing Edit focuses the editor, Save and
 * Cancel return to the ⋯ button, a canceled delete returns to the ⋯ button,
 * and a completed delete moves to the Activity heading.
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
  const articleRef = React.useRef<HTMLElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  // A menu choice moves focus itself (into the editor or the dialog), so the
  // menu must not pull it back to the ⋯ button as it closes. The editor opens
  // only once the menu has let go of focus, so its autofocus sticks.
  const menuChoiceRef = React.useRef<"edit" | "delete" | null>(null);
  // Set when the editor closes while focus is in it (or already lost).
  const restoreFocusRef = React.useRef(false);

  const stopEditing = React.useCallback(() => {
    const active = document.activeElement;
    restoreFocusRef.current =
      active === null ||
      active === document.body ||
      (articleRef.current?.contains(active) ?? false);
    setIsEditing(false);
  }, []);

  React.useEffect(() => {
    if (isEditing || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    // The shorter body replaces the editor; keep the comment in view without
    // jumping the page to put the button at an edge.
    triggerRef.current?.focus({ preventScroll: true });
    articleRef.current?.scrollIntoView({ block: "nearest" });
  }, [isEditing]);

  return (
    <article
      ref={articleRef}
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
                ref={triggerRef}
                variant="ghost"
                size="icon"
                className="-my-2.5 -mr-2.5 size-11 text-muted-foreground md:-my-1.5 md:-mr-1.5 md:size-8"
                aria-label="Comment actions"
                // Which comment, for a screen reader moving by buttons.
                aria-describedby={labelledBy}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(event) => {
                const choice = menuChoiceRef.current;
                if (!choice) return;
                event.preventDefault();
                menuChoiceRef.current = null;
                if (choice === "edit") setIsEditing(true);
              }}
            >
              {canEdit ? (
                <DropdownMenuItem
                  className="max-md:min-h-11"
                  onSelect={() => {
                    menuChoiceRef.current = "edit";
                  }}
                >
                  <Pencil className="mr-2 size-4" aria-hidden="true" />
                  <span>Edit</span>
                </DropdownMenuItem>
              ) : null}
              {canDelete ? (
                <DropdownMenuItem
                  // Red text on the popover (4.8:1); highlighted, the text
                  // turns light on a red tint (16:1), where red text would
                  // fall under 4.5:1.
                  className="text-destructive-text focus:bg-destructive/10 focus:text-foreground max-md:min-h-11"
                  onSelect={() => {
                    menuChoiceRef.current = "delete";
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2
                    className="mr-2 size-4 text-destructive-text"
                    aria-hidden="true"
                  />
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
          onDone={stopEditing}
        />
      ) : (
        children
      )}

      {canDelete ? (
        <DeleteCommentDialog
          commentId={commentId}
          isOpen={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          returnFocusTo={() => triggerRef.current}
        />
      ) : null}
    </article>
  );
}
