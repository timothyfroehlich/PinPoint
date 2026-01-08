"use client";

import type React from "react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { Issue } from "~/lib/types";
import {
  getIssueStatusIcon,
  getIssueStatusLabel,
  getIssueSeverityLabel,
  getIssuePriorityLabel,
  getIssueConsistencyLabel,
  STATUS_STYLES,
  SEVERITY_STYLES,
  PRIORITY_STYLES,
  CONSISTENCY_STYLES,
  ISSUE_FIELD_ICONS,
} from "~/lib/issues/status";

interface IssueBadgeGridProps {
  issue: Pick<Issue, "status" | "severity" | "priority" | "consistency">;
  variant?: "mini" | "half" | "normal" | "strip";
  className?: string;
  showPriority?: boolean; // Default true, but maybe hide for guests externally
}

export function IssueBadgeGrid({
  issue,
  variant = "normal",
  className,
  showPriority = true,
}: IssueBadgeGridProps): React.JSX.Element {
  const StatusIcon = getIssueStatusIcon(issue.status);
  const SeverityIcon = ISSUE_FIELD_ICONS.severity;
  const PriorityIcon = ISSUE_FIELD_ICONS.priority;
  const ConsistencyIcon = ISSUE_FIELD_ICONS.consistency;

  if (variant === "mini") {
    return (
      <Badge
        className={cn(
          "px-1.5 py-0 text-[10px] h-4 border font-medium truncate",
          STATUS_STYLES[issue.status],
          className
        )}
      >
        {getIssueStatusLabel(issue.status)}
      </Badge>
    );
  }

  const gridClass = cn(
    variant === "strip" ? "flex flex-wrap gap-2" : "grid grid-cols-2 gap-1.5",
    variant === "half" && "gap-1",
    className
  );

  const badgeSizeClass = cn(
    "flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium border",
    variant === "half" ? "min-w-[85px]" : "min-w-[105px]",
    variant === "strip" && "min-w-0"
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className={gridClass} role="group" aria-label="Issue metadata">
        {/* Status */}
        <TooltipItem label="Status" value={getIssueStatusLabel(issue.status)}>
          <Badge
            data-testid="issue-status-badge"
            className={cn(badgeSizeClass, STATUS_STYLES[issue.status])}
            aria-label={`Status: ${getIssueStatusLabel(issue.status)}`}
          >
            <StatusIcon className="size-3 shrink-0" />
            <span className="truncate">
              {getIssueStatusLabel(issue.status)}
            </span>
          </Badge>
        </TooltipItem>

        {/* Severity */}
        <TooltipItem
          label="Severity"
          value={getIssueSeverityLabel(issue.severity)}
        >
          <Badge
            data-testid="issue-severity-badge"
            className={cn(badgeSizeClass, SEVERITY_STYLES[issue.severity])}
            aria-label={`Severity: ${getIssueSeverityLabel(issue.severity)}`}
          >
            <SeverityIcon className="size-3 shrink-0" />
            <span className="capitalize truncate">{issue.severity}</span>
          </Badge>
        </TooltipItem>

        {/* Priority */}
        {showPriority && (
          <TooltipItem
            label="Priority"
            value={getIssuePriorityLabel(issue.priority)}
          >
            <Badge
              data-testid="issue-priority-badge"
              className={cn(badgeSizeClass, PRIORITY_STYLES[issue.priority])}
              aria-label={`Priority: ${getIssuePriorityLabel(issue.priority)}`}
            >
              <PriorityIcon className="size-3 shrink-0" />
              <span className="capitalize truncate">{issue.priority}</span>
            </Badge>
          </TooltipItem>
        )}

        {/* Consistency */}
        <TooltipItem
          label="Consistency"
          value={getIssueConsistencyLabel(issue.consistency)}
        >
          <Badge
            data-testid="issue-consistency-badge"
            className={cn(
              badgeSizeClass,
              CONSISTENCY_STYLES[issue.consistency]
            )}
            aria-label={`Consistency: ${getIssueConsistencyLabel(
              issue.consistency
            )}`}
          >
            <ConsistencyIcon className="size-3 shrink-0" />
            <span className="capitalize truncate">{issue.consistency}</span>
          </Badge>
        </TooltipItem>
      </div>
    </TooltipProvider>
  );
}

function TooltipItem({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="text-[10px] py-1 px-2">
        <span className="font-semibold">{label}:</span>{" "}
        <span className="capitalize">{value}</span>
      </TooltipContent>
    </Tooltip>
  );
}
