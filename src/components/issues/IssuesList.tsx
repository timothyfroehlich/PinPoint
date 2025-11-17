/**
 * Issues List Component
 *
 * Displays a filterable list of issues.
 * Can be used for all issues or issues for a specific machine.
 */

import type React from "react";
import type { Issue, UserProfile, Machine } from "~/lib/types";
import { IssueCard } from "./IssueCard";
import { IssuesFilter } from "./IssuesFilter";

interface IssuesListProps {
  issues: (Issue & {
    machine: Machine;
    reportedByUser: UserProfile | null;
    assignedToUser: UserProfile | null;
  })[];
  users: { id: string; name: string }[];
  showFilters?: boolean;
}

export function IssuesList({
  issues,
  users,
  showFilters = true,
}: IssuesListProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Filters */}
      {showFilters && <IssuesFilter users={users} />}

      {/* Issues Count */}
      <div className="text-sm text-on-surface-variant">
        {issues.length === 0
          ? "No issues found"
          : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}
      </div>

      {/* Issues List */}
      {issues.length > 0 ? (
        <div className="space-y-3">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center border border-dashed border-outline-variant rounded-lg">
          <p className="text-lg text-on-surface-variant">No issues found</p>
          <p className="text-sm text-on-surface-variant mt-2">
            Try adjusting your filters or report a new issue
          </p>
        </div>
      )}
    </div>
  );
}
