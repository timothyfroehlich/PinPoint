"use client";

import React, { useState } from "react";
import Link from "next/link";
import { IssueBadge } from "~/components/issues/IssueBadge";
import { cn } from "~/lib/utils";
import { AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
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
  defaultOpen?: boolean;
}

/** Fixed height for the content area to prevent reflow across states.
 *  Includes 8px for pt-2 padding (box-sizing: border-box). */
const ROW_HEIGHT_PX = 28;
const GAP_PX = 2;
const PADDING_TOP_PX = 8;

function getContentHeight(limit: number): string {
  return `${limit * ROW_HEIGHT_PX + (limit - 1) * GAP_PX + PADDING_TOP_PX}px`;
}

export function RecentIssuesPanelClient({
  machineInitials,
  machineName,
  issues,
  isLoading,
  isError,
  className,
  limit,
  defaultOpen = true,
}: RecentIssuesPanelClientProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const displayIssues = issues.slice(0, limit);
  const contentHeight = getContentHeight(limit);

  // No machine selected
  if (!machineInitials) {
    return (
      <div
        className={cn(
          "rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-sm",
          className
        )}
      >
        <p className="py-2 text-center text-xs text-on-surface-variant italic">
          Select a machine to see recent issues.
        </p>
      </div>
    );
  }

  const header = (
    <button
      type="button"
      onClick={() => setIsOpen((prev) => !prev)}
      className="flex w-full items-center justify-between"
      aria-expanded={isOpen}
    >
      <h3 className="text-sm font-semibold text-on-surface">
        {isLoading
          ? "Loading issues..."
          : `Recent Issues for ${machineName || machineInitials}`}
      </h3>
      <div className="flex items-center gap-2">
        {isOpen && displayIssues.length > 0 && !isLoading && (
          <Link
            href={`/m/${machineInitials}/i`}
            className="text-xs text-link font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            View all →
          </Link>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-on-surface-variant transition-transform duration-200",
            !isOpen && "-rotate-90"
          )}
        />
      </div>
    </button>
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-sm",
        className
      )}
    >
      {header}

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div
            className="pt-2 overflow-hidden"
            style={{ height: contentHeight }}
          >
            {isLoading ? (
              <div className="space-y-0.5">
                {Array.from({ length: limit }, (_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1"
                  >
                    <Skeleton className="h-3.5 flex-1" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant italic">
                <AlertCircle className="h-4 w-4" />
                Could not load recent issues
              </div>
            ) : displayIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-3 text-center animate-in fade-in zoom-in duration-300">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-variant/50 mb-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600/70 dark:text-green-400/70" />
                </div>
                <p className="text-xs font-medium text-on-surface">
                  No recent issues
                </p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  This machine is running smoothly.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {displayIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/m/${machineInitials}/i/${issue.issueNumber}`}
                    className="block group"
                    aria-label={`View issue: ${issue.title} - ${getIssueStatusLabel(
                      issue.status
                    )}`}
                  >
                    <div className="flex items-center justify-between gap-2 rounded-md border border-transparent bg-surface hover:border-outline-variant px-2 py-1 transition-all active:scale-[0.98]">
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
        </div>
      </div>
    </div>
  );
}
