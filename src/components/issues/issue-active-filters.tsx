/**
 * Issue Active Filters Component
 * Phase 3B: Display and manage active filter badges
 *
 * Shows active filters as badges with remove functionality
 * Uses centralized URL building for consistent state management
 */

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { X } from "lucide-react";
import {
  buildIssueUrl,
  type IssueSearchParams,
} from "~/lib/search-params/issue-search-params";

interface IssueActiveFiltersProps {
  filters: IssueSearchParams;
  searchParams: Record<string, string | string[] | undefined>;
}

export function IssueActiveFilters({
  filters,
  searchParams,
}: IssueActiveFiltersProps) {
  const activeFilters = [];

  // Status filters
  if (filters.status?.length) {
    activeFilters.push({
      key: "status",
      label: "Status",
      value: filters.status.join(", "),
      removeUrl: buildIssueUrl(
        "/issues",
        { ...filters, status: undefined },
        searchParams,
      ),
    });
  }

  // Priority filters
  if (filters.priority?.length) {
    activeFilters.push({
      key: "priority",
      label: "Priority",
      value: filters.priority.join(", "),
      removeUrl: buildIssueUrl(
        "/issues",
        { ...filters, priority: undefined },
        searchParams,
      ),
    });
  }

  // Search filter
  if (filters.search) {
    activeFilters.push({
      key: "search",
      label: "Search",
      value: `\"${filters.search}\"`,
      removeUrl: buildIssueUrl(
        "/issues",
        { ...filters, search: undefined },
        searchParams,
      ),
    });
  }

  // Assignee filter
  if (filters.assignee) {
    activeFilters.push({
      key: "assignee",
      label: "Assignee",
      value: "Selected",
      removeUrl: buildIssueUrl(
        "/issues",
        { ...filters, assignee: undefined },
        searchParams,
      ),
    });
  }

  // Machine filter
  if (filters.machine) {
    activeFilters.push({
      key: "machine",
      label: "Machine",
      value: "Selected",
      removeUrl: buildIssueUrl(
        "/issues",
        { ...filters, machine: undefined },
        searchParams,
      ),
    });
  }

  // Location filter
  if (filters.location) {
    activeFilters.push({
      key: "location",
      label: "Location",
      value: "Selected",
      removeUrl: buildIssueUrl(
        "/issues",
        { ...filters, location: undefined },
        searchParams,
      ),
    });
  }

  // If no active filters, return null
  if (activeFilters.length === 0) {
    return null;
  }

  // Clear all URL
  const clearAllUrl = buildIssueUrl("/issues", {
    page: 1,
    sort: "created_at",
    order: "desc",
    limit: filters.limit,
    view: filters.view,
  });

  return (
    <>
      {activeFilters.map((filter) => (
        <Badge
          key={filter.key}
          variant="secondary"
          className="flex items-center gap-1"
        >
          {filter.label}: {filter.value}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 ml-1"
          >
            <Link href={filter.removeUrl} className="hover:text-red-500">
              <X className="h-3 w-3" />
            </Link>
          </Button>
        </Badge>
      ))}

      {/* Clear all filters button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href={clearAllUrl}>Clear filters</Link>
      </Button>
    </>
  );
}
