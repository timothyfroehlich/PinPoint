import React from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { AddCommentForm } from "~/components/issues/AddCommentForm";
import { OwnerBadge } from "~/components/issues/OwnerBadge";
import { isUserMachineOwner } from "~/lib/issues/owner";
import { type IssueWithAllRelations } from "~/lib/types";
import { cn } from "~/lib/utils";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

type TimelineEventType = "issue" | "comment" | "system";

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  author: {
    id?: string | null;
    name: string;
    avatarFallback: string;
    email?: string | null | undefined;
  };
  createdAt: Date;
  content: string | null;
}

// ----------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------

function TimelineItem({
  event,
  issue,
}: {
  event: TimelineEvent;
  issue: IssueWithAllRelations;
}): React.JSX.Element {
  const isSystem = event.type === "system";
  const isIssue = event.type === "issue";
  const isOwner = isUserMachineOwner(issue, event.author.id);

  return (
    <div className="relative flex gap-4">
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
      <div className="flex-1">
        {isSystem ? (
          <div className="flex items-center gap-2 py-1 text-xs leading-snug text-muted-foreground">
            <span
              className="font-medium text-foreground/80"
              data-testid="timeline-system-author"
            >
              {event.author.name}
            </span>
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
                    {event.author.email && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {"<"}
                        {event.author.email}
                        {">"}
                      </span>
                    )}
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
              </div>
            </div>
            {event.content && (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {event.content}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

interface IssueTimelineProps {
  issue: IssueWithAllRelations;
}

export function IssueTimeline({
  issue,
}: IssueTimelineProps): React.JSX.Element {
  // 1. Normalize Issue as the first event
  const reporterName =
    issue.reportedByUser?.name ??
    issue.invitedReporter?.name ??
    issue.reporterName ??
    "Anonymous";
  const reporterEmail =
    issue.reportedByUser?.email ??
    issue.invitedReporter?.email ??
    issue.reporterEmail;
  const reporterId =
    issue.reportedByUser?.id ?? issue.invitedReporter?.id ?? null;

  const issueEvent: TimelineEvent = {
    id: `issue-${issue.id}`,
    type: "issue",
    author: {
      id: reporterId,
      name: reporterName,
      avatarFallback: reporterName.slice(0, 2).toUpperCase(),
      email: reporterEmail,
    },
    createdAt: new Date(issue.createdAt),
    content: issue.description,
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
        email: c.author?.email,
      },
      createdAt: new Date(c.createdAt),
      content: c.content,
    };
  });

  // 3. Combine
  const allEvents = [issueEvent, ...commentEvents];

  return (
    <div className="flex-1 space-y-6">
      <div className="relative">
        {/* Continuous Vertical Line */}
        <div className="absolute bottom-0 left-[34px] top-4 w-px -translate-x-1/2 bg-border" />

        {/* Events List */}
        <div className="relative flex flex-col space-y-6">
          {allEvents.map((event) => (
            <TimelineItem key={event.id} event={event} issue={issue} />
          ))}
        </div>

        {/* Add Comment Form */}
        <div className="relative mt-8 flex gap-4 pt-2">
          <div className="flex w-16 flex-none flex-col items-center">
            <Avatar className="relative z-10 size-10 border border-border/60 ring-4 ring-background">
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                ME
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 rounded-lg border bg-card p-6 shadow-sm">
            <AddCommentForm issueId={issue.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
