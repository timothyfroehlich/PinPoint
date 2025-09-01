/**
 * Filter Configuration for Advanced Search Forms
 * Phase 3C: Centralized filter definitions for Issues and Machines
 *
 * Defines the available filter fields and their configurations
 * for use with AdvancedSearchForm component
 */

import { type FilterField } from "./advanced-search-form";

// Issue status options with typical counts (these would be dynamic in real implementation)
export const ISSUE_STATUS_OPTIONS: {
  value: string;
  label: string;
  count?: number;
}[] = [
  { value: "open", label: "Open", count: 12 },
  { value: "in_progress", label: "In Progress", count: 8 },
  { value: "resolved", label: "Resolved", count: 45 },
  { value: "closed", label: "Closed", count: 23 },
];

// Issue priority options
export const ISSUE_PRIORITY_OPTIONS: {
  value: string;
  label: string;
  count?: number;
}[] = [
  { value: "low", label: "Low", count: 15 },
  { value: "medium", label: "Medium", count: 28 },
  { value: "high", label: "High", count: 12 },
  { value: "critical", label: "Critical", count: 3 },
];

// Machine status options
export const MACHINE_STATUS_OPTIONS: {
  value: string;
  label: string;
  count?: number;
}[] = [
  { value: "active", label: "Active", count: 45 },
  { value: "maintenance", label: "Under Maintenance", count: 5 },
  { value: "retired", label: "Retired", count: 8 },
];

// Common location options (these would come from database in real implementation)
export const LOCATION_OPTIONS: {
  value: string;
  label: string;
  count?: number;
}[] = [
  { value: "location-1", label: "Main Floor", count: 25 },
  { value: "location-2", label: "Upper Level", count: 18 },
  { value: "location-3", label: "Basement", count: 10 },
  { value: "location-4", label: "VIP Area", count: 5 },
];

// Machine manufacturer options
export const MACHINE_MANUFACTURER_OPTIONS: {
  value: string;
  label: string;
  count?: number;
}[] = [
  { value: "stern", label: "Stern", count: 22 },
  { value: "bally", label: "Bally", count: 15 },
  { value: "williams", label: "Williams", count: 12 },
  { value: "gottlieb", label: "Gottlieb", count: 8 },
  { value: "chicago_coin", label: "Chicago Coin", count: 1 },
];

// Machine model options (subset for demo)
export const MACHINE_MODEL_OPTIONS: {
  value: string;
  label: string;
  count?: number;
}[] = [
  { value: "medieval_madness", label: "Medieval Madness", count: 2 },
  { value: "attack_from_mars", label: "Attack from Mars", count: 1 },
  { value: "twilight_zone", label: "Twilight Zone", count: 1 },
  { value: "addams_family", label: "The Addams Family", count: 2 },
  { value: "monster_bash", label: "Monster Bash", count: 1 },
];

/**
 * Issues Filter Configuration
 * Defines all available filters for issue searching
 */
export const ISSUES_FILTER_FIELDS: FilterField[] = [
  {
    id: "search",
    label: "Search Text",
    type: "text",
    placeholder: "Search issue titles and descriptions...",
  },
  {
    id: "status",
    label: "Status",
    type: "multi-select",
    options: ISSUE_STATUS_OPTIONS,
  },
  {
    id: "priority",
    label: "Priority",
    type: "multi-select",
    options: ISSUE_PRIORITY_OPTIONS,
  },
  {
    id: "location",
    label: "Location",
    type: "multi-select",
    options: LOCATION_OPTIONS,
  },
  {
    id: "assignee",
    label: "Assignee",
    type: "select",
    placeholder: "Select assignee...",
    // Note: User options would be loaded dynamically from server
    options: [
      { value: "user-1", label: "John Doe", count: 8 },
      { value: "user-2", label: "Jane Smith", count: 12 },
      { value: "user-3", label: "Mike Johnson", count: 5 },
    ],
  },
  {
    id: "reporter",
    label: "Reporter",
    type: "select",
    placeholder: "Select reporter...",
    options: [
      { value: "user-1", label: "John Doe", count: 15 },
      { value: "user-2", label: "Jane Smith", count: 8 },
      { value: "user-3", label: "Mike Johnson", count: 10 },
    ],
  },
  {
    id: "created_at",
    label: "Created Date Range",
    type: "date-range",
  },
  {
    id: "updated_at",
    label: "Last Updated Range",
    type: "date-range",
  },
];

/**
 * Machines Filter Configuration
 * Defines all available filters for machine searching
 */
export const MACHINES_FILTER_FIELDS: FilterField[] = [
  {
    id: "search",
    label: "Search Text",
    type: "text",
    placeholder: "Search machine names and models...",
  },
  {
    id: "location",
    label: "Location",
    type: "multi-select",
    options: LOCATION_OPTIONS,
  },
  {
    id: "manufacturer",
    label: "Manufacturer",
    type: "multi-select",
    options: MACHINE_MANUFACTURER_OPTIONS,
  },
  {
    id: "model",
    label: "Model",
    type: "multi-select",
    options: MACHINE_MODEL_OPTIONS,
  },
  {
    id: "status",
    label: "Status",
    type: "multi-select",
    options: MACHINE_STATUS_OPTIONS,
  },
  {
    id: "owner",
    label: "Owner",
    type: "select",
    placeholder: "Select owner...",
    options: [
      { value: "owner-1", label: "PinPoint Arcade", count: 45 },
      { value: "owner-2", label: "Vintage Games Inc", count: 8 },
      { value: "owner-3", label: "Collector Smith", count: 5 },
    ],
  },
  {
    id: "year",
    label: "Year Range",
    type: "number-range",
    min: 1931,
    max: new Date().getFullYear(),
  },
  {
    id: "hasQR",
    label: "Has QR Code",
    type: "boolean",
  },
];

/**
 * Universal Search Filter Configuration
 * Simplified filters for cross-entity search
 */
export const UNIVERSAL_FILTER_FIELDS: FilterField[] = [
  {
    id: "search",
    label: "Search Text",
    type: "text",
    placeholder: "Search across all entities...",
  },
  {
    id: "entities",
    label: "Entity Types",
    type: "multi-select",
    options: [
      { value: "issues", label: "Issues", count: 58 },
      { value: "machines", label: "Machines", count: 58 },
      { value: "users", label: "Users", count: 12 },
      { value: "locations", label: "Locations", count: 4 },
    ],
  },
  {
    id: "location",
    label: "Location",
    type: "multi-select",
    options: LOCATION_OPTIONS,
  },
  {
    id: "updated_at",
    label: "Last Updated",
    type: "date-range",
  },
];

/**
 * Get filter fields configuration for specific entity type
 */
export function getFilterFieldsForEntity(
  entityType: "issues" | "machines" | "universal",
): FilterField[] {
  switch (entityType) {
    case "issues":
      return ISSUES_FILTER_FIELDS;
    case "machines":
      return MACHINES_FILTER_FIELDS;
    case "universal":
      return UNIVERSAL_FILTER_FIELDS;
    default:
      return [];
  }
}

/**
 * Get filter field by ID for specific entity type
 */
export function getFilterField(
  entityType: "issues" | "machines" | "universal",
  fieldId: string,
): FilterField | undefined {
  const fields = getFilterFieldsForEntity(entityType);
  return fields.find((field) => field.id === fieldId);
}

/**
 * Validate filter values against field configuration
 */
export function validateFilterValue(field: FilterField, value: any): boolean {
  switch (field.type) {
    case "text":
      return typeof value === "string" && value.length <= 100;

    case "select":
      return field.options?.some((option) => option.value === value) ?? false;

    case "multi-select":
      if (!Array.isArray(value)) return false;
      return value.every((v) =>
        field.options?.some((option) => option.value === v),
      );

    case "date-range":
      // For date range, we check start/end separately
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

    case "number-range":
      const num = Number(value);
      if (isNaN(num)) return false;
      if (field.min !== undefined && num < field.min) return false;
      if (field.max !== undefined && num > field.max) return false;
      return true;

    case "boolean":
      return typeof value === "boolean";

    default:
      return false;
  }
}
