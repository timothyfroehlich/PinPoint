import type React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { User } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatIssueId } from "~/lib/issues/utils";
import { IssueBadge } from "~/components/issues/IssueBadge";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import type { IssueListItem, IssueSeverity } from "~/lib/types";

/**
 * Tailwind-safe severity dot color classes.
 * Must use full class names (not dynamic string construction) for static analysis.
 */
const SEVERITY_DOT_CLASSES: Record<IssueSeverity, string> = {
  cosmetic: "bg-amber-300",
  minor: "bg-amber-400",
  major: "bg-amber-500",
  unplayable: "bg-red-500",
};

interface MobileIssueCardProps {
  issue: IssueListItem;
}

/**
 * MobileIssueCard — Card representation of an issue for mobile viewports.
 *
 * Renders below the md: breakpoint. Shows:
 * - Top row: issue ID chip + machine name + age
 * - Title (line-clamp-2)
 * - Bottom row: status badge + severity dot + label + assignee avatar
 *
 * Unplayable issues get a red-tinted border and background.
 */
export function MobileIssueCard({
  issue,
}: MobileIssueCardProps): React.JSX.Element {
  const isUrgent = issue.severity === "unplayable";
  const href = `/m/${issue.machineInitials}/i/${issue.issueNumber}`;

  const assigneeName = issue.assignedToUser?.name ?? null;
  const assigneeInitials = assigneeName
    ? assigneeName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null;

  const severityConfig = SEVERITY_CONFIG[issue.severity];

  return (
    <Link
      href={href}
      data-testid="mobile-issue-card"
      className="block"
      aria-label={`Issue ${formatIssueId(issue.machineInitials, issue.issueNumber)}: ${issue.title}`}
    >
      <div
        className={cn(
          "rounded-[10px] border bg-card p-3 transition-colors active:bg-muted/50",
          isUrgent
            ? "border-red-500/50 bg-red-950/20"
            : "border-border hover:border-border/80"
        )}
      >
        {/* Top row: ID chip + machine name + age */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[11px] font-semibold bg-green-500/15 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded shrink-0">
              {formatIssueId(issue.machineInitials, issue.issueNumber)}
            </span>
            <span className="text-[12px] text-muted-foreground truncate min-w-0">
              {issue.machine.name}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(issue.updatedAt), {
              addSuffix: false,
            })
              .replace("about ", "")
              .replace("less than a minute", "just now")}
          </span>
        </div>

        {/* Title */}
        <p className="text-[14px] font-semibold text-foreground line-clamp-2 mb-2 leading-snug">
          {issue.title}
        </p>

        {/* Bottom row: status badge + severity + assignee */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <IssueBadge
              type="status"
              value={issue.status}
              variant="strip"
              showTooltip={false}
              className="text-[11px] py-0.5"
            />
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                SEVERITY_DOT_CLASSES[issue.severity]
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                "text-[11px] font-medium shrink-0",
                isUrgent ? "text-red-400" : "text-muted-foreground"
              )}
            >
              {severityConfig.label}
            </span>
          </div>

          {/* Assignee avatar */}
          <div
            className={cn(
              "h-[26px] w-[26px] rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
              assigneeInitials
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground border border-border"
            )}
            title={assigneeName ?? "Unassigned"}
            aria-label={
              assigneeName ? `Assigned to ${assigneeName}` : "Unassigned"
            }
          >
            {assigneeInitials ?? (
              <User className="h-3 w-3" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
