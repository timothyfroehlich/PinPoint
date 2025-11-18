import React from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { AddCommentForm } from "~/components/issues/AddCommentForm";
import { type IssueWithAllRelations } from "~/lib/types";

interface IssueTimelineProps {
  issue: IssueWithAllRelations;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const firstPart = parts[0];
    const lastPart = parts[parts.length - 1];
    if (firstPart && lastPart && firstPart[0] && lastPart[0]) {
      return (firstPart[0] + lastPart[0]).toUpperCase();
    }
  }
  const firstChar = trimmed[0];
  return firstChar ? firstChar.toUpperCase() : "?";
}

export function IssueTimeline({
  issue,
}: IssueTimelineProps): React.JSX.Element {
  return (
    <div className="flex-1 max-w-3xl">
      <div className="space-y-4">
        {/* Original Issue Post */}
        <div className="flex gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarFallback className="bg-primary text-on-primary font-semibold">
              {getInitials(issue.reportedByUser?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Card className="border-outline-variant bg-surface shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-on-surface">
                    {issue.reportedByUser?.name ?? "Unknown User"}
                  </div>
                  <div className="text-xs text-on-surface-variant">
                    {new Date(issue.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </CardHeader>
              {issue.description && (
                <CardContent className="pt-0">
                  <p className="text-sm text-on-surface whitespace-pre-wrap">
                    {issue.description}
                  </p>
                </CardContent>
              )}
            </Card>
          </div>
        </div>

        {/* Timeline Events */}
        {issue.comments.map((comment) => (
          <React.Fragment key={comment.id}>
            {comment.isSystem ? (
              <div className="flex gap-3 items-start">
                <div className="size-10 shrink-0 flex items-center justify-center">
                  <div className="size-2 rounded-full bg-outline" />
                </div>
                <div className="flex-1 pt-2">
                  <div className="text-sm text-on-surface-variant">
                    <span>{comment.content}</span>
                    <span className="ml-2 text-xs">
                      {new Date(comment.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Avatar className="size-10 shrink-0">
                  <AvatarFallback className="bg-primary text-on-primary font-semibold">
                    {getInitials(comment.author?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Card className="border-outline-variant bg-surface shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-on-surface">
                          {comment.author?.name ?? "Unknown User"}
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          {new Date(comment.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-on-surface whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Add Comment Form */}
        <div className="flex gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarFallback className="bg-primary text-on-primary font-semibold">
              {getInitials(issue.reportedByUser?.name)}
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
