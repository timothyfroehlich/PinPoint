"use client";

import type React from "react";
import { IssueCard, type IssueCardIssue } from "~/components/issues/IssueCard";
import { MachineEmptyState } from "~/components/machines/MachineEmptyState";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface IssuesExpandoProps {
  issues: IssueCardIssue[];
  machineName: string;
  machineInitials: string;
  totalIssuesCount: number;
}

export function IssuesExpando({
  issues,
  machineName,
  machineInitials,
  totalIssuesCount,
}: IssuesExpandoProps): React.JSX.Element {
  return (
    <div
      className="mt-2 bg-surface-container border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col"
      data-testid="issues-section"
    >
      <div className="flex items-center justify-between p-4 border-b border-outline-variant bg-surface-variant/20">
        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
          Open Issues
          <span className="bg-surface border border-outline-variant text-on-surface text-[10px] px-2 py-0.5 rounded-full font-medium">
            {issues.length}
          </span>
        </h2>
        <div className="flex items-center gap-3">
          {totalIssuesCount > issues.length && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">
              of {totalIssuesCount} total
            </span>
          )}
          <Link
            href={`/issues?machine=${machineInitials}`}
            className="text-[11px] text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
          >
            View all
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>

      <div className="p-4 bg-surface/30">
        {issues.length === 0 ? (
          <div className="py-4">
            <MachineEmptyState machineInitials={machineInitials} />
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                machine={{ name: machineName }}
                variant="mini"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
