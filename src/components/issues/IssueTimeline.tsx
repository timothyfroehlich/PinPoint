import React from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { AddCommentForm } from "~/components/issues/AddCommentForm";
import { type IssueWithAllRelations } from "~/lib/types";

interface IssueTimelineProps {
  issue: IssueWithAllRelations;
}

export function IssueTimeline({
  issue,
}: IssueTimelineProps): React.JSX.Element {
  return (
    <div className="flex-1">
      <div className="relative space-y-8 pl-4">
        {/* Vertical Line */}
        <div className="absolute left-[27px] top-2 bottom-0 w-px bg-border" />

        {/* Original Issue Post */}
        <div className="relative flex gap-4">
          <Avatar className="size-10 border border-border z-10">
            <AvatarFallback className="bg-muted text-muted-foreground text-sm">
              {issue.reportedByUser?.name.slice(0, 2).toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {issue.reportedByUser?.name ?? "Unknown User"}
              </span>
              <span
                className="text-sm text-muted-foreground"
                title={new Date(issue.createdAt).toLocaleString()}
              >
                {formatDistanceToNow(new Date(issue.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            {issue.description && (
              <div className="text-foreground whitespace-pre-wrap">
                {issue.description}
              </div>
            )}
          </div>
        </div>

        {/* Timeline Events */}
        {issue.comments.map((comment) => (
          <div key={comment.id} className="relative flex gap-4">
            {comment.isSystem ? (
              <>
                {/* System Event Marker */}
                <div className="absolute left-[15px] top-[10px] z-10 size-2.5 rounded-full bg-border ring-4 ring-background" />
                <div className="flex-1 pl-10 pt-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {comment.content}
                      {comment.author?.name ? ` by ${comment.author.name}` : ""}
                    </span>
                    <span>&bull;</span>
                    <span
                      title={new Date(comment.createdAt).toLocaleString()}
                      className="hover:text-foreground transition-colors cursor-default"
                    >
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Avatar className="size-10 border border-border z-10">
                  <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                    {comment.author?.name.slice(0, 2).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {comment.author?.name ?? "Unknown User"}
                    </span>
                    <span
                      className="text-sm text-muted-foreground"
                      title={new Date(comment.createdAt).toLocaleString()}
                    >
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="text-foreground whitespace-pre-wrap">
                    {comment.content}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Add Comment Form */}
        <div className="relative flex gap-4 pt-4">
          <Avatar className="size-10 border border-border z-10">
            {/* Current user avatar would go here, using fallback for now */}
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              ME
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <AddCommentForm issueId={issue.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
