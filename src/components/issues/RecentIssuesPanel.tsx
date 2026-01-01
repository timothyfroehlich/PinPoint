import React from "react";
import Link from "next/link";
import {
  getIssueStatusLabel,
  getIssueStatusStyles,
  isIssueStatus,
} from "~/lib/issues/status";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { AlertCircle } from "lucide-react";
import { db } from "~/server/db";
import { issues as issuesTable } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { log } from "~/lib/logger";

interface RecentIssuesPanelProps {
  machineInitials: string;
  machineName: string;
  className?: string;
  limit?: number;
}

export async function RecentIssuesPanel({
  machineInitials,
  machineName,
  className,
  limit = 5,
}: RecentIssuesPanelProps): Promise<React.JSX.Element> {
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

  let issues: {
    id: string;
    issueNumber: number;
    title: string;
    status: "new" | "in_progress" | "resolved";
    createdAt: Date;
  }[] = [];
  try {
    issues = await db.query.issues.findMany({
      where: eq(issuesTable.machineInitials, machineInitials),
      orderBy: [desc(issuesTable.createdAt)],
      limit: limit,
      columns: {
        id: true,
        issueNumber: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (err) {
    log.error(
      { err, machineInitials },
      "Error fetching recent issues in Server Component"
    );
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

      {issues.length === 0 ? (
        <p className="py-4 text-center text-xs text-on-surface-variant italic">
          No recent issues reported.
        </p>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
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
                    getIssueStatusStyles(
                      isIssueStatus(issue.status) ? issue.status : "new"
                    ),
                    "px-1.5 py-0 text-[10px] h-4 font-semibold shrink-0"
                  )}
                >
                  {getIssueStatusLabel(
                    isIssueStatus(issue.status) ? issue.status : "new"
                  )}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
