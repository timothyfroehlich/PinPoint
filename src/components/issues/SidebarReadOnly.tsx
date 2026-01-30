
import type React from "react";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import {
  getIssueStatusIcon,
  getIssueStatusLabel,
} from "~/lib/issues/status";
import {
  getIssueSeverityIcon,
  getIssueSeverityLabel,
} from "~/lib/issues/severity";
import {
  getIssuePriorityIcon,
  getIssuePriorityLabel,
} from "~/lib/issues/priority";
import {
  getIssueFrequencyIcon,
  getIssueFrequencyLabel,
} from "~/lib/issues/frequency";
import { type IssueWithAllRelations } from "~/lib/types";

interface SidebarReadOnlyProps {
  issue: IssueWithAllRelations;
}

export function SidebarReadOnly({
  issue,
}: SidebarReadOnlyProps): React.JSX.Element {
  const StatusIcon = getIssueStatusIcon(issue.status);
  const SeverityIcon = getIssueSeverityIcon(issue.severity);
  const PriorityIcon = getIssuePriorityIcon(issue.priority);
  const FrequencyIcon = getIssueFrequencyIcon(issue.frequency);

  return (
    <div className="space-y-4" data-testid="sidebar-read-only">
      {/* Assignee */}
      <div className="grid grid-cols-[110px,1fr] items-center gap-3">
        <Label className="text-sm text-muted-foreground">Assignee</Label>
        <div className="min-w-0">
          <span className="text-sm font-medium">
            {issue.assignedToUser?.name ?? "Unassigned"}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-[110px,1fr] items-center gap-3">
        <Label className="text-sm text-muted-foreground">Status</Label>
        <div className="min-w-0">
          <Badge variant="outline" className="gap-2">
            <StatusIcon className="size-3.5" />
            {getIssueStatusLabel(issue.status)}
          </Badge>
        </div>
      </div>

      {/* Severity */}
      <div className="grid grid-cols-[110px,1fr] items-center gap-3">
        <Label className="text-sm text-muted-foreground">Severity</Label>
        <div className="min-w-0">
          <Badge variant="outline" className="gap-2">
            <SeverityIcon className="size-3.5" />
            {getIssueSeverityLabel(issue.severity)}
          </Badge>
        </div>
      </div>

      {/* Priority */}
      <div className="grid grid-cols-[110px,1fr] items-center gap-3">
        <Label className="text-sm text-muted-foreground">Priority</Label>
        <div className="min-w-0">
          <Badge variant="outline" className="gap-2">
            <PriorityIcon className="size-3.5" />
            {getIssuePriorityLabel(issue.priority)}
          </Badge>
        </div>
      </div>

      {/* Frequency */}
      <div className="grid grid-cols-[110px,1fr] items-center gap-3">
        <Label className="text-sm text-muted-foreground">Frequency</Label>
        <div className="min-w-0">
          <Badge variant="outline" className="gap-2">
            <FrequencyIcon className="size-3.5" />
            {getIssueFrequencyLabel(issue.frequency)}
          </Badge>
        </div>
      </div>
    </div>
  );
}
