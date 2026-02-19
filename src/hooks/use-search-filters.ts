"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useRef, useEffect } from "react";
import type { IssueFilters } from "~/lib/issues/filters";
import type { MachineFilters } from "~/lib/machines/filters";
import { storeLastIssuesPath } from "~/lib/cookies/client";

type GenericFilters = IssueFilters | MachineFilters;

interface UseSearchFiltersOptions {
  resetPagination?: boolean;
}

interface UseSearchFiltersReturn<T extends GenericFilters> {
  pushFilters: (updates: Partial<T>, options?: UseSearchFiltersOptions) => void;
  setSort: (sort: string) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

/**
 * Hook for managing filter state in URL search params
 *
 * Provides utilities for updating filters, sorting, and pagination
 * while preserving other URL parameters.
 *
 * @param filters - Current filter state
 * @returns Object with filter update functions
 */
export function useSearchFilters<T extends GenericFilters>(
  filters: T
): UseSearchFiltersReturn<T> {
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
    (updates: Partial<T>, options: UseSearchFiltersOptions = {}): void => {
      const params = new URLSearchParams();
      const currentFilters = filtersRef.current;
      const merged = { ...currentFilters, ...updates } as T;

      // Apply pagination reset if requested
      if (options.resetPagination && "page" in merged) {
        // We know page exists because of the in check, but Partial<T> doesn't guarantee it's writable
        // for these specific types, so we use a safe type assertion for internal hook logic
        (merged as T & { page: number }).page = 1;
      }

      // 1. Common Filters
      if (merged.q) params.set("q", merged.q);

      // Status handling (common but with different types)
      if (merged.status) {
        if (merged.status.length > 0) {
          params.set("status", merged.status.join(","));
        } else {
          params.set("status", "all");
        }
      }

      // Owner handling (common)
      if (merged.owner && merged.owner.length > 0)
        params.set("owner", merged.owner.join(","));

      // Machine presence filter
      if ("presence" in merged && Array.isArray(merged.presence)) {
        if (merged.presence.length > 0) {
          params.set("presence", merged.presence.join(","));
        } else {
          params.set("presence", "all");
        }
      }

      // 2. Issue-specific Filters
      if (
        "machine" in merged &&
        Array.isArray(merged.machine) &&
        merged.machine.length > 0
      )
        params.set("machine", merged.machine.join(","));
      if (
        "severity" in merged &&
        Array.isArray(merged.severity) &&
        merged.severity.length > 0
      )
        params.set("severity", merged.severity.join(","));
      if (
        "priority" in merged &&
        Array.isArray(merged.priority) &&
        merged.priority.length > 0
      )
        params.set("priority", merged.priority.join(","));
      if (
        "assignee" in merged &&
        Array.isArray(merged.assignee) &&
        merged.assignee.length > 0
      )
        params.set("assignee", merged.assignee.join(","));
      if (
        "reporter" in merged &&
        Array.isArray(merged.reporter) &&
        merged.reporter.length > 0
      )
        params.set("reporter", merged.reporter.join(","));
      if (
        "frequency" in merged &&
        Array.isArray(merged.frequency) &&
        merged.frequency.length > 0
      )
        params.set("frequency", merged.frequency.join(","));

      // Boolean filters
      if ("watching" in merged && merged.watching)
        params.set("watching", "true");
      if (
        "includeInactiveMachines" in merged &&
        merged.includeInactiveMachines
      ) {
        params.set("include_inactive_machines", "true");
      }

      // Date range filters
      if ("createdFrom" in merged && merged.createdFrom instanceof Date)
        params.set("created_from", merged.createdFrom.toISOString());
      if ("createdTo" in merged && merged.createdTo instanceof Date)
        params.set("created_to", merged.createdTo.toISOString());
      if ("updatedFrom" in merged && merged.updatedFrom instanceof Date)
        params.set("updated_from", merged.updatedFrom.toISOString());
      if ("updatedTo" in merged && merged.updatedTo instanceof Date)
        params.set("updated_to", merged.updatedTo.toISOString());

      // 3. Sorting (common field, different defaults)
      if (merged.sort) {
        const isIssue = "machine" in merged;
        const defaultSort = isIssue ? "updated_desc" : "name_asc";
        if (merged.sort !== defaultSort) {
          params.set("sort", merged.sort);
        }
      }

      // 4. Pagination
      if (
        "page" in merged &&
        typeof merged.page === "number" &&
        merged.page > 1
      )
        params.set("page", merged.page.toString());
      if (
        "pageSize" in merged &&
        typeof merged.pageSize === "number" &&
        merged.pageSize !== 15
      )
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
    (newSort: string): void => {
      pushFilters({ sort: newSort, page: 1 } as Partial<T>);
    },
    [pushFilters]
  );

  /**
   * Updates page size and resets to page 1
   */
  const setPageSize = useCallback(
    (size: number): void => {
      pushFilters({ pageSize: size, page: 1 } as Partial<T>);
    },
    [pushFilters]
  );

  /**
   * Updates current page number
   */
  const setPage = useCallback(
    (newPage: number): void => {
      pushFilters({ page: newPage } as Partial<T>);
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
