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

type SectionKey = "assignee" | "status" | "priority" | "severity" | "frequency";

interface SidebarActionsProps {
  issue: IssueWithAllRelations;
  allUsers: { id: string; name: string }[];
  currentUserId: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
  compact?: boolean;
  only?: SectionKey;
  exclude?: SectionKey[];
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

  const gridClass = compact
    ? "space-y-1"
    : "grid grid-cols-[110px_1fr] items-center gap-3";

  const shouldShow = (key: SectionKey): boolean => {
    if (only) return key === only;
    if (exclude?.includes(key)) return false;
    return true;
  };

  const sections: {
    key: SectionKey;
    label: string;
    content: React.ReactNode;
  }[] = [
    {
      key: "assignee",
      label: "Assignee",
      content: (
        <AssignIssueForm
          issueId={issue.id}
          assignedToId={issue.assignedTo ?? null}
          users={allUsers}
          currentUserId={currentUserId}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      content: (
        <UpdateIssueStatusForm
          issueId={issue.id}
          currentStatus={issue.status}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
          compact={compact}
        />
      ),
    },
    {
      key: "priority",
      label: "Priority",
      content: (
        <UpdateIssuePriorityForm
          issueId={issue.id}
          currentPriority={issue.priority}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
          compact={compact}
        />
      ),
    },
    {
      key: "severity",
      label: "Severity",
      content: (
        <UpdateIssueSeverityForm
          issueId={issue.id}
          currentSeverity={issue.severity}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
          compact={compact}
        />
      ),
    },
    {
      key: "frequency",
      label: "Frequency",
      content: (
        <UpdateIssueFrequencyForm
          issueId={issue.id}
          currentFrequency={issue.frequency}
          accessLevel={accessLevel}
          ownershipContext={ownershipContext}
          compact={compact}
        />
      ),
    },
  ];

  const visibleSections = sections.filter((s) => shouldShow(s.key));

  return (
    <div className={cn(rowLayout ? "grid grid-cols-2 gap-3" : "space-y-5")}>
      {visibleSections.map((section) => (
        <div key={section.key} className={gridClass}>
          <Label className={labelClass}>{section.label}</Label>
          <div className="min-w-0">{section.content}</div>
        </div>
      ))}
    </div>
  );
}
