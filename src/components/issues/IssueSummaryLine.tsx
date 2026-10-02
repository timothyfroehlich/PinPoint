import type React from "react";
import { User, type LucideIcon } from "lucide-react";
import {
  PRIORITY_CONFIG,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
} from "~/lib/issues/status";
import type { IssuePriority, IssueSeverity, IssueStatus } from "~/lib/types";
import { cn } from "~/lib/utils";

interface IssueSummaryLineProps {
  status: IssueStatus;
  severity: IssueSeverity;
  priority: IssuePriority;
  /** The assignee's name; null when unassigned. */
  assigneeName: string | null;
}

/**
 * The read-only line under the issue title: assignee, status, severity, and
 * priority,
 * each with its icon (spec issue-detail §4.7). Changing them happens in
 * Details.
 */
export function IssueSummaryLine({
  status,
  severity,
  priority,
  assigneeName,
}: IssueSummaryLineProps): React.JSX.Element {
  const items: {
    key: string;
    icon: LucideIcon;
    color: string;
    text: string;
    /** Names the field for screen readers; the icon does that visually. */
    srPrefix?: string;
  }[] = [
    {
      key: "assignee",
      icon: User,
      color: "text-muted-foreground",
      text: assigneeName ?? "Unassigned",
      srPrefix: "Assignee:",
    },
    {
      key: "status",
      icon: STATUS_CONFIG[status].icon,
      color: STATUS_CONFIG[status].iconColor,
      text: STATUS_CONFIG[status].label,
      srPrefix: "Status:",
    },
    {
      key: "severity",
      icon: SEVERITY_CONFIG[severity].icon,
      color: SEVERITY_CONFIG[severity].iconColor,
      text: SEVERITY_CONFIG[severity].label,
      srPrefix: "Severity:",
    },
    {
      key: "priority",
      icon: PRIORITY_CONFIG[priority].icon,
      color: PRIORITY_CONFIG[priority].iconColor,
      text: `${PRIORITY_CONFIG[priority].label} priority`,
    },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground"
      data-testid="issue-summary-line"
    >
      {items.map(({ key, icon: Icon, color, text, srPrefix }) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <Icon className={cn("size-4 shrink-0", color)} aria-hidden="true" />
          <span>
            {srPrefix ? <span className="sr-only">{srPrefix} </span> : null}
            {text}
          </span>
        </span>
      ))}
    </div>
  );
}
