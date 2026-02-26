"use client";

import React, { useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { AddCommentForm } from "~/components/issues/AddCommentForm";
import { OwnerBadge } from "~/components/issues/OwnerBadge";
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
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { SaveCancelButtons } from "~/components/save-cancel-buttons";
import { toast } from "sonner";
import { Textarea } from "~/components/ui/textarea";
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
import { OwnerRequirementsCallout } from "~/components/machines/OwnerRequirementsCallout";

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
  content: string | null;
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
  initialContent: string;
  onCancel: () => void;
}): React.JSX.Element {
  const [state, formAction] = useActionState<
    EditCommentResult | undefined,
    FormData
  >(editCommentAction, undefined);

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
      <Textarea
        name="comment"
        defaultValue={initialContent}
        className="min-h-32"
        aria-label="Edit comment"
        required
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
      className="relative flex gap-4 group"
      data-testid={`timeline-item-${event.id}`}
    >
      {/* Left: Marker (Fixed width track) */}
      <div className="flex w-16 flex-none flex-col items-center">
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
          <div className="flex items-center gap-2 py-1 text-xs leading-snug text-muted-foreground">
            {event.author.id && (
              <span
                className="font-medium text-foreground/80"
                data-testid="system-event-actor"
              >
                {event.author.name}
              </span>
            )}
            <span>{event.content}</span>
            <span className="text-muted-foreground/40">&bull;</span>
            <span
              className="text-[11px] text-muted-foreground/60"
              title={event.createdAt.toLocaleString()}
            >
              {formatDistanceToNow(event.createdAt, { addSuffix: true })}
            </span>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-lg border bg-card p-6 shadow-sm",
              isIssue && "border-primary/30"
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-semibold text-foreground"
                      data-testid="timeline-author-name"
                    >
                      {event.author.name}
                    </span>
                    {isOwner && <OwnerBadge size="sm" />}
                  </div>
                  {isIssue ? (
                    <span className="text-xs uppercase tracking-wide text-primary">
                      Initial report
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {event.type === "comment" ? "commented" : "reported"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span title={event.createdAt.toLocaleString()}>
                  {formatDistanceToNow(event.createdAt, { addSuffix: true })}
                </span>
                {isEdited && !isIssue && (
                  <span title={event.updatedAt.toLocaleString()}>
                    (edited{" "}
                    {formatDistanceToNow(event.updatedAt, { addSuffix: true })})
                  </span>
                )}
                {canShowActions && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="-my-1 -mr-2 ml-1"
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
            </div>
            {isEditing ? (
              <CommentEditForm
                commentId={event.id}
                initialContent={event.content ?? ""}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <>
                {event.content && (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {event.content}
                  </div>
                )}

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
  /** Owner requirements to display after the initial report (authenticated users only) */
  ownerRequirements?: string | undefined;
  /** Machine name for the requirements callout title */
  machineName?: string | undefined;
}

export function IssueTimeline({
  issue,
  currentUserId,
  currentUserRole,
  currentUserInitials,
  ownerRequirements,
  machineName,
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
      images: c.images,
      isSystem: c.isSystem,
    };
  });

  // 3. Combine
  const allEvents = [issueEvent, ...commentEvents];

  // Check if there are no comments (only the initial issue)
  const noComments = allEvents.length === 1;

  return (
    <div className="min-w-0 flex-1 space-y-6">
      <div className="relative">
        {/* Continuous Vertical Line */}
        <div className="absolute bottom-0 left-[34px] top-4 w-px -translate-x-1/2 bg-border" />

        {/* Events List */}
        <div className="relative flex flex-col space-y-6">
          {allEvents.map((event, index) => (
            <React.Fragment key={event.id}>
              <TimelineItem
                event={event}
                issue={issue}
                userContext={userContext}
              />
              {index === 0 && ownerRequirements && machineName && (
                // On mobile, the owner requirements are shown above the fold.
                // On desktop (md:), show them inline in the timeline.
                <div className="ml-20 hidden md:block">
                  <OwnerRequirementsCallout
                    ownerRequirements={ownerRequirements}
                    machineName={machineName}
                  />
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Delightful Empty State when no comments yet */}
          {noComments && (
            <div className="ml-16 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10 p-6 text-center animate-in fade-in zoom-in duration-300">
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

        {/* Add Comment Form */}
        <div
          className="relative mt-8 flex gap-4 pt-2"
          data-testid="issue-comment-form"
        >
          <div className="flex w-16 flex-none flex-col items-center">
            <Avatar className="relative z-10 size-10 border border-border/60 ring-4 ring-background">
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                {currentUserInitials}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
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
    </div>
  );
}
