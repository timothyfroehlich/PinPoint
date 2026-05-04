"use client";

import React, { useTransition } from "react";
import { formatDateTime } from "~/lib/dates";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { AddCommentForm } from "~/components/issues/AddCommentForm";
import { OwnerBadge } from "~/components/issues/OwnerBadge";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { isUserMachineOwner } from "~/lib/issues/owner";
import { type IssueWithAllRelations } from "~/lib/types";
import { cn } from "~/lib/utils";
import { resolveIssueReporter } from "~/lib/issues/utils";
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
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  formatTimelineEvent,
  type TimelineEventData,
} from "~/lib/timeline/types";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

type TimelineEventType = "issue" | "comment" | "system";

// Note: This is a normalized type for rendering, not a direct DB type.
interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  author: {
    id?: string | null;
    name: string;
    avatarFallback: string;
  };
  createdAt: Date;
  updatedAt: Date;
  content: ProseMirrorDoc | null;
  eventData?: TimelineEventData | null;
  images?: IssueImage[];
  isSystem: boolean;
}

interface UserContext {
  currentUserId: string | null;
  currentUserRole: AccessLevel;
  currentUserInitials: string;
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

function TimelineItem({
  event,
  issue,
  userContext,
}: {
  event: TimelineEvent;
  issue: IssueWithAllRelations;
  userContext: UserContext;
}): React.JSX.Element {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const { currentUserId, currentUserRole } = userContext;

  const isSystem = event.type === "system";
  const isIssue = event.type === "issue";
  const isOwner = isUserMachineOwner(issue, event.author.id);
  const isEdited = event.updatedAt.getTime() - event.createdAt.getTime() > 1000;

  // --- Permissions ---
  // Edit: only the comment author can edit their own comments
  const canEdit =
    currentUserId === event.author.id && !event.isSystem && !isIssue;
  // Delete: author can delete own comments, admins can delete any comment
  const canDelete =
    (currentUserId === event.author.id || currentUserRole === "admin") &&
    !event.isSystem &&
    !isIssue;

  const canShowActions = canEdit || canDelete;

  return (
    <div
      className="group relative flex gap-3 @xl:gap-4"
      data-testid={`timeline-item-${event.id}`}
    >
      {/* Left: Marker (Fixed width track) */}
      <div className="hidden w-16 flex-none flex-col items-center @xl:flex">
        {isSystem ? (
          <div className="relative z-10 flex size-10 items-center justify-center">
            <div className="size-2.5 rounded-full bg-border ring-4 ring-background" />
          </div>
        ) : (
          <Avatar className="relative z-10 size-10 border border-border/60 ring-4 ring-background">
            <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
              {event.author.avatarFallback}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Right: Content */}
      <div className="min-w-0 flex-1">
        {isSystem ? (
          <div className="flex flex-col gap-0.5 py-1 pl-4 text-xs text-muted-foreground @lg:pl-6">
            <div className="flex items-center gap-1.5">
              {event.author.id && (
                <span
                  className="font-semibold text-foreground/90"
                  data-testid="system-event-actor"
                >
                  {event.author.name}
                </span>
              )}
              {event.author.id && (
                <span className="text-muted-foreground/30">&bull;</span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="text-[11px] text-muted-foreground/60"
                  >
                    <RelativeTime value={event.createdAt} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {formatDateTime(event.createdAt)}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="leading-relaxed text-foreground/80">
              {event.eventData ? formatTimelineEvent(event.eventData) : null}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-lg border bg-card p-4 shadow-sm @lg:p-6",
              isIssue && "border-primary/30"
            )}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="font-semibold text-foreground"
                    data-testid="timeline-author-name"
                  >
                    {event.author.name}
                  </span>
                  {isOwner && <OwnerBadge size="sm" />}
                  {isIssue && (
                    <span className="text-xs uppercase tracking-wide text-primary">
                      Initial report
                    </span>
                  )}
                  <span className="text-muted-foreground/40">&bull;</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        className="text-xs text-muted-foreground/60"
                      >
                        <RelativeTime value={event.createdAt} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {formatDateTime(event.createdAt)}
                    </TooltipContent>
                  </Tooltip>
                  {isEdited && !isIssue && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          className="text-xs text-muted-foreground/40"
                        >
                          &bull; edited <RelativeTime value={event.updatedAt} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatDateTime(event.updatedAt)}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {canShowActions && (
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
                    {canEdit && (
                      <DropdownMenuItem onSelect={() => setIsEditing(true)}>
                        <Pencil className="mr-2 size-4" />
                        <span>Edit</span>
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
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
                commentId={event.id}
                initialContent={
                  event.content ?? {
                    type: "doc",
                    content: [{ type: "paragraph" }],
                  }
                }
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <>
                {event.content && <RichTextDisplay content={event.content} />}

                {event.images && event.images.length > 0 && (
                  <div className="mt-4">
                    <ImageGallery images={event.images} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <DeleteCommentDialog
        commentId={event.id}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

interface IssueTimelineProps {
  issue: IssueWithAllRelations;
  currentUserId: string | null;
  currentUserRole: AccessLevel;
  currentUserInitials: string;
}

export function IssueTimeline({
  issue,
  currentUserId,
  currentUserRole,
  currentUserInitials,
}: IssueTimelineProps): React.JSX.Element {
  const userContext: UserContext = {
    currentUserId,
    currentUserRole,
    currentUserInitials,
  };

  // 1. Normalize Issue as the first event
  const reporter = resolveIssueReporter(issue);

  const issueEvent: TimelineEvent = {
    id: `issue-${issue.id}`,
    type: "issue",
    author: {
      id: reporter.id ?? null,
      name: reporter.name,
      avatarFallback: reporter.initial,
    },
    createdAt: new Date(issue.createdAt),
    updatedAt: new Date(issue.updatedAt),
    content: issue.description,
    images: issue.images,
    isSystem: false,
  };

  // 2. Normalize Comments
  const commentEvents: TimelineEvent[] = issue.comments.map((c) => {
    const authorName = c.author?.name ?? "System";
    return {
      id: c.id,
      type: c.isSystem ? "system" : "comment",
      author: {
        id: c.author?.id ?? null,
        name: authorName,
        avatarFallback: authorName.slice(0, 2).toUpperCase(),
      },
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      content: c.content,
      eventData: c.eventData,
      images: c.images,
      isSystem: c.isSystem,
    };
  });

  // 3. Combine
  const allEvents = [issueEvent, ...commentEvents];

  // Check if there are no comments (only the initial issue)
  const noComments = allEvents.length === 1;

  return (
    <div className="flex-1 space-y-6" data-testid="issue-timeline">
      <div className="relative">
        {/* Continuous Vertical Line */}
        <div className="absolute bottom-0 left-[34px] top-4 hidden w-px -translate-x-1/2 bg-border @xl:block" />

        {/* Events List */}
        <div className="relative flex flex-col space-y-4 @xl:space-y-6">
          {allEvents.map((event) => (
            <TimelineItem
              key={event.id}
              event={event}
              issue={issue}
              userContext={userContext}
            />
          ))}

          {/* Delightful Empty State when no comments yet */}
          {noComments && (
            <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10 p-6 text-center animate-in fade-in zoom-in duration-300 @xl:ml-20">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No comments yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Start the conversation by adding a comment below.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Comment Form — hidden below md: when authenticated because
          StickyCommentComposer is the canonical mobile composer. The
          unauthenticated "Log in to comment" placeholder stays visible at all
          viewports since there is no sticky composer for guests. */}
      <div
        className={cn(
          "relative flex gap-4 pt-2",
          currentUserRole !== "unauthenticated" && "hidden md:flex"
        )}
        data-testid="issue-comment-form"
      >
        <div className="hidden w-16 flex-none flex-col items-center @xl:flex">
          <Avatar className="relative z-10 size-10 border border-border/60 ring-4 ring-background">
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {currentUserInitials}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 rounded-lg border bg-card p-4 shadow-sm @lg:p-6">
          {currentUserRole === "unauthenticated" ? (
            <div
              className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
              data-testid="login-to-comment"
            >
              Log in to comment
            </div>
          ) : (
            <AddCommentForm issueId={issue.id} />
          )}
        </div>
      </div>
    </div>
  );
}
