"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { useSearchFilters } from "~/hooks/use-search-filters";
import { cn } from "~/lib/utils";
import { OPEN_STATUSES } from "~/lib/issues/status";
import { getSmartBadgeLabel } from "~/lib/issues/filter-utils";
import { type IssueFilters as FilterState } from "~/lib/issues/filters";
import type { IssueStatus } from "~/lib/types";

interface MachineOption {
  initials: string;
  name: string;
}

interface MobileIssueFilterBarProps {
  filters: FilterState;
  machines: MachineOption[];
  currentUserId: string | null;
}

/**
 * MobileIssueFilterBar — Mobile-only filter bar for the issues list.
 *
 * Renders below the md: breakpoint. Provides:
 * - Search input with clear button
 * - Filter icon button (opens the full IssueFilters panel via URL)
 * - Horizontally scrollable chip row: Sort | Status | Machine | Assignee
 *
 * All filter state is managed via URL search params (useSearchFilters hook).
 * No local modal state — chips push to URL, server re-fetches.
 *
 * The "Status" chip shows a smart summary label via getSmartBadgeLabel().
 * The "Machine" chip shows the count of selected machines when filtered.
 */
export function MobileIssueFilterBar({
  filters,
  machines: _machines,
  currentUserId: _currentUserId,
}: MobileIssueFilterBarProps): React.JSX.Element {
  const { pushFilters, setSort } = useSearchFilters(filters);
  const [search, setSearch] = React.useState(filters.q ?? "");
  const [isSearching, startTransition] = React.useTransition();

  // Debounced search
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search !== (filters.q ?? "")) {
        pushFilters({ q: search, page: 1 });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, filters.q, pushFilters]);

  // Sync search state on external filter changes
  React.useEffect(() => {
    setSearch(filters.q ?? "");
  }, [filters.q]);

  const activeStatuses: IssueStatus[] = filters.status ?? [...OPEN_STATUSES];
  const statusLabel = getSmartBadgeLabel(activeStatuses);
  const hasStatusFilter = filters.status !== undefined;

  const machineCount = filters.machine?.length ?? 0;
  const hasMachineFilter = machineCount > 0;

  const assigneeCount = filters.assignee?.length ?? 0;
  const hasAssigneeFilter = assigneeCount > 0;

  const currentSort = filters.sort ?? "updated_desc";
  const sortLabel = getSortLabel(currentSort);

  const handleClearSearch = (): void => {
    setSearch("");
    startTransition(() => {
      pushFilters({ q: undefined, page: 1 });
    });
  };

  const handleSortToggle = (): void => {
    // Cycle: updated_desc → updated_asc → created_desc → created_asc → updated_desc
    const nextSort: Record<string, string> = {
      updated_desc: "updated_asc",
      updated_asc: "created_desc",
      created_desc: "created_asc",
      created_asc: "updated_desc",
    };
    setSort(nextSort[currentSort] ?? "updated_desc");
  };

  return (
    <div data-testid="mobile-filter-chips" className="space-y-2">
      {/* Search bar + filter icon */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex items-center gap-2 px-3 h-10 bg-card border rounded-lg flex-1 transition-opacity",
            isSearching && "opacity-70"
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search issues..."
            data-testid="mobile-issues-search"
            className="flex-1 bg-transparent border-0 text-sm focus:outline-none placeholder:text-muted-foreground"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter icon button — links to full desktop filter URL */}
        <button
          type="button"
          aria-label="Open filters"
          className="h-10 w-10 flex items-center justify-center border border-border rounded-lg bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
          onClick={() => {
            // Scroll to top of page to reveal the desktop filter bar
            // On mobile, this button could open a full-screen filter sheet in a future iteration.
            // For now it's a visual affordance that filters exist.
          }}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Horizontally scrollable chip row */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
        {/* Sort chip */}
        <button
          type="button"
          onClick={handleSortToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-transparent text-muted-foreground text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors hover:bg-muted/50 active:bg-muted"
          aria-label={`Sort: ${sortLabel}. Tap to change.`}
        >
          <SortIcon className="h-3.5 w-3.5" />
          {sortLabel}
        </button>

        {/* Status chip */}
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors",
            hasStatusFilter
              ? "border-green-500/50 bg-green-500/10 text-green-400"
              : "border-border bg-transparent text-muted-foreground hover:bg-muted/50"
          )}
          aria-label={`Filter by status: ${statusLabel}`}
          onClick={() => {
            // Cycle status: Open → Closed → All → Open (default)
            if (!hasStatusFilter) {
              // Currently showing open (default), switch to closed
              pushFilters({
                status: ["fixed", "wont_fix", "wai", "no_repro", "duplicate"],
                page: 1,
              });
            } else if (statusLabel === "Closed") {
              // Switch to all
              pushFilters({ status: [], page: 1 });
            } else {
              // Reset to default open filter
              pushFilters({ status: undefined, page: 1 });
            }
          }}
        >
          {statusLabel}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>

        {/* Machine chip */}
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors",
            hasMachineFilter
              ? "border-green-500/50 bg-green-500/10 text-green-400"
              : "border-border bg-transparent text-muted-foreground hover:bg-muted/50"
          )}
          aria-label={
            hasMachineFilter
              ? `Machine filter: ${machineCount.toString()} selected`
              : "Filter by machine"
          }
          onClick={() => {
            if (hasMachineFilter) {
              pushFilters({ machine: [], page: 1 });
            }
          }}
        >
          {hasMachineFilter
            ? `Machine (${machineCount.toString()})`
            : "Machine"}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>

        {/* Assignee chip */}
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors",
            hasAssigneeFilter
              ? "border-green-500/50 bg-green-500/10 text-green-400"
              : "border-border bg-transparent text-muted-foreground hover:bg-muted/50"
          )}
          aria-label={
            hasAssigneeFilter
              ? `Assignee filter: ${assigneeCount.toString()} selected`
              : "Filter by assignee"
          }
          onClick={() => {
            if (hasAssigneeFilter) {
              pushFilters({ assignee: [], page: 1 });
            }
          }}
        >
          {hasAssigneeFilter
            ? `Assigned (${assigneeCount.toString()})`
            : "Assigned"}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </div>
    </div>
  );
}

/** Get a short human-readable label for the current sort. */
function getSortLabel(sort: string): string {
  const labels: Record<string, string> = {
    updated_desc: "Modified ↓",
    updated_asc: "Modified ↑",
    created_desc: "Created ↓",
    created_asc: "Created ↑",
    assignee_asc: "Assignee A-Z",
    assignee_desc: "Assignee Z-A",
  };
  return labels[sort] ?? "Sort";
}

/** Simple sort icon SVG (swap arrows) */
function SortIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m3 16 4 4 4-4" />
      <path d="M7 20V4" />
      <path d="m21 8-4-4-4 4" />
      <path d="M17 4v16" />
    </svg>
  );
}
