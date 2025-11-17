"use client";

/**
 * Issues Filter Component (Client Component)
 *
 * Provides filtering UI for issues list.
 * - Status filter (multi-select)
 * - Severity filter (multi-select)
 * - Assignee filter (multi-select)
 * - Filters apply immediately via URL query params
 */

import type React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { X } from "lucide-react";

interface IssuesFilterProps {
  users: { id: string; name: string }[];
}

export function IssuesFilter({ users }: IssuesFilterProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read current filters from URL
  const statusParam = searchParams.get("status");
  const severityParam = searchParams.get("severity");
  const assigneeParam = searchParams.get("assignee");
  const machineParam = searchParams.get("machineId");

  const selectedStatuses = statusParam ? statusParam.split(",") : [];
  const selectedSeverities = severityParam ? severityParam.split(",") : [];
  const selectedAssignees = assigneeParam ? assigneeParam.split(",") : [];

  // Update URL query params
  const updateFilters = (key: string, value: string, isMulti = false): void => {
    const params = new URLSearchParams(searchParams.toString());

    if (!value) {
      params.delete(key);
    } else if (isMulti) {
      // For multi-select, toggle the value in the comma-separated list
      const current = params.get(key)?.split(",").filter(Boolean) ?? [];
      const newValues = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      if (newValues.length > 0) {
        params.set(key, newValues.join(","));
      } else {
        params.delete(key);
      }
    } else {
      params.set(key, value);
    }

    // Preserve machineId if present
    if (machineParam && !params.has("machineId")) {
      params.set("machineId", machineParam);
    }

    router.push(`?${params.toString()}`);
  };

  const clearFilter = (key: string, value?: string): void => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      // Remove specific value from multi-select
      const current = params.get(key)?.split(",").filter(Boolean) ?? [];
      const newValues = current.filter((v) => v !== value);

      if (newValues.length > 0) {
        params.set(key, newValues.join(","));
      } else {
        params.delete(key);
      }
    } else {
      params.delete(key);
    }

    // Preserve machineId if present
    if (machineParam && !params.has("machineId")) {
      params.set("machineId", machineParam);
    }

    router.push(`?${params.toString()}`);
  };

  const clearAllFilters = (): void => {
    const params = new URLSearchParams();
    // Preserve machineId if present
    if (machineParam) {
      params.set("machineId", machineParam);
    }
    router.push(`?${params.toString()}`);
  };

  const hasActiveFilters =
    selectedStatuses.length > 0 ||
    selectedSeverities.length > 0 ||
    selectedAssignees.length > 0;

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Filter */}
        <div>
          <label className="text-sm font-medium text-on-surface mb-2 block">
            Status
          </label>
          <Select
            value=""
            onValueChange={(value) => updateFilters("status", value, true)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Severity Filter */}
        <div>
          <label className="text-sm font-medium text-on-surface mb-2 block">
            Severity
          </label>
          <Select
            value=""
            onValueChange={(value) => updateFilters("severity", value, true)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by severity..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="playable">Playable</SelectItem>
              <SelectItem value="unplayable">Unplayable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assignee Filter */}
        <div>
          <label className="text-sm font-medium text-on-surface mb-2 block">
            Assignee
          </label>
          <Select
            value=""
            onValueChange={(value) => updateFilters("assignee", value, true)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by assignee..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-on-surface-variant">
            Active filters:
          </span>

          {selectedStatuses.map((status) => (
            <Badge
              key={status}
              variant="outline"
              className="gap-1 cursor-pointer hover:bg-surface-variant"
              onClick={() => clearFilter("status", status)}
            >
              Status: {status}
              <X className="size-3" />
            </Badge>
          ))}

          {selectedSeverities.map((severity) => (
            <Badge
              key={severity}
              variant="outline"
              className="gap-1 cursor-pointer hover:bg-surface-variant"
              onClick={() => clearFilter("severity", severity)}
            >
              Severity: {severity}
              <X className="size-3" />
            </Badge>
          ))}

          {selectedAssignees.map((assignee) => {
            const user = users.find((u) => u.id === assignee);
            const label =
              assignee === "unassigned"
                ? "Unassigned"
                : (user?.name ?? "Unknown");
            return (
              <Badge
                key={assignee}
                variant="outline"
                className="gap-1 cursor-pointer hover:bg-surface-variant"
                onClick={() => clearFilter("assignee", assignee)}
              >
                Assignee: {label}
                <X className="size-3" />
              </Badge>
            );
          })}

          <button
            onClick={clearAllFilters}
            className="text-sm text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
