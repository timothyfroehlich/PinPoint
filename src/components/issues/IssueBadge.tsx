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
import {
  getIssueStatusIcon,
  getIssueStatusLabel,
  getIssueSeverityLabel,
  getIssuePriorityLabel,
  getIssueFrequencyLabel,
  STATUS_STYLES,
  SEVERITY_STYLES,
  PRIORITY_STYLES,
  FREQUENCY_STYLES,
  ISSUE_FIELD_ICONS,
  ISSUE_BADGE_WIDTH,
  ISSUE_BADGE_MIN_WIDTH_STRIP,
} from "~/lib/issues/status";
import type {
  IssueStatus,
  IssueSeverity,
  IssuePriority,
  IssueFrequency,
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
  size?: "normal" | "lg";
  className?: string;
  showTooltip?: boolean;
} & (
  | { type: "status"; value: IssueStatus }
  | { type: "severity"; value: IssueSeverity }
  | { type: "priority"; value: IssuePriority }
  | { type: "frequency"; value: IssueFrequency }
);

export function IssueBadge({
  type,
  value,
  variant = "normal",
  size = "normal",
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
    case "frequency":
      label = getIssueFrequencyLabel(value);
      styles = FREQUENCY_STYLES[value];
      Icon = ISSUE_FIELD_ICONS.frequency;
      break;
  }

  const badgeElement = (
    <Badge
      className={cn(
        "relative flex items-center justify-center border rounded-full font-bold",
        size === "lg" ? "text-xs px-3 py-1.5" : "text-[10px] px-2 py-1",
        variant === "strip"
          ? [
              "w-auto",
              size === "lg" ? "min-w-[125px]" : ISSUE_BADGE_MIN_WIDTH_STRIP,
            ]
          : [size === "lg" ? "w-[150px]" : ISSUE_BADGE_WIDTH],
        styles,
        className
      )}
      aria-label={`${type}: ${label}`}
      data-testid={`issue-${type}-badge`}
    >
      <div
        className={cn(
          "absolute flex items-center",
          size === "lg" ? "left-2" : "left-1.5"
        )}
      >
        <Icon
          className={cn("shrink-0", size === "lg" ? "size-[15px]" : "size-3")}
        />
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
