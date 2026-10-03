"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useRef, useEffect } from "react";
import {
  ISSUE_WIDGET_PARAMS,
  type IssueFilters,
  type IssueSort,
} from "~/lib/issues/filters";
import { storeLastIssuesPath } from "~/lib/cookies/client";

interface UseSearchFiltersOptions {
  resetPagination?: boolean;
}

interface UseSearchFiltersReturn {
  pushFilters: (
    updates: Partial<IssueFilters>,
    options?: UseSearchFiltersOptions
  ) => void;
  setSort: (sort: IssueSort) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

/**
 * Hook for managing issue-list filter state in URL search params
 *
 * Provides utilities for updating filters, sorting, and pagination
 * while preserving other URL parameters.
 *
 * @param filters - Current filter state
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
      const merged: IssueFilters = { ...filtersRef.current, ...updates };

      if (options.resetPagination) merged.page = 1;

      if (merged.q) params.set("q", merged.q);

      if (merged.status) {
        if (merged.status.length > 0) {
          params.set("status", merged.status.join(","));
        } else {
          params.set("status", "all");
        }
      }

      if (merged.owner && merged.owner.length > 0)
        params.set("owner", merged.owner.join(","));
      if (merged.machine && merged.machine.length > 0)
        params.set("machine", merged.machine.join(","));
      if (merged.severity && merged.severity.length > 0)
        params.set("severity", merged.severity.join(","));
      if (merged.priority && merged.priority.length > 0)
        params.set("priority", merged.priority.join(","));
      if (merged.assignee && merged.assignee.length > 0)
        params.set("assignee", merged.assignee.join(","));
      if (merged.reporter && merged.reporter.length > 0)
        params.set("reporter", merged.reporter.join(","));
      if (merged.frequency && merged.frequency.length > 0)
        params.set("frequency", merged.frequency.join(","));

      // Boolean filters
      if (merged.watching) params.set("watching", "true");
      if (merged.includeInactiveMachines)
        params.set("include_inactive_machines", "true");

      // Date range filters
      if (merged.createdFrom instanceof Date)
        params.set("created_from", merged.createdFrom.toISOString());
      if (merged.createdTo instanceof Date)
        params.set("created_to", merged.createdTo.toISOString());
      if (merged.updatedFrom instanceof Date)
        params.set("updated_from", merged.updatedFrom.toISOString());
      if (merged.updatedTo instanceof Date)
        params.set("updated_to", merged.updatedTo.toISOString());

      // Summary Widget populations: All is the default and is omitted.
      for (const [key, param] of Object.entries(ISSUE_WIDGET_PARAMS)) {
        if (merged[key as keyof typeof ISSUE_WIDGET_PARAMS] === "filtered")
          params.set(param, "filtered");
      }

      if (merged.sort && merged.sort !== "updated_desc")
        params.set("sort", merged.sort);

      if (typeof merged.page === "number" && merged.page > 1)
        params.set("page", merged.page.toString());
      if (typeof merged.pageSize === "number" && merged.pageSize !== 15)
        params.set("page_size", merged.pageSize.toString());

      const newPath = `${pathname}?${params.toString()}`;
      if (pathname.startsWith("/issues")) {
        // Set cookie synchronously so it's available on next navigation
        storeLastIssuesPath(newPath);
      }
      router.push(newPath);
    },
    [router, pathname]
  );

  /**
   * Updates sort column and resets to page 1
   */
  const setSort = useCallback(
    (newSort: IssueSort): void => {
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
