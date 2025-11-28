"use client";

import type React from "react";
import { Label } from "~/components/ui/label";
import { type IssueWithAllRelations } from "~/lib/types";
import { AssignIssueForm } from "~/app/(app)/issues/[issueId]/assign-issue-form";
import { UpdateIssueStatusForm } from "~/app/(app)/issues/[issueId]/update-issue-status-form";
import { UpdateIssueSeverityForm } from "~/app/(app)/issues/[issueId]/update-issue-severity-form";
import { UpdateIssuePriorityForm } from "~/app/(app)/issues/[issueId]/update-issue-priority-form";

interface SidebarActionsProps {
  issue: IssueWithAllRelations;
  allUsers: { id: string; name: string; email: string | null }[];
}

export function SidebarActions({
  issue,
  allUsers,
}: SidebarActionsProps): React.JSX.Element {
  return (
    <div className="space-y-5">
      {/* Assignee */}
      <div className="grid grid-cols-[110px,1fr] items-center gap-3">
        <Label className="text-sm text-muted-foreground">Assignee</Label>
        <div className="min-w-0">
          <AssignIssueForm
            issueId={issue.id}
            assignedToId={issue.assignedTo ?? null}
            users={allUsers}
          />
        </div>
      </div>

      {/* Update Status */}
      <div className="grid grid-cols-[110px,1fr] items-center gap-3">
        <Label className="text-sm text-muted-foreground">Status</Label>
        <div className="min-w-0">
          <UpdateIssueStatusForm
            issueId={issue.id}
            currentStatus={issue.status}
          />
        </div>
      </div>

      {/* Update Severity */}
      <div className="grid grid-cols-[110px,1fr] items-center gap-3">
        <Label className="text-sm text-muted-foreground">Severity</Label>
        <div className="min-w-0">
          <UpdateIssueSeverityForm
            issueId={issue.id}
            currentSeverity={issue.severity}
          />
        </div>
      </div>

      {/* Update Priority */}
      <div className="grid grid-cols-[110px,1fr] items-center gap-3">
        <Label className="text-sm text-muted-foreground">Priority</Label>
        <div className="min-w-0">
          <UpdateIssuePriorityForm
            issueId={issue.id}
            currentPriority={issue.priority}
          />
        </div>
      </div>
    </div>
  );
}
