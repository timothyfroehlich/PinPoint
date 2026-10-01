"use client";

import React, { useTransition } from "react";
import { AddCommentForm } from "~/components/issues/AddCommentForm";
import { ExactRelativeTime } from "~/components/issues/ExactRelativeTime";
import { OwnerBadge } from "~/components/issues/OwnerBadge";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { isUserMachineOwner } from "~/lib/issues/owner";
import { type IssueWithAllRelations } from "~/lib/types";
import { cn } from "~/lib/utils";
import { PersonHoverCard } from "~/components/people/PersonHoverCard";
import { MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ImageGallery } from "~/components/images/ImageGallery";
import { type IssueImage } from "~/server/db/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { formatDateTime } from "~/lib/dates";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { SaveCancelButtons } from "~/components/save-cancel-buttons";
import { toast } from "sonner";
import {
  editCommentAction,
  deleteCommentAction,
  type EditCommentResult,
} from "~/app/(app)/issues/actions";
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
import { type AccessLevel } from "~/lib/permissions/matrix";
import { checkPermission } from "~/lib/permissions/helpers";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  formatTimelineEvent,
  formatTimelineEventAction,
  type TimelineEventData,
} from "~/lib/timeline/types";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

// Note: This is a normalized type for rendering, not a direct DB type.
interface ActivityEntry {
  id: string;
  /** System author rows have no person behind them. */
  author: { id: string | null; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  content: ProseMirrorDoc | null;
  eventData: TimelineEventData | null;
  images: IssueImage[];
  isSystem: boolean;
}

interface UserContext {
  currentUserId: string | null;
  currentUserRole: AccessLevel;
}

// Components
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
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            comment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A system event on one line: who, what changed, when (spec §7.5). Carries the
 * same `comment-<id>` anchor as a comment so a link can scroll to it.
 */
function SystemEventRow({
  entry,
}: {
  entry: ActivityEntry;
}): React.JSX.Element {
  const action = entry.eventData
    ? entry.author
      ? formatTimelineEventAction(entry.eventData)
      : formatTimelineEvent(entry.eventData)
    : null;

  return (
    <div
      id={`comment-${entry.id}`}
      className="flex scroll-mt-24 gap-2 px-1 text-sm text-muted-foreground"
      data-testid={`timeline-item-${entry.id}`}
    >
      <span
        className="mt-[9px] size-1 shrink-0 rounded-full bg-muted-foreground/50"
        aria-hidden="true"
      />
      <div className="min-w-0 leading-relaxed">
        {entry.author ? (
          <>
            <span data-testid="system-event-actor">
              <PersonHoverCard
                userId={entry.author.id}
                displayName={entry.author.name}
                className="font-semibold text-foreground"
              />
            </span>{" "}
          </>
        ) : null}
        <span data-testid="system-event-text">{action}</span>
        <span aria-hidden="true"> · </span>
        <ExactRelativeTime value={entry.createdAt} className="text-sm" />
      </div>
    </div>
  );
}

function CommentCard({
  entry,
  issue,
  userContext,
}: {
  entry: ActivityEntry;
  issue: IssueWithAllRelations;
  userContext: UserContext;
}): React.JSX.Element {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const { currentUserId, currentUserRole } = userContext;
  const authorId = entry.author?.id ?? null;
  const isOwner = isUserMachineOwner(issue, authorId);
  const isEdited = entry.updatedAt.getTime() - entry.createdAt.getTime() > 1000;

  // Edit: only the comment author can edit their own comments
  const canEdit = authorId !== null && currentUserId === authorId;
  // Delete: authors can delete their own comments; admins can delete any.
  const canDelete =
    checkPermission("comments.delete", currentUserRole, {
      userId: currentUserId ?? undefined,
      reporterId: authorId,
    }) || checkPermission("comments.delete.any", currentUserRole);

  return (
    <article
      id={`comment-${entry.id}`}
      className="scroll-mt-24 rounded-lg border border-outline-variant bg-card p-3 md:p-4"
      data-testid={`timeline-item-${entry.id}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span data-testid="timeline-author-name">
            <PersonHoverCard
              userId={authorId}
              displayName={entry.author?.name ?? "System"}
              className="font-semibold text-foreground"
            />
          </span>
          {isOwner && <OwnerBadge size="sm" />}
          <span className="text-muted-foreground/50" aria-hidden="true">
            ·
          </span>
          <ExactRelativeTime value={entry.createdAt} className="text-sm" />
          {isEdited && (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* No `aria-label`: the visible "edited" text names it, which
                    keeps the accessible name a superset of the visible label
                    (WCAG 2.5.3) and avoids a zone-dependent attribute. */}
                <button
                  type="button"
                  className="cursor-help rounded-sm bg-transparent p-0 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  · edited <RelativeTime value={entry.updatedAt} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{formatDateTime(entry.updatedAt)}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-my-2.5 -mr-2.5 size-11 text-muted-foreground md:-my-1.5 md:-mr-1.5 md:size-8"
                aria-label="Comment actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onSelect={() => setIsEditing(true)}>
                  <Pencil className="mr-2 size-4" />
                  <span>Edit</span>
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  className="text-destructive-text focus:bg-destructive/10 focus:text-destructive-text"
                  onSelect={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 size-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isEditing ? (
        <CommentEditForm
          commentId={entry.id}
          initialContent={
            entry.content ?? { type: "doc", content: [{ type: "paragraph" }] }
          }
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          {entry.content && <RichTextDisplay content={entry.content} />}
          {entry.images.length > 0 && (
            <div className="mt-3">
              <ImageGallery images={entry.images} />
            </div>
          )}
        </>
      )}

      <DeleteCommentDialog
        commentId={entry.id}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </article>
  );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

interface IssueActivityProps {
  issue: IssueWithAllRelations;
  currentUserId: string | null;
  currentUserRole: AccessLevel;
}

/**
 * Activity (spec issue-detail §7–§8): comments and system events, oldest
 * first, under an Activity heading with a Comments only toggle. Ends with the
 * inline comment box on desktop, or the log-in prompt for signed-out visitors
 * at every size. Signed-in mobile viewers comment through the floating Comment
 * button instead.
 */
export function IssueActivity({
  issue,
  currentUserId,
  currentUserRole,
}: IssueActivityProps): React.JSX.Element {
  // Starts off on every visit; never remembered (§7.3).
  const [commentsOnly, setCommentsOnly] = React.useState(false);
  const userContext: UserContext = { currentUserId, currentUserRole };

  const entries: ActivityEntry[] = issue.comments.map((c) => ({
    id: c.id,
    author: c.author ? { id: c.author.id, name: c.author.name } : null,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
    content: c.content,
    eventData: c.eventData ?? null,
    images: c.images,
    isSystem: c.isSystem,
  }));
  const visible = commentsOnly
    ? entries.filter((entry) => !entry.isSystem)
    : entries;
  const hasComments = entries.some((entry) => !entry.isSystem);

  return (
    <section
      aria-labelledby="issue-activity-heading"
      className="space-y-3"
      data-testid="issue-timeline"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="issue-activity-heading"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Activity
        </h2>
        <button
          type="button"
          aria-pressed={commentsOnly}
          onClick={() => setCommentsOnly((on) => !on)}
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

      <div className="flex flex-col gap-3">
        {visible.map((entry) =>
          entry.isSystem ? (
            <SystemEventRow key={entry.id} entry={entry} />
          ) : (
            <CommentCard
              key={entry.id}
              entry={entry}
              issue={issue}
              userContext={userContext}
            />
          )
        )}

        {!hasComments && (
          <div
            className="flex items-center gap-3 rounded-lg border border-dashed border-outline-variant px-4 py-3 text-sm text-muted-foreground"
            data-testid="activity-empty"
          >
            <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
            No comments yet
          </div>
        )}
      </div>

      {currentUserRole === "unauthenticated" ? (
        <div
          className="rounded-lg border border-dashed border-outline-variant px-4 py-3 text-sm text-muted-foreground"
          data-testid="login-to-comment"
        >
          Log in to comment
        </div>
      ) : (
        <div
          className="hidden rounded-lg border border-outline-variant bg-card p-4 md:block"
          data-testid="issue-comment-form"
        >
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add a comment
          </h3>
          <AddCommentForm issueId={issue.id} />
        </div>
      )}
    </section>
  );
}
