"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useRef, useEffect } from "react";
import type { IssueFilters } from "~/lib/issues/filters";

interface UseSearchFiltersOptions {
  resetPagination?: boolean;
}

interface UseSearchFiltersReturn {
  pushFilters: (
    updates: Partial<IssueFilters>,
    options?: UseSearchFiltersOptions
  ) => void;
  setSort: (sort: string) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

/**
 * Hook for managing issue filter state in URL search params
 *
 * Provides utilities for updating filters, sorting, and pagination
 * while preserving other URL parameters.
 *
 * @param filters - Current filter state (from parseIssueFilters)
 * @returns Object with filter update functions
 */
export function useSearchFilters(
  filters: IssueFilters
): UseSearchFiltersReturn {
  const router = useRouter();
  const pathname = usePathname();

  /*
   * Stable reference to filters so we don't recreate the callback on every render.
   * This prevents infinite loops in consumers that use this callback in effects.
   */
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  /**
   * Updates filter state by merging with current filters
   *
   * @param updates - Partial filter updates to apply
   * @param options - Optional configuration
   * @param options.resetPagination - Reset to page 1 (default: false)
   */
  const pushFilters = useCallback(
    (
      updates: Partial<IssueFilters>,
      options: UseSearchFiltersOptions = {}
    ): void => {
      const params = new URLSearchParams();
      const currentFilters = filtersRef.current;
      const merged = { ...currentFilters, ...updates };

      // Apply pagination reset if requested
      if (options.resetPagination) {
        merged.page = 1;
      }

      // Search query
      if (merged.q) params.set("q", merged.q);

      // Status (special handling for empty array = show all)
      if (merged.status) {
        if (merged.status.length > 0) {
          params.set("status", merged.status.join(","));
        } else {
          params.set("status", "all");
        }
      }

      // Multi-select filters
      if (merged.machine && merged.machine.length > 0)
        params.set("machine", merged.machine.join(","));
      if (merged.severity && merged.severity.length > 0)
        params.set("severity", merged.severity.join(","));
      if (merged.priority && merged.priority.length > 0)
        params.set("priority", merged.priority.join(","));
      if (merged.assignee && merged.assignee.length > 0)
        params.set("assignee", merged.assignee.join(","));
      if (merged.owner && merged.owner.length > 0)
        params.set("owner", merged.owner.join(","));
      if (merged.reporter && merged.reporter.length > 0)
        params.set("reporter", merged.reporter.join(","));
      if (merged.frequency && merged.frequency.length > 0)
        params.set("frequency", merged.frequency.join(","));

      // Boolean filters
      if (merged.watching) params.set("watching", "true");

      // Date range filters
      if (merged.createdFrom)
        params.set("created_from", merged.createdFrom.toISOString());
      if (merged.createdTo)
        params.set("created_to", merged.createdTo.toISOString());
      if (merged.updatedFrom)
        params.set("updated_from", merged.updatedFrom.toISOString());
      if (merged.updatedTo)
        params.set("updated_to", merged.updatedTo.toISOString());

      // Sorting (omit default)
      if (merged.sort && merged.sort !== "updated_desc")
        params.set("sort", merged.sort);

      // Pagination (omit defaults)
      if (merged.page && merged.page > 1)
        params.set("page", merged.page.toString());
      if (merged.pageSize && merged.pageSize !== 15)
        params.set("page_size", merged.pageSize.toString());

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname]
  );

  /**
   * Updates sort column and resets to page 1
   */
  const setSort = useCallback(
    (newSort: string): void => {
      pushFilters({ sort: newSort, page: 1 });
    },
    [pushFilters]
  );

  /**
   * Updates page size and resets to page 1
   */
  const setPageSize = useCallback(
    (size: number): void => {
      pushFilters({ pageSize: size, page: 1 });
    },
    [pushFilters]
  );

  /**
   * Updates current page number
   */
  const setPage = useCallback(
    (newPage: number): void => {
      pushFilters({ page: newPage });
    },
    [pushFilters]
  );

  return {
    pushFilters,
    setSort,
    setPage,
    setPageSize,
  };
}
