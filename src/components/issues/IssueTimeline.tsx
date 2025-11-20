import React from "react";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Timeline</h2>
          <p className="text-sm text-muted-foreground">
            Latest comments and system updates
          </p>
        </div>
        {/* Original Issue Post */}
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                {issue.reportedByUser?.name ?? "Unknown User"}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(issue.createdAt).toLocaleString()}
              </div>
            </div>
          </CardHeader>
          {issue.description && (
            <CardContent className="pt-4">
              <p className="text-foreground whitespace-pre-wrap">
                {issue.description}
              </p>
            </CardContent>
          )}
        </Card>

        {/* Timeline Events */}
        {issue.comments.map((comment) => (
          <React.Fragment key={comment.id}>
            {comment.isSystem ? (
              <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                <div className="flex flex-col">
                  <span>{comment.content}</span>
                  <span className="text-xs">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <Card className="shadow-sm">
                <CardHeader className="border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">
                      {comment.author?.name ?? "Unknown User"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString()}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </CardContent>
              </Card>
            )}
          </React.Fragment>
        ))}

        {/* Add Comment Form */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Add a comment</CardTitle>
          </CardHeader>
          <CardContent>
            <AddCommentForm issueId={issue.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
