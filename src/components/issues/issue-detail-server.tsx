import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { CalendarIcon, UserIcon, WrenchIcon, MapPinIcon } from "lucide-react";
import { getIssueById } from "~/lib/dal/issues";
import {
  getCommentsForIssue,
  getCommentCountForIssue,
} from "~/lib/dal/comments";
import { getAssignableUsers } from "~/lib/dal/users";
import { getAvailableStatuses } from "~/lib/dal/organizations";
import { formatDistanceToNow, format } from "date-fns";
import { IssueStatusUpdateClient } from "./issue-status-update-client";
import { IssueAssignmentClient } from "./issue-assignment-client";
import { CommentFormClient } from "./comment-form-client";
import { RealtimeCommentsClient } from "./realtime-comments-client";

interface IssueDetailServerProps {
  issueId: string;
  organizationId: string;
  userId: string;
}

export async function IssueDetailServer({
  issueId,
  organizationId,
  userId,
}: IssueDetailServerProps): Promise<JSX.Element> {
  const [issue, comments, commentCount, assignableUsers, availableStatuses] =
    await Promise.all([
      getIssueById(issueId, organizationId),
      getCommentsForIssue(issueId, organizationId),
      getCommentCountForIssue(issueId, organizationId),
      getAssignableUsers(organizationId),
      getAvailableStatuses(organizationId),
    ]);

  // Dynamic status colors based on status category
  const getStatusColorClass = (category?: string): string => {
    switch (category) {
      case "NEW":
        return "bg-error-container text-on-error-container border-error";
      case "IN_PROGRESS":
        return "bg-primary-container text-on-primary-container border-primary";
      case "RESOLVED":
        return "bg-tertiary-container text-on-tertiary-container border-tertiary";
      default:
        return "bg-surface-container-low text-on-surface border-outline-variant";
    }
  };

  const statusColor = getStatusColorClass(issue.status.category);

  return (
    <div className="space-y-6">
      {/* Issue Header */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-3xl font-bold" data-testid="issue-title">
            {issue.title}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            <span>Issue #{issue.id.slice(0, 8)}</span>
            <span>•</span>
            <span>
              Created {formatDistanceToNow(new Date(issue.created_at))} ago
            </span>
            <span>•</span>
            <span>by {issue.createdBy?.name ?? "Unknown"}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Badge
            variant="outline"
            className={statusColor}
            data-testid="issue-status-badge"
          >
            {issue.status.name}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Issue Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Issue Description */}
          {issue.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{issue.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Comments</span>
                <Badge variant="secondary" className="text-xs">
                  {commentCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Server-rendered comments */}
              {comments.length > 0 ? (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="flex gap-3 p-4 rounded-lg border bg-card/50"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback>
                          {comment.author?.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("") ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {comment.author?.name ?? "Unknown User"}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(comment.created_at))}{" "}
                            ago
                          </span>
                          {new Date(comment.updated_at).getTime() !==
                            new Date(comment.created_at).getTime() && (
                            <Badge variant="outline" className="text-xs">
                              edited
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No comments yet. Be the first to add a comment.
                </p>
              )}

              {/* Real-time comments from other users - Client Island */}
              <RealtimeCommentsClient
                issueId={issue.id}
                currentUserId={userId}
                existingCommentIds={comments.map((c) => c.id)}
              />

              {/* Comment Form - Client Island */}
              <div className="mt-6 pt-4 border-t">
                <CommentFormClient issueId={issue.id} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Issue Sidebar */}
        <div className="space-y-4">
          {/* Machine Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WrenchIcon className="h-5 w-5" />
                Machine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="font-medium">{issue.machine.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {issue.machine.model.name}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPinIcon className="h-4 w-4" />
                  <span>{issue.machine.location.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assignment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {issue.assignedTo ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {(issue.assignedTo.name ?? issue.assignedTo.email ?? "U")
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {issue.assignedTo.name ?? issue.assignedTo.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {issue.assignedTo.email}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Unassigned</p>
              )}

              {/* Assignment Update - Client Island */}
              <div className="mt-4">
                <IssueAssignmentClient
                  issueId={issue.id}
                  availableUsers={[
                    { id: "unassigned", name: "Unassigned", email: "" },
                    ...assignableUsers.map((user) => ({
                      id: user.id,
                      name: user.name ?? user.email ?? "Unknown",
                      email: user.email ?? "",
                    })),
                  ]}
                  {...(issue.assignedTo && {
                    currentAssigneeId: issue.assignedTo.id,
                    ...(issue.assignedTo.name && {
                      currentAssigneeName: issue.assignedTo.name,
                    }),
                  })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Status Update */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Current Status:</span>
                  <Badge variant="outline" className={statusColor}>
                    {issue.status.name}
                  </Badge>
                </div>

                {/* Status Update - Client Island */}
                <IssueStatusUpdateClient
                  issueId={issue.id}
                  currentStatusId={issue.status.id}
                  currentStatusName={issue.status.name}
                  availableStatuses={availableStatuses}
                />
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>
                  {format(
                    new Date(issue.created_at),
                    "MMM d, yyyy 'at' h:mm a",
                  )}
                </span>
              </div>
              {new Date(issue.updated_at).getTime() !==
                new Date(issue.created_at).getTime() && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated:</span>
                  <span>
                    {format(
                      new Date(issue.updated_at),
                      "MMM d, yyyy 'at' h:mm a",
                    )}
                  </span>
                </div>
              )}
              {issue.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved:</span>
                  <span>
                    {format(
                      new Date(issue.resolved_at),
                      "MMM d, yyyy 'at' h:mm a",
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
