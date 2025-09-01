/**
 * Centralized filter types for issues and machines.
 *
 * These types are used across DAL, services, and UI components.
 * Keeping them here avoids duplicate declarations and drift.
 */

/** Canonical sort options for issues */
export const ISSUE_SORT_OPTIONS = [
  "created",
  "updated",
  "status",
  "severity",
  "machine",
] as const;

/** Issue sort option type derived from canonical array */
export type IssueSortBy = (typeof ISSUE_SORT_OPTIONS)[number];

export interface IssueFilters {
  locationId?: string;
  machineId?: string;
  statusIds?: string[];
  status?: string[]; // DAL compatibility - status names
  priority?: string[]; // DAL compatibility - priority names
  search?: string;
  assigneeId?: string;
  reporterId?: string;
  ownerId?: string;
  modelId?: string;
  statusId?: string;
  statusCategory?: string;
  sortBy?: IssueSortBy;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface MachineFilters {
  locationId?: string;
  locationIds?: string[]; // DAL compatibility - array form
  modelId?: string;
  modelIds?: string[]; // DAL compatibility - array form
  ownerId?: string;
  ownerIds?: string[]; // DAL compatibility - array form
  organizationId?: string;
  manufacturer?: string;
  yearMin?: number;
  yearMax?: number;
  hasQR?: boolean;
  status?: string[];
  search?: string; // DAL compatibility
}
