import type React from "react";
import { Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { SidebarActions } from "~/components/issues/SidebarActions";
import { WatchButton } from "~/components/issues/WatchButton";
import { OwnerBadge } from "~/components/issues/OwnerBadge";
import { isUserMachineOwner } from "~/lib/issues/owner";
import { type IssueWithAllRelations } from "~/lib/types";

interface SidebarUser {
  id: string;
  name: string;
  email: string | null;
}

interface IssueSidebarProps {
  issue: IssueWithAllRelations;
  allUsers: SidebarUser[];
  currentUserId: string;
}

export function IssueSidebar({
  issue,
  allUsers,
  currentUserId,
}: IssueSidebarProps): React.JSX.Element {
  const isWatching = issue.watchers.some((w) => w.userId === currentUserId);
  return (
    <div className="w-full shrink-0 lg:w-80">
      <div className="sticky top-4 space-y-4">
        <Card data-testid="issue-sidebar">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <SidebarActions issue={issue} allUsers={allUsers} />
              <WatchButton issueId={issue.id} initialIsWatching={isWatching} />
            </div>

            {/* Watchers Count */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="size-4" />
              <span>{issue.watchers.length} watching</span>
            </div>

            {/* Additional Metadata */}
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-[110px,1fr] items-center gap-3">
                <span className="text-sm text-muted-foreground">Reporter</span>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                    {(
                      issue.reportedByUser?.name ??
                      issue.invitedReporter?.name ??
                      issue.reporterName ??
                      "A"
                    )
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {issue.reportedByUser?.name ??
                          issue.invitedReporter?.name ??
                          issue.reporterName ??
                          "Anonymous"}
                      </span>
                      {isUserMachineOwner(
                        issue,
                        issue.reportedByUser?.id ??
                          issue.invitedReporter?.id ??
                          null
                      ) && <OwnerBadge size="sm" />}
                    </div>
                    {(issue.reportedByUser?.email ??
                      issue.invitedReporter?.email ??
                      issue.reporterEmail) && (
                      <span className="truncate text-xs text-muted-foreground">
                        {issue.reportedByUser?.email ??
                          issue.invitedReporter?.email ??
                          issue.reporterEmail}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[110px,1fr] items-center gap-3">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm text-foreground">
                  {new Date(issue.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
