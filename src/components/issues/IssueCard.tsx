"use client";

import type React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { IssueBadgeGrid } from "~/components/issues/IssueBadgeGrid";
import { formatIssueId, resolveIssueReporter } from "~/lib/issues/utils";
import { formatDate } from "~/lib/dates";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import type { Issue } from "~/lib/types";

export type IssueCardIssue = Pick<
  Issue,
  | "id"
  | "title"
  | "status"
  | "severity"
  | "priority"
  | "frequency"
  | "machineInitials"
  | "issueNumber"
  | "createdAt"
  | "reporterName"
> & {
  reportedByUser?: { name: string } | null;
  invitedReporter?: { name: string } | null;
};

interface IssueCardProps {
  issue: IssueCardIssue;
  machine: { name: string };
  variant?: "normal" | "compact";
  /** Badge arrangement. "normal" = 2-col grid on sm+ (default).
   *  "strip" = horizontal flex-wrap row — better for narrow, edge-to-edge
   *  lists where the badge grid would stack 4-deep vertically. */
  badgeLayout?: "normal" | "strip";
  className?: string;
  showReporter?: boolean;
  /**
   * Render the machine name sub-line. Off on a machine's own page, where the
   * name is redundant on every row (design §4, PP-dnk8).
   */
  showMachineName?: boolean;
  /**
   * Cap the badge strip on narrow rows so it never wraps to a second line:
   * Priority + Frequency collapse below the `@md/card-header` tier, leaving
   * Status + Severity (design §4, PP-dnk8). Strip layout only.
   */
  capNarrowBadges?: boolean;
  dataTestId?: string;
}

export function IssueCard({
  issue,
  machine,
  variant = "normal",
  badgeLayout = "normal",
  className,
  showReporter = false,
  showMachineName = true,
  capNarrowBadges = false,
  dataTestId,
}: IssueCardProps): React.JSX.Element {
  const isClosed = (CLOSED_STATUSES as readonly string[]).includes(
    issue.status
  );

  const initials = issue.machineInitials;
  const reporter = resolveIssueReporter(issue);

  return (
    <Link
      href={`/m/${initials}/i/${issue.issueNumber}`}
      className="block h-full"
    >
      <Card
        className={cn(
          "transition-colors duration-150 h-full cursor-pointer border-outline-variant hover:border-primary/50 relative overflow-hidden",
          isClosed ? "bg-surface-variant/30" : "bg-surface hover:glow-primary",
          className
        )}
        data-testid={dataTestId ?? "issue-card"}
      >
        <CardHeader
          className={cn(
            "h-full !flex !flex-col justify-center",
            variant === "compact" ? "p-3" : "p-4"
          )}
        >
          <div className="flex flex-col @lg/card-header:flex-row @lg/card-header:items-center justify-between gap-4 w-full">
            <div className="flex-1 min-w-0">
              <CardTitle
                className={cn(
                  "text-foreground mb-1 truncate",
                  variant === "compact" ? "text-sm" : "text-base"
                )}
              >
                <span className="text-muted-foreground font-mono mr-2">
                  {formatIssueId(initials, issue.issueNumber)}
                </span>{" "}
                {issue.title}
              </CardTitle>
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {showMachineName && (
                  <span className="font-medium underline decoration-primary/30 underline-offset-2">
                    {machine.name}
                  </span>
                )}
                {showReporter && (
                  <span>
                    Reported by {reporter.name} • {formatDate(issue.createdAt)}
                  </span>
                )}
                {!showReporter && <span>{formatDate(issue.createdAt)}</span>}
              </div>
            </div>
            <div className="shrink-0">
              <IssueBadgeGrid
                issue={issue}
                variant={badgeLayout}
                capNarrow={capNarrowBadges}
              />
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
