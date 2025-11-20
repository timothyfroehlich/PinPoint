"use client";

import type React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";

interface IssueFiltersProps {
  machines: { id: string; name: string }[];
  users: { id: string; name: string }[];
}

/**
 * Issue Filters Component (Client Component)
 *
 * Provides filtering dropdowns for issues list page.
 * Updates URL search params to filter issues server-side.
 */
export function IssueFilters({
  machines,
  users,
}: IssueFiltersProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const machineId = searchParams.get("machineId") ?? "";
  const status = searchParams.get("status") ?? "";
  const severity = searchParams.get("severity") ?? "";
  const assignedTo = searchParams.get("assignedTo") ?? "";

  const hasFilters = machineId || status || severity || assignedTo;

  const updateFilter = (key: string, value: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/issues?${params.toString()}`);
  };

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {/* Machine Filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="issue-filter-machine"
          className="text-sm text-muted-foreground"
        >
          Machine:
        </label>
        <select
          id="issue-filter-machine"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
          value={machineId}
          onChange={(e) => updateFilter("machineId", e.target.value)}
        >
          <option value="">All Machines</option>
          {machines.map((machine) => (
            <option key={machine.id} value={machine.id}>
              {machine.name}
            </option>
          ))}
        </select>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="issue-filter-status"
          className="text-sm text-muted-foreground"
        >
          Status:
        </label>
        <select
          id="issue-filter-status"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
          value={status}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Severity Filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="issue-filter-severity"
          className="text-sm text-muted-foreground"
        >
          Severity:
        </label>
        <select
          id="issue-filter-severity"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
          value={severity}
          onChange={(e) => updateFilter("severity", e.target.value)}
        >
          <option value="">All Severities</option>
          <option value="minor">Minor</option>
          <option value="playable">Playable</option>
          <option value="unplayable">Unplayable</option>
        </select>
      </div>

      {/* Assignee Filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="issue-filter-assignee"
          className="text-sm text-muted-foreground"
        >
          Assignee:
        </label>
        <select
          id="issue-filter-assignee"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
          value={assignedTo}
          onChange={(e) => updateFilter("assignedTo", e.target.value)}
        >
          <option value="">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-input text-foreground"
        >
          <Link href="/issues">Clear Filters</Link>
        </Button>
      )}
    </div>
  );
}
