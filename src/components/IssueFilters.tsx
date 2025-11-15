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
        <span className="text-sm text-on-surface-variant">Machine:</span>
        <select
          className="rounded-md border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface"
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
        <span className="text-sm text-on-surface-variant">Status:</span>
        <select
          className="rounded-md border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface"
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
        <span className="text-sm text-on-surface-variant">Severity:</span>
        <select
          className="rounded-md border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface"
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
        <span className="text-sm text-on-surface-variant">Assignee:</span>
        <select
          className="rounded-md border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface"
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
        <Link href="/issues">
          <Button
            variant="outline"
            size="sm"
            className="border-outline-variant text-on-surface"
          >
            Clear Filters
          </Button>
        </Link>
      )}
    </div>
  );
}
