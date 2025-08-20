/**
 * Pure business logic for issue filtering
 * Extracted from IssueList component for proper unit testing
 */

export interface IssueFilters {
  locationId?: string | undefined;
  machineId?: string | undefined;
  statusIds?: string[] | undefined;
  search?: string | undefined;
  assigneeId?: string | undefined;
  reporterId?: string | undefined;
  ownerId?: string | undefined;
  sortBy: "created" | "updated" | "status" | "severity" | "game";
  sortOrder: "asc" | "desc";
}

/**
 * Default filter values for new filter objects
 */
export function getDefaultFilters(): IssueFilters {
  return {
    sortBy: "created",
    sortOrder: "desc",
  };
}

/**
 * Merges partial filter updates with current filters
 * Pure function - no side effects
 */
export function mergeFilters(
  currentFilters: IssueFilters,
  updates: Partial<IssueFilters>,
): IssueFilters {
  const merged: IssueFilters = { ...currentFilters };

  // Handle each filter property explicitly for TypeScript strictest compliance
  if ("locationId" in updates) {
    merged.locationId = updates.locationId;
  }
  if ("machineId" in updates) {
    merged.machineId = updates.machineId;
  }
  if ("statusIds" in updates) {
    merged.statusIds = updates.statusIds;
  }
  if ("search" in updates) {
    merged.search = updates.search;
  }
  if ("assigneeId" in updates) {
    merged.assigneeId = updates.assigneeId;
  }
  if ("reporterId" in updates) {
    merged.reporterId = updates.reporterId;
  }
  if ("ownerId" in updates) {
    merged.ownerId = updates.ownerId;
  }
  if ("sortBy" in updates) {
    merged.sortBy = updates.sortBy ?? "created";
  }
  if ("sortOrder" in updates) {
    merged.sortOrder = updates.sortOrder ?? "desc";
  }

  return merged;
}

/**
 * Validates and sanitizes filter values
 * Ensures all required fields are present with valid values
 */
export function validateFilters(filters: Partial<IssueFilters>): IssueFilters {
  const defaults = getDefaultFilters();
  
  return {
    locationId: filters.locationId || undefined,
    machineId: filters.machineId || undefined,
    statusIds: Array.isArray(filters.statusIds) ? filters.statusIds : undefined,
    search: typeof filters.search === 'string' ? filters.search.trim() || undefined : undefined,
    assigneeId: filters.assigneeId || undefined,
    reporterId: filters.reporterId || undefined,
    ownerId: filters.ownerId || undefined,
    sortBy: isValidSortField(filters.sortBy) ? filters.sortBy : defaults.sortBy,
    sortOrder: isValidSortOrder(filters.sortOrder) ? filters.sortOrder : defaults.sortOrder,
  };
}

/**
 * Checks if a filter object has any active filters (non-default values)
 */
export function hasActiveFilters(filters: IssueFilters): boolean {
  return !!(
    filters.locationId ||
    filters.machineId ||
    (filters.statusIds && filters.statusIds.length > 0) ||
    filters.search ||
    filters.assigneeId ||
    filters.reporterId ||
    filters.ownerId
  );
}

/**
 * Clears all filters except sort settings
 */
export function clearAllFilters(): IssueFilters {
  return getDefaultFilters();
}

/**
 * Type guards for validation
 */
function isValidSortField(value: unknown): value is IssueFilters['sortBy'] {
  return typeof value === 'string' && 
    ['created', 'updated', 'status', 'severity', 'game'].includes(value);
}

function isValidSortOrder(value: unknown): value is IssueFilters['sortOrder'] {
  return value === 'asc' || value === 'desc';
}

/**
 * Gets a summary of active filters for display purposes
 */
export function getFilterSummary(filters: IssueFilters): string[] {
  const summary: string[] = [];
  
  if (filters.locationId) summary.push("Location");
  if (filters.machineId) summary.push("Machine");
  if (filters.statusIds && filters.statusIds.length > 0) {
    summary.push(`Status (${filters.statusIds.length})`);
  }
  if (filters.search) summary.push("Search");
  if (filters.assigneeId) summary.push("Assignee");
  if (filters.reporterId) summary.push("Reporter");
  if (filters.ownerId) summary.push("Owner");
  
  return summary;
}