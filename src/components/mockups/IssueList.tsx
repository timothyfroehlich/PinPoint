"use client";

import * as React from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  User,
  AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  STATUS_CONFIG,
  SEVERITY_CONFIG,
  PRIORITY_CONFIG,
} from "~/lib/issues/status";
import type { IssueStatus, IssueSeverity, IssuePriority } from "~/lib/types";

export interface MockIssue {
  id: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  severity: IssueSeverity;
  machine: string;
  machineLabel: string;
  assignee?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: keyof MockIssue | null;
  direction: SortDirection;
}

interface IssueListProps {
  issues: MockIssue[];
  sortState: SortState;
  onSort: (column: keyof MockIssue) => void;
}

export function IssueList({
  issues,
  sortState,
  onSort,
}: IssueListProps): React.JSX.Element {
  const renderSortIcon = (column: keyof MockIssue): React.JSX.Element => {
    if (sortState.column !== column) {
      return (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-100 transition-opacity" />
      );
    }
    return sortState.direction === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 text-primary" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 text-primary" />
    );
  };

  const Header = ({
    label,
    column,
    align = "left",
    className,
  }: {
    label: string;
    column: keyof MockIssue;
    align?: "left" | "right" | "center";
    className?: string;
  }): React.JSX.Element => (
    <th
      className={cn(
        "px-4 py-3 text-sm font-semibold text-muted-foreground group cursor-pointer hover:text-foreground transition-colors",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      onClick={() => onSort(column)}
    >
      <div
        className={cn(
          "flex items-center",
          align === "right" && "justify-end",
          align === "center" && "justify-center"
        )}
      >
        {label}
        {renderSortIcon(column)}
      </div>
    </th>
  );

  return (
    <div className="w-full bg-card border rounded-lg overflow-hidden shadow-sm overflow-x-auto">
      <div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-muted/30">
              <Header
                label="Issue"
                column="id"
                className="w-full min-w-[200px] sm:min-w-[300px]"
              />
              <Header
                label="Status"
                column="status"
                className="min-w-[150px] max-w-[150px]"
              />
              <Header
                label="Priority"
                column="priority"
                className="min-w-[110px] max-w-[110px]"
              />
              <Header
                label="Severity"
                column="severity"
                className="min-w-[110px] max-w-[110px]"
              />
              <Header
                label="Assignee"
                column="assignee"
                className="hidden min-[950px]:table-cell min-w-[150px] max-w-[150px]"
              />
              <Header
                label="Modified"
                column="updatedAt"
                align="right"
                className="hidden min-[1100px]:table-cell min-w-[150px] max-w-[150px]"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {issues.map((issue) => {
              const sc = STATUS_CONFIG as Record<
                string,
                { label: string; icon: LucideIcon; iconColor: string }
              >;
              const sv = SEVERITY_CONFIG as Record<
                string,
                { label: string; icon: LucideIcon; iconColor: string }
              >;
              const pr = PRIORITY_CONFIG as Record<
                string,
                { label: string; icon: LucideIcon; iconColor: string }
              >;

              const statusConfig = sc[issue.status]!;
              const severityConfig = sv[issue.severity]!;
              const priorityConfig = pr[issue.priority]!;

              return (
                <tr
                  key={issue.id}
                  className="hover:bg-muted/50 transition-colors group"
                >
                  <td className="px-4 py-4 min-w-[200px] sm:min-w-[300px]">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 text-sm font-bold text-foreground whitespace-nowrap overflow-hidden min-w-0">
                        <span className="shrink-0">
                          {issue.machine}-{issue.id}
                        </span>
                        <span className="text-muted-foreground/60 font-medium shrink-0">
                          —
                        </span>
                        <span className="text-muted-foreground font-semibold truncate min-w-0">
                          {issue.machineLabel}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground line-clamp-1 group-hover:text-foreground transition-colors">
                        {issue.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 min-w-[150px] max-w-[150px]">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground leading-tight">
                      <statusConfig.icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          statusConfig.iconColor
                        )}
                      />
                      <span className="line-clamp-2">{statusConfig.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 min-w-[150px] max-w-[150px]">
                    <div className="flex items-center gap-1.5 text-xs font-medium leading-tight">
                      <priorityConfig.icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          priorityConfig.iconColor
                        )}
                      />
                      <span className="line-clamp-2">
                        {priorityConfig.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 min-w-[150px] max-w-[150px]">
                    <div className="flex items-center gap-1.5 text-xs font-medium leading-tight">
                      <severityConfig.icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          severityConfig.iconColor
                        )}
                      />
                      <span className="line-clamp-2">
                        {severityConfig.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 uppercase tracking-tighter hidden min-[950px]:table-cell min-w-[150px] max-w-[150px]">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center border border-border shrink-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-xs font-medium leading-tight line-clamp-2">
                        {issue.assignee ?? "Unassigned"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right hidden min-[1100px]:table-cell min-w-[150px] max-w-[150px]">
                    <span className="text-xs font-medium text-foreground leading-tight line-clamp-2">
                      {formatDistanceToNow(issue.updatedAt, {
                        addSuffix: true,
                      })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {issues.length === 0 && (
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold">No issues found</p>
          <p className="text-sm text-muted-foreground">
            Adjust your filters to see more issues.
          </p>
        </div>
      )}
    </div>
  );
}
