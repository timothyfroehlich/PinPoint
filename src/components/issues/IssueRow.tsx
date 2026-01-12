import type React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { IssueBadgeGrid } from "~/components/issues/IssueBadgeGrid";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import type { Issue } from "~/lib/types";

interface IssueRowProps {
  issue: Pick<
    Issue,
    | "id"
    | "issueNumber"
    | "title"
    | "status"
    | "severity"
    | "priority"
    | "consistency"
    | "createdAt"
    | "machineInitials"
  > & {
    machine: {
      name: string;
    } | null;
    reportedByUser: {
      name: string;
    } | null;
  };
}

export function IssueRow({ issue }: IssueRowProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "group flex items-start gap-4 border-b border-border p-4 transition-colors",
        (CLOSED_STATUSES as readonly string[]).includes(issue.status)
          ? "bg-muted/30 opacity-60 hover:opacity-100"
          : "hover:bg-muted/40"
      )}
      role="article"
      aria-label={`Issue: ${issue.title} (${issue.status})`}
    >
      <div className="mt-0.5 shrink-0">
        <IssueBadgeGrid issue={issue} variant="normal" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/m/${issue.machineInitials}/i/${issue.issueNumber}`}
            className="font-semibold text-foreground hover:text-primary transition-colors truncate"
          >
            {issue.title}
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">
            {formatIssueId(issue.machineInitials, issue.issueNumber)}
          </span>
          <span>•</span>
          <span className="font-medium text-foreground/80">
            {issue.machine?.name ?? issue.machineInitials}
          </span>
          <span>•</span>
          <span>
            opened on {new Date(issue.createdAt).toLocaleDateString()}
          </span>
          <span>by {issue.reportedByUser?.name ?? "Unknown"}</span>
        </div>
      </div>
    </div>
  );
}
