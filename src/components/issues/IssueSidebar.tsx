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
    <div className="w-full shrink-0 lg:w-80">
      <div className="sticky top-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <SidebarActions issue={issue} allUsers={allUsers} />

            {/* Additional Metadata */}
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-[110px,1fr] items-center gap-3">
                <span className="text-sm text-muted-foreground">Reporter</span>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                    {issue.reportedByUser?.name.slice(0, 1).toUpperCase() ??
                      "U"}
                  </div>
                  <span className="max-w-[160px] truncate text-sm text-foreground">
                    {issue.reportedByUser?.name ?? "Unknown user"}
                  </span>
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
