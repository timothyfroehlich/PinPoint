/**
 * Centralized filter types for issues and machines.
 *
 * These types are used across DAL, services, and UI components.
 * Keeping them here avoids duplicate declarations and drift.
 */

export interface IssueFilters {
  locationId?: string;
  machineId?: string;
  statusIds?: string[];
  search?: string;
  assigneeId?: string;
  reporterId?: string;
  ownerId?: string;
  modelId?: string;
  statusId?: string;
  statusCategory?: string;
  sortBy?: "created" | "updated" | "status" | "severity" | "game";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface MachineFilters {
  locationId?: string;
  modelId?: string;
  ownerId?: string;
  organizationId?: string;
  manufacturer?: string;
  yearMin?: number;
  yearMax?: number;
  hasQR?: boolean;
  status?: string[];
}

