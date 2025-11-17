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
    <div className="w-full md:w-1/3 lg:w-1/4">
      <div className="sticky top-8 space-y-6">
        <Card className="border-outline-variant">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <SidebarActions issue={issue} allUsers={allUsers} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
