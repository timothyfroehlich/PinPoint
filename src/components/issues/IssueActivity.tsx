import type React from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { AddCommentForm } from "~/components/issues/AddCommentForm";
import { ExactRelativeTime } from "~/components/issues/ExactRelativeTime";
import {
  ActivityFeed,
  CommentShell,
  type ActivityFeedItem,
} from "~/components/issues/IssueActivityIslands";
import { OwnerBadge } from "~/components/issues/OwnerBadge";
import { ACTIVITY_HEADING_ID } from "~/components/issues/activity-ids";
import { RichTextDisplay } from "~/components/editor/RichTextDisplay";
import { ImageGallery } from "~/components/images/ImageGallery";
import { PersonHoverCard } from "~/components/people/PersonHoverCard";
import { EmptyState } from "~/components/ui/empty-state";
import { formatDateTime } from "~/lib/dates";
import { isUserMachineOwner } from "~/lib/issues/owner";
import { getLoginUrl } from "~/lib/login-url";
import { checkPermission } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import {
  formatTimelineEvent,
  formatTimelineEventAction,
} from "~/lib/timeline/types";
import { type IssueWithAllRelations } from "~/lib/types";

type ActivityComment = IssueWithAllRelations["comments"][number];

/** Whether a comment was edited after it was posted. */
function wasEdited(comment: ActivityComment): boolean {
  return (
    new Date(comment.updatedAt).getTime() -
      new Date(comment.createdAt).getTime() >
    1000
  );
}

/**
 * A system event on one line: who, what changed, when (spec §7.5). Carries the
 * same `comment-<id>` anchor as a comment so a link can scroll to it.
 */
function SystemEventRow({
  entry,
}: {
  entry: ActivityComment;
}): React.JSX.Element {
  const action = entry.eventData
    ? entry.author
      ? formatTimelineEventAction(entry.eventData)
      : formatTimelineEvent(entry.eventData)
    : null;
  // A deleted comment keeps its original row, so its own time is when it was
  // posted; the event happened when the row last changed.
  const when =
    entry.eventData?.type === "comment_deleted"
      ? entry.updatedAt
      : entry.createdAt;

  return (
    <div
      id={`comment-${entry.id}`}
      className="flex gap-2 px-1 text-sm leading-relaxed text-muted-foreground"
      data-testid={`timeline-item-${entry.id}`}
    >
      {/* One line-height tall, so the dot centers on the first line. */}
      <span className="flex h-lh shrink-0 items-center" aria-hidden="true">
        <span className="size-1 rounded-full bg-muted-foreground/50" />
      </span>
      <div className="min-w-0">
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
        <span data-testid="system-event-text">{action}</span>{" "}
        <span className="whitespace-nowrap">
          <span aria-hidden="true">· </span>
          <ExactRelativeTime
            value={when}
            fallback={formatDateTime(when)}
            className="text-sm"
          />
        </span>
      </div>
    </div>
  );
}

function CommentCard({
  entry,
  issue,
  currentUserId,
  currentUserRole,
}: {
  entry: ActivityComment;
  issue: IssueWithAllRelations;
  currentUserId: string | null;
  currentUserRole: AccessLevel;
}): React.JSX.Element {
  const authorId = entry.author?.id ?? null;
  const authorNameId = `comment-${entry.id}-author`;
  const timeId = `comment-${entry.id}-time`;

  // Edit: only the comment author can edit their own comments (§3.5).
  const canEdit = authorId !== null && currentUserId === authorId;
  // Delete: authors can delete their own comments; admins can delete any.
  const canDelete =
    checkPermission("comments.delete", currentUserRole, {
      userId: currentUserId ?? undefined,
      reporterId: authorId,
    }) || checkPermission("comments.delete.any", currentUserRole);

  const header = (
    <>
      <span id={authorNameId} data-testid="timeline-author-name">
        <PersonHoverCard
          userId={authorId}
          displayName={entry.author?.name ?? "System"}
          className="font-semibold text-foreground"
        />
      </span>
      {isUserMachineOwner(issue, authorId) && <OwnerBadge size="sm" />}
      {/* The separator travels with the time so it never ends a line. */}
      <span id={timeId} className="inline-flex items-center gap-2">
        <span className="text-muted-foreground/50" aria-hidden="true">
          ·
        </span>
        <ExactRelativeTime
          value={entry.createdAt}
          fallback={formatDateTime(entry.createdAt)}
          className="text-sm"
        />
      </span>
      {wasEdited(entry) ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-muted-foreground/50" aria-hidden="true">
            ·
          </span>
          <ExactRelativeTime
            value={entry.updatedAt}
            fallback={formatDateTime(entry.updatedAt)}
            prefix="edited"
            className="text-sm"
          />
        </span>
      ) : null}
    </>
  );

  return (
    <CommentShell
      commentId={entry.id}
      labelledBy={`${authorNameId} ${timeId}`}
      header={header}
      canEdit={canEdit}
      canDelete={canDelete}
      editContent={canEdit ? entry.content : null}
    >
      {entry.content ? <RichTextDisplay content={entry.content} /> : null}
      {entry.images.length > 0 ? (
        <div className="mt-3">
          <ImageGallery images={entry.images} />
        </div>
      ) : null}
    </CommentShell>
  );
}

interface IssueActivityProps {
  issue: IssueWithAllRelations;
  currentUserId: string | null;
  currentUserRole: AccessLevel;
}

/**
 * Activity (spec issue-detail §7–§8): comments and system events, oldest
 * first, under an Activity heading with a Comments only toggle. Ends with the
 * inline comment box on desktop, or the log-in link for signed-out visitors
 * at every size. Signed-in mobile viewers comment through the floating Comment
 * button instead.
 *
 * A Server Component: bodies render to sanitized HTML here, and only the
 * interactive islands (`IssueActivityIslands`) ship to the browser.
 */
export function IssueActivity({
  issue,
  currentUserId,
  currentUserRole,
}: IssueActivityProps): React.JSX.Element {
  const items: ActivityFeedItem[] = issue.comments.map((entry) => ({
    id: entry.id,
    isSystem: entry.isSystem,
    node: entry.isSystem ? (
      <SystemEventRow entry={entry} />
    ) : (
      <CommentCard
        entry={entry}
        issue={issue}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />
    ),
  }));
  const issuePath = `/m/${issue.machineInitials}/i/${issue.issueNumber}`;

  return (
    <section
      aria-labelledby={ACTIVITY_HEADING_ID}
      className="space-y-3"
      data-testid="issue-timeline"
    >
      <ActivityFeed
        items={items}
        heading={
          <h2
            id={ACTIVITY_HEADING_ID}
            // Focus lands here after a comment is deleted.
            tabIndex={-1}
            className="rounded-sm text-xs font-semibold uppercase tracking-wider text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Activity
          </h2>
        }
        empty={
          <div data-testid="activity-empty">
            <EmptyState
              icon={MessageSquare}
              title="No comments yet"
              description="Be the first to comment."
              size="compact"
            />
          </div>
        }
      />

      {currentUserRole === "unauthenticated" ? (
        <div
          className="rounded-lg border border-dashed border-outline-variant px-4 py-1 text-sm md:py-3"
          data-testid="login-to-comment"
        >
          <Link
            href={getLoginUrl(issuePath)}
            className="inline-flex min-h-11 items-center font-semibold text-primary transition-colors duration-150 hover:text-primary/80 md:min-h-0"
          >
            Log in to comment
          </Link>
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
