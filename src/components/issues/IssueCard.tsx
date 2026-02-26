"use client";

import type React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { IssueBadge } from "~/components/issues/IssueBadge";
import { IssueBadgeGrid } from "~/components/issues/IssueBadgeGrid";
import { formatIssueId, resolveIssueReporter } from "~/lib/issues/utils";
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
  variant?: "normal" | "compact" | "mini";
  className?: string;
  showReporter?: boolean;
  dataTestId?: string;
}

export function IssueCard({
  issue,
  machine,
  variant = "normal",
  className,
  showReporter = false,
  dataTestId,
}: IssueCardProps): React.JSX.Element {
  const isClosed = (CLOSED_STATUSES as readonly string[]).includes(
    issue.status
  );

  const initials = issue.machineInitials;
  const reporter = resolveIssueReporter(issue);

  if (variant === "mini") {
    return (
      <Link href={`/m/${initials}/i/${issue.issueNumber}`} className="block">
        <Card
          className={cn(
            "transition-all cursor-pointer border-outline-variant hover:border-primary/50",
            isClosed
              ? "bg-surface-variant/30"
              : "bg-surface hover:glow-primary",
            className
          )}
          data-testid={dataTestId ?? "issue-card"}
        >
          <div className="flex items-center gap-2 p-2">
            <span className="text-xs text-muted-foreground font-mono shrink-0">
              {formatIssueId(initials, issue.issueNumber)}
            </span>
            <span
              className={cn(
                "text-sm truncate flex-1 min-w-0",
                isClosed ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {issue.title}
            </span>
            <IssueBadge
              type="status"
              value={issue.status}
              variant="strip"
              showTooltip={false}
            />
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link
      href={`/m/${initials}/i/${issue.issueNumber}`}
      className="block h-full"
    >
      <Card
        className={cn(
          "transition-all h-full cursor-pointer border-outline-variant hover:border-primary/50 relative overflow-hidden",
          isClosed ? "bg-surface-variant/30" : "bg-surface hover:glow-primary",
          className
        )}
        data-testid={dataTestId ?? "issue-card"}
      >
        <CardHeader
          className={cn(
            "h-full flex! flex-col! justify-center",
            variant === "compact" ? "p-3" : "p-4"
          )}
        >
          <div
            className={cn(
              "flex w-full justify-between",
              variant === "compact"
                ? "flex-col gap-3"
                : "flex-col sm:flex-row flex-wrap sm:items-start md:items-center gap-4"
            )}
          >
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
                <span className="font-medium underline decoration-primary/30 underline-offset-2">
                  {machine.name}
                </span>
                {showReporter && (
                  <span>
                    Reported by {reporter.name} •{" "}
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </span>
                )}
                {!showReporter && (
                  <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <IssueBadgeGrid issue={issue} />
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
