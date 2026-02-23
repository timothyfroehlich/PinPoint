"use client";

import React from "react";
import Link from "next/link";
import { IssueBadge } from "~/components/issues/IssueBadge";
import { cn } from "~/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { getIssueStatusLabel } from "~/lib/issues/status";
import type { RecentIssueData } from "~/app/report/actions";

interface RecentIssuesPanelClientProps {
  machineInitials: string;
  machineName: string;
  issues: RecentIssueData[];
  isLoading: boolean;
  isError: boolean;
  className?: string;
  limit: number;
}

export function RecentIssuesPanelClient({
  machineInitials,
  machineName,
  issues,
  isLoading,
  isError,
  className,
  limit,
}: RecentIssuesPanelClientProps): React.JSX.Element {
  const displayIssues = issues.slice(0, limit);

  // No machine selected
  if (!machineInitials) {
    return (
      <div
        className={cn(
          "rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-sm h-fit",
          className
        )}
      >
        <p className="py-2 text-center text-xs text-on-surface-variant italic">
          Select a machine to see recent issues.
        </p>
      </div>
    );
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-sm h-fit",
          className
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: limit }, (_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5"
            >
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div
        className={cn(
          "rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-sm h-fit text-xs text-on-surface-variant italic flex items-center gap-2",
          className
        )}
      >
        <AlertCircle className="h-4 w-4" />
        Could not load recent issues
      </div>
    );
  }

  // Data loaded
  return (
    <div
      className={cn(
        "rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-sm h-fit",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-on-surface">
          Recent Issues for {machineName || machineInitials}
        </h3>
        {displayIssues.length > 0 && (
          <Link
            href={`/m/${machineInitials}/i`}
            className="text-xs text-link font-medium"
          >
            View all →
          </Link>
        )}
      </div>

      {displayIssues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-variant/50 mb-3">
            <CheckCircle2 className="h-6 w-6 text-green-600/70 dark:text-green-400/70" />
          </div>
          <p className="text-sm font-medium text-on-surface">
            No recent issues
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            This machine is running smoothly.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayIssues.map((issue) => (
            <Link
              key={issue.id}
              href={`/m/${machineInitials}/i/${issue.issueNumber}`}
              className="block group"
              aria-label={`View issue: ${issue.title} - ${getIssueStatusLabel(
                issue.status
              )}`}
            >
              <div className="flex items-center justify-between gap-3 rounded-md border border-transparent bg-surface hover:border-outline-variant px-2 py-1.5 transition-all active:scale-[0.98]">
                <p className="truncate text-xs font-medium text-on-surface group-hover:text-primary transition-colors">
                  {issue.title}
                </p>
                <IssueBadge type="status" value={issue.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
