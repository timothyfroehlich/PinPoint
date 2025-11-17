/**
 * Issue Card Component
 *
 * Displays a single issue in the issues list.
 * Shows title, status, severity, assignee, and timestamps.
 */

import type React from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import type { Issue, UserProfile, Machine } from "~/lib/types";

interface IssueCardProps {
  issue: Issue & {
    machine: Machine;
    reportedByUser: UserProfile | null;
    assignedToUser: UserProfile | null;
  };
}

/**
 * Get severity badge color classes
 */
function getSeverityStyles(
  severity: "minor" | "playable" | "unplayable"
): string {
  const styles: Record<string, string> = {
    minor: "bg-success-container text-on-success-container border-success",
    playable: "bg-warning-container text-on-warning-container border-warning",
    unplayable: "bg-error-container text-on-error-container border-error",
  };
  return styles[severity] ?? "";
}

/**
 * Get status badge color classes
 */
function getStatusStyles(status: "new" | "in_progress" | "resolved"): string {
  const styles: Record<string, string> = {
    new: "bg-primary-container text-on-primary-container border-primary",
    in_progress:
      "bg-tertiary-container text-on-tertiary-container border-tertiary",
    resolved: "bg-success-container text-on-success-container border-success",
  };
  return styles[status] ?? "";
}

/**
 * Get status label
 */
function getStatusLabel(status: "new" | "in_progress" | "resolved"): string {
  const labels: Record<string, string> = {
    new: "New",
    in_progress: "In Progress",
    resolved: "Resolved",
  };
  return labels[status] ?? status;
}

/**
 * Get severity label
 */
function getSeverityLabel(
  severity: "minor" | "playable" | "unplayable"
): string {
  const labels: Record<string, string> = {
    minor: "Minor",
    playable: "Playable",
    unplayable: "Unplayable",
  };
  return labels[severity] ?? severity;
}

export function IssueCard({ issue }: IssueCardProps): React.JSX.Element {
  return (
    <Link
      href={`/issues/${issue.id}`}
      className="block p-4 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-variant transition-colors"
      data-testid="issue-card"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Issue Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-on-surface truncate">
            {issue.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {/* Machine */}
            <span className="text-on-surface-variant">
              {issue.machine.name}
            </span>

            {/* Severity Badge */}
            <Badge
              className={`${getSeverityStyles(issue.severity)} border text-xs`}
            >
              {getSeverityLabel(issue.severity)}
            </Badge>

            {/* Status Badge */}
            <Badge
              className={`${getStatusStyles(issue.status)} border text-xs`}
            >
              {getStatusLabel(issue.status)}
            </Badge>
          </div>

          {/* Metadata */}
          <div className="mt-2 flex items-center gap-3 text-xs text-on-surface-variant">
            <span>
              Reported {new Date(issue.createdAt).toLocaleDateString()}
            </span>
            {issue.reportedByUser && (
              <span>by {issue.reportedByUser.name}</span>
            )}
          </div>
        </div>

        {/* Right: Assignee */}
        {issue.assignedToUser && (
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-on-primary text-xs">
                {issue.assignedToUser.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-on-surface-variant hidden md:inline">
              {issue.assignedToUser.name}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
