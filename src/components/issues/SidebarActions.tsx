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
import { cn } from "~/lib/utils";

interface SidebarActionsProps {
  issue: IssueWithAllRelations;
  allUsers: { id: string; name: string }[];
  currentUserId: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
  compact?: boolean;
  only?: "assignee" | "status" | "severity" | "priority" | "frequency";
  exclude?: "assignee" | "status" | "severity" | "priority" | "frequency";
  rowLayout?: boolean;
}

export function SidebarActions({
  issue,
  allUsers,
  currentUserId,
  accessLevel,
  ownershipContext,
  compact,
  only,
  exclude,
  rowLayout,
}: SidebarActionsProps): React.JSX.Element {
  const labelClass = compact
    ? "text-[10px] uppercase tracking-wider text-muted-foreground font-bold"
    : "text-sm text-muted-foreground";

  const itemClass = rowLayout
    ? "flex flex-col gap-1.5"
    : "grid grid-cols-[110px_1fr] items-center gap-3";

  return (
    <div
      className={cn(
        "space-y-5",
        rowLayout && "grid grid-cols-2 gap-x-4 gap-y-5 space-y-0"
      )}
      data-testid={rowLayout ? "issue-badge-strip" : undefined}
    >
      {/* Assignee */}
      {(!only || only === "assignee") && exclude !== "assignee" && (
        <div className={itemClass}>
          <Label className={labelClass}>Assignee</Label>
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
      )}

      {/* Update Status */}
      {(!only || only === "status") && exclude !== "status" && (
        <div className={itemClass}>
          <Label className={labelClass}>Status</Label>
          <div className="min-w-0">
            <UpdateIssueStatusForm
              issueId={issue.id}
              currentStatus={issue.status}
              accessLevel={accessLevel}
              ownershipContext={ownershipContext}
              {...(compact ? { compact: true } : {})}
            />
          </div>
        </div>
      )}

      {/* Update Priority */}
      {(!only || only === "priority") && exclude !== "priority" && (
        <div className={itemClass}>
          <Label className={labelClass}>Priority</Label>
          <div className="min-w-0">
            <UpdateIssuePriorityForm
              issueId={issue.id}
              currentPriority={issue.priority}
              accessLevel={accessLevel}
              ownershipContext={ownershipContext}
              {...(compact ? { compact: true } : {})}
            />
          </div>
        </div>
      )}

      {/* Update Severity */}
      {(!only || only === "severity") && exclude !== "severity" && (
        <div className={itemClass}>
          <Label className={labelClass}>Severity</Label>
          <div className="min-w-0">
            <UpdateIssueSeverityForm
              issueId={issue.id}
              currentSeverity={issue.severity}
              accessLevel={accessLevel}
              ownershipContext={ownershipContext}
              {...(compact ? { compact: true } : {})}
            />
          </div>
        </div>
      )}

      {/* Update Frequency */}
      {(!only || only === "frequency") && exclude !== "frequency" && (
        <div className={itemClass}>
          <Label className={labelClass}>Frequency</Label>
          <div className="min-w-0">
            <UpdateIssueFrequencyForm
              issueId={issue.id}
              currentFrequency={issue.frequency}
              accessLevel={accessLevel}
              ownershipContext={ownershipContext}
              {...(compact ? { compact: true } : {})}
            />
          </div>
        </div>
      )}
    </div>
  );
}
