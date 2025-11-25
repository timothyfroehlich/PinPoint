import type React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { SidebarActions } from "~/components/issues/SidebarActions";
import { type IssueWithAllRelations } from "~/lib/types";

interface SidebarUser {
  id: string;
  name: string;
  email: string | null;
}

interface IssueSidebarProps {
  issue: IssueWithAllRelations;
  allUsers: SidebarUser[];
}

export function IssueSidebar({
  issue,
  allUsers,
}: IssueSidebarProps): React.JSX.Element {
  return (
    <div className="w-full md:w-80 shrink-0">
      <div className="sticky top-8 space-y-6">
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-semibold text-foreground">
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            <SidebarActions issue={issue} allUsers={allUsers} />

            {/* Additional Metadata */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">
                Reporter
              </div>
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  {issue.reportedByUser?.name.slice(0, 1).toUpperCase() ?? "U"}
                </div>
                <span className="text-sm text-muted-foreground">
                  {issue.reportedByUser?.name ?? "Unknown user"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">Created</div>
              <div className="text-sm text-muted-foreground">
                {new Date(issue.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
