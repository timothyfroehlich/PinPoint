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

type SidebarActionSection =
  | "assignee"
  | "status"
  | "priority"
  | "severity"
  | "frequency";

interface SidebarActionsProps {
  issue: IssueWithAllRelations;
  allUsers: { id: string; name: string }[];
  currentUserId: string | null;
  accessLevel: AccessLevel;
  ownershipContext: OwnershipContext;
  compact?: boolean;
  only?: SidebarActionSection;
  exclude?: SidebarActionSection;
  rowLayout?: boolean;
}

const sectionOrder: SidebarActionSection[] = [
  "assignee",
  "status",
  "priority",
  "severity",
  "frequency",
];

export function SidebarActions({
  issue,
  allUsers,
  currentUserId,
  accessLevel,
  ownershipContext,
  compact = false,
  only,
  exclude,
  rowLayout = false,
}: SidebarActionsProps): React.JSX.Element {
  const visibleSections = sectionOrder.filter((section) => {
    if (only) {
      return section === only;
    }
    if (exclude) {
      return section !== exclude;
    }
    return true;
  });

  const labelClassName = compact
    ? "text-[9px] font-bold uppercase tracking-wider text-muted-foreground"
    : "text-sm text-muted-foreground";

  const renderControl = (
    section: SidebarActionSection
  ): React.JSX.Element | null => {
    switch (section) {
      case "assignee":
        return (
          <AssignIssueForm
            issueId={issue.id}
            assignedToId={issue.assignedTo ?? null}
            users={allUsers}
            currentUserId={currentUserId}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
          />
        );
      case "status":
        return (
          <UpdateIssueStatusForm
            issueId={issue.id}
            currentStatus={issue.status}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
            compact={compact}
          />
        );
      case "priority":
        return (
          <UpdateIssuePriorityForm
            issueId={issue.id}
            currentPriority={issue.priority}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
            compact={compact}
          />
        );
      case "severity":
        return (
          <UpdateIssueSeverityForm
            issueId={issue.id}
            currentSeverity={issue.severity}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
            compact={compact}
          />
        );
      case "frequency":
        return (
          <UpdateIssueFrequencyForm
            issueId={issue.id}
            currentFrequency={issue.frequency}
            accessLevel={accessLevel}
            ownershipContext={ownershipContext}
            compact={compact}
          />
        );
    }
  };

  return (
    <div
      className={
        rowLayout
          ? "grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-card p-3 shadow-xs"
          : compact
            ? "space-y-3"
            : "space-y-5"
      }
    >
      {visibleSections.map((section) => {
        const label = section.charAt(0).toUpperCase() + section.slice(1);

        if (rowLayout) {
          return (
            <div key={section} className="space-y-1">
              <Label className={labelClassName}>{label}</Label>
              <div className="min-w-0">{renderControl(section)}</div>
            </div>
          );
        }

        return (
          <div
            key={section}
            className={cn(
              "grid items-center gap-2",
              compact ? "grid-cols-[auto_1fr]" : "grid-cols-[110px_1fr]"
            )}
          >
            <Label className={cn(labelClassName, compact && "min-w-[50px]")}>
              {label}
            </Label>
            <div className="min-w-0">{renderControl(section)}</div>
          </div>
        );
      })}
    </div>
  );
}
