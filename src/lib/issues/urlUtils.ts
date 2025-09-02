/**
 * Pure business logic for URL parameter conversion
 * Extracted from IssueList component for proper unit testing
 */

import type { IssueFilters } from "~/lib/types";
import { ISSUE_SORT_OPTIONS, type IssueSortBy } from "~/lib/types/filters";

/**
 * Converts IssueFilters to URLSearchParams for shareable URLs
 * Pure function - no router side effects
 */
export function filtersToUrlParams(filters: IssueFilters): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value != null && value !== "") {
      if (Array.isArray(value)) {
        // Handle array parameters (like statusIds)
        if (value.length > 0) {
          value.forEach((item) => {
            params.append(key, String(item));
          });
        }
      } else {
        params.set(key, String(value));
      }
    }
  });

  return params;
}

/**
 * Converts URLSearchParams to IssueFilters
 * Handles type conversion and validation
 */
export function urlParamsToFilters(
  params: URLSearchParams,
): Partial<IssueFilters> {
  const filters: Partial<IssueFilters> = {};

  // Handle single-value parameters
  const locationId = params.get("locationId");
  if (locationId) filters.locationId = locationId;

  const machineId = params.get("machineId");
  if (machineId) filters.machineId = machineId;

  const search = params.get("search");
  if (search) filters.search = search;

  const assigneeId = params.get("assigneeId");
  if (assigneeId) filters.assigneeId = assigneeId;

  const reporterId = params.get("reporterId");
  if (reporterId) filters.reporterId = reporterId;

  const ownerId = params.get("ownerId");
  if (ownerId) filters.ownerId = ownerId;

  // Handle array parameters (statusIds)
  const statusIds = params.getAll("statusIds");
  if (statusIds.length > 0) {
    filters.statusIds = statusIds;
  }

  // Handle sort parameters with validation
  const sortBy = params.get("sortBy");
  if (isValidSortBy(sortBy)) {
    filters.sortBy = sortBy;
  }

  const sortOrder = params.get("sortOrder");
  if (isValidSortOrder(sortOrder)) {
    filters.sortOrder = sortOrder;
  }

  return filters;
}

/**
 * Creates a URL path with query parameters from filters
 * Only includes parameters for non-default values
 */
export function createFilteredUrl(
  basePath: string,
  filters: IssueFilters,
): string {
  const params = new URLSearchParams();

  // Only add non-default/active filter parameters
  if (filters.locationId) params.set("locationId", filters.locationId);
  if (filters.machineId) params.set("machineId", filters.machineId);
  if (filters.statusIds && filters.statusIds.length > 0) {
    filters.statusIds.forEach((id) => {
      params.append("statusIds", id);
    });
  }
  if (filters.search) params.set("search", filters.search);
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  if (filters.reporterId) params.set("reporterId", filters.reporterId);
  if (filters.ownerId) params.set("ownerId", filters.ownerId);

  // Only include sort parameters if they differ from defaults
  if (filters.sortBy && filters.sortBy !== "created")
    params.set("sortBy", filters.sortBy);
  if (filters.sortOrder && filters.sortOrder !== "desc")
    params.set("sortOrder", filters.sortOrder);

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * Checks if URL parameters contain valid filter data
 */
export function hasValidFilterParams(params: URLSearchParams): boolean {
  const validKeys = [
    "locationId",
    "machineId",
    "statusIds",
    "search",
    "assigneeId",
    "reporterId",
    "ownerId",
    "sortBy",
    "sortOrder",
  ];

  for (const [key] of params) {
    if (validKeys.includes(key)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitizes URL parameters by removing invalid keys
 */
export function sanitizeUrlParams(params: URLSearchParams): URLSearchParams {
  const validKeys = [
    "locationId",
    "machineId",
    "statusIds",
    "search",
    "assigneeId",
    "reporterId",
    "ownerId",
    "sortBy",
    "sortOrder",
  ];

  const sanitized = new URLSearchParams();

  for (const [key, value] of params) {
    if (validKeys.includes(key) && value.trim()) {
      sanitized.append(key, value.trim());
    }
  }

  return sanitized;
}

/**
 * Type guards for URL parameter validation
 */
function isValidSortBy(value: string | null): value is IssueSortBy {
  return (
    typeof value === "string" &&
    ISSUE_SORT_OPTIONS.includes(value as (typeof ISSUE_SORT_OPTIONS)[number])
  );
}

function isValidSortOrder(value: string | null): value is "asc" | "desc" {
  return value === "asc" || value === "desc";
}

/**
 * Compares two URLSearchParams for equality (useful for testing)
 */
export function urlParamsEqual(
  params1: URLSearchParams,
  params2: URLSearchParams,
): boolean {
  const sorted1 = new URLSearchParams([...params1.entries()].sort());
  const sorted2 = new URLSearchParams([...params2.entries()].sort());
  return sorted1.toString() === sorted2.toString();
}
