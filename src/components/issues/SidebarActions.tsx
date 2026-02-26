"use client";

import type React from "react";
import { Label } from "~/components/ui/label";
import { type IssueWithAllRelations } from "~/lib/types";
import { AssignIssueForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/assign-issue-form";
import { UpdateIssueStatusForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-status-form";
import { UpdateIssueSeverityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-severity-form";
import { UpdateIssuePriorityForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-priority-form";
import { UpdateIssueFrequencyForm } from "~/app/(app)/m/[initials]/i/[issueNumber]/update-issue-frequency-form";
import { type OwnershipContext } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";

interface SidebarActionsProps {
  issue: IssueWithAllRelations;
  allUsers: { id: string; name: string }[];
  currentUserId: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
}

export function SidebarActions({
  issue,
  allUsers,
  currentUserId,
  accessLevel,
  ownershipContext,
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
            currentUserId={currentUserId}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
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
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
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
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
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
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </div>
      </div>

      {/* Update Frequency */}
      <div className="grid grid-cols-[110px,1fr] items-center gap-3">
        <Label className="text-sm text-muted-foreground">Frequency</Label>
        <div className="min-w-0">
          <UpdateIssueFrequencyForm
            issueId={issue.id}
            currentFrequency={issue.frequency}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        </div>
      </div>
    </div>
  );
}
