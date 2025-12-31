"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  getIssueStatusLabel,
  getIssueStatusStyles,
  type IssueStatus,
} from "~/lib/issues/status";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";

interface RecentIssue {
  id: string;
  issueNumber: number;
  title: string;
  status: string;
  createdAt: string;
}

interface RecentIssuesPanelProps {
  machineInitials: string;
  machineName: string;
  className?: string;
  limit?: number;
}

export function RecentIssuesPanel({
  machineInitials,
  machineName,
  className,
  limit = 5,
}: RecentIssuesPanelProps): React.JSX.Element {
  const [issues, setIssues] = useState<RecentIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIssues(): Promise<void> {
      if (!machineInitials) {
        setIssues([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/machines/${machineInitials}/issues`);
        if (!response.ok) {
          throw new Error("Failed to fetch issues");
        }
        const data = (await response.json()) as RecentIssue[];
        setIssues(data);
      } catch (err) {
        console.error("Error fetching recent issues:", err);
        setError("Could not load recent issues");
      } finally {
        setIsLoading(false);
      }
    }

    void fetchIssues();
  }, [machineInitials]);

  const displayedIssues = issues.slice(0, limit);

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
        {issues.length > 0 && (
          <Link
            href={`/m/${machineInitials}/i`}
            className="text-xs text-primary hover:underline font-medium"
          >
            View all →
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-xs text-on-surface-variant py-4 italic">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : issues.length === 0 ? (
        <p className="py-4 text-center text-xs text-on-surface-variant italic">
          No recent issues reported.
        </p>
      ) : (
        <div className="space-y-2">
          {displayedIssues.map((issue) => (
            <Link
              key={issue.id}
              href={`/m/${machineInitials}/i/${issue.issueNumber}`}
              className="block group"
            >
              <div className="flex items-center justify-between gap-3 rounded-md border border-transparent bg-surface hover:border-outline-variant px-2 py-1.5 transition-all active:scale-[0.98]">
                <p className="truncate text-xs font-medium text-on-surface group-hover:text-primary transition-colors">
                  {issue.title}
                </p>
                <Badge
                  className={cn(
                    getIssueStatusStyles(issue.status as IssueStatus),
                    "px-1.5 py-0 text-[10px] h-4 font-semibold shrink-0"
                  )}
                >
                  {getIssueStatusLabel(issue.status as IssueStatus)}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
