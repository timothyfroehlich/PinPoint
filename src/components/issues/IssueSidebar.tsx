import type React from "react";
import { ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
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

export function IssueSidebar({
  issue,
  allUsers,
}: IssueSidebarProps): React.JSX.Element {
  return (
    <div className="w-full lg:w-80 xl:w-96 shrink-0">
      <div className="sticky top-8">
        <Card className="border-outline-variant bg-surface">
          <CardHeader className="border-b border-outline-variant">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Details</CardTitle>
              <ChevronUp className="size-4 text-on-surface-variant" />
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Reporter */}
            <div>
              <div className="text-xs font-semibold text-on-surface-variant mb-2">
                Reporter
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarFallback className="bg-primary text-on-primary text-xs font-semibold">
                    {getInitials(issue.reportedByUser?.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-on-surface">
                  {issue.reportedByUser?.name ?? "Unknown user"}
                </span>
              </div>
            </div>

            {/* Assignee */}
            <div>
              <SidebarActions issue={issue} allUsers={allUsers} />
            </div>

            {/* Machine */}
            <div>
              <div className="text-xs font-semibold text-on-surface-variant mb-2">
                Machine
              </div>
              <div className="text-sm text-on-surface">
                {issue.machine.name}
              </div>
            </div>

            {/* Created */}
            <div>
              <div className="text-xs font-semibold text-on-surface-variant mb-2">
                Created
              </div>
              <div className="text-sm text-on-surface">
                {new Date(issue.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>

            {/* Updated (Created again as shown in mockup) */}
            <div>
              <div className="text-xs font-semibold text-on-surface-variant mb-2">
                Created
              </div>
              <div className="text-sm text-on-surface">
                {new Date(issue.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
