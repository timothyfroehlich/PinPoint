"use client";

import type React from "react";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { IssueCard, type IssueCardIssue } from "~/components/issues/IssueCard";
import { MachineEmptyState } from "~/components/machines/MachineEmptyState";
import { cn } from "~/lib/utils";

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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
      className="rounded-lg border border-outline-variant bg-surface"
      data-testid="issues-expando"
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 text-on-surface hover:bg-surface-variant/30"
        data-testid="issues-expando-trigger"
      >
        <ChevronRight
          className={cn(
            "size-5 transition-transform duration-200",
            isOpen && "rotate-90"
          )}
        />
        <span className="text-lg font-semibold">
          Open Issues ({issues.length})
        </span>
        {totalIssuesCount > issues.length && (
          <span className="text-sm text-on-surface-variant">
            of {totalIssuesCount} total
          </span>
        )}
      </summary>

      <div className="border-t border-outline-variant px-6 py-4">
        {issues.length === 0 ? (
          <MachineEmptyState machineInitials={machineInitials} />
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                machine={{ name: machineName }}
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
