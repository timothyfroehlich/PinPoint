"use client";

import type React from "react";
import { Badge } from "~/components/ui/badge";
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
  ISSUE_BADGE_WIDTH,
  ISSUE_BADGE_MIN_WIDTH_STRIP,
} from "~/lib/issues/status";
import type {
  IssueStatus,
  IssueSeverity,
  IssuePriority,
  IssueConsistency,
} from "~/lib/types";
import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type IssueBadgeProps = {
  variant?: "normal" | "strip";
  className?: string;
  showTooltip?: boolean;
} & (
  | { type: "status"; value: IssueStatus }
  | { type: "severity"; value: IssueSeverity }
  | { type: "priority"; value: IssuePriority }
  | { type: "consistency"; value: IssueConsistency }
);

export function IssueBadge({
  type,
  value,
  variant = "normal",
  className,
  showTooltip = true,
}: IssueBadgeProps): React.JSX.Element {
  let label = "";
  let styles = "";
  let Icon: React.ElementType | null = null;

  switch (type) {
    case "status":
      label = getIssueStatusLabel(value);
      styles = STATUS_STYLES[value];
      Icon = getIssueStatusIcon(value);
      break;
    case "severity":
      label = getIssueSeverityLabel(value);
      styles = SEVERITY_STYLES[value];
      Icon = ISSUE_FIELD_ICONS.severity;
      break;
    case "priority":
      label = getIssuePriorityLabel(value);
      styles = PRIORITY_STYLES[value];
      Icon = ISSUE_FIELD_ICONS.priority;
      break;
    case "consistency":
      label = getIssueConsistencyLabel(value);
      styles = CONSISTENCY_STYLES[value];
      Icon = ISSUE_FIELD_ICONS.consistency;
      break;
  }

  const badgeElement = (
    <Badge
      className={cn(
        "relative flex items-center justify-center px-2 py-1 text-[10px] font-bold border rounded-full",
        variant === "strip"
          ? ["w-auto", ISSUE_BADGE_MIN_WIDTH_STRIP]
          : ISSUE_BADGE_WIDTH,
        styles,
        className
      )}
      aria-label={`${type}: ${label}`}
      data-testid={`issue-${type}-badge`}
    >
      <div className="absolute left-1.5 flex items-center">
        <Icon className="size-3 shrink-0" />
      </div>
      <span className="truncate capitalize px-1">{label}</span>
    </Badge>
  );

  if (!showTooltip) return badgeElement;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{badgeElement}</TooltipTrigger>
        <TooltipContent side="top" className="text-[10px] py-1 px-2">
          <span className="font-semibold capitalize">{type}:</span>{" "}
          <span className="capitalize">{label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
