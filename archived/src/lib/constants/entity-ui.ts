/**
 * Entity UI Constants
 * Centralized icons, colors, and display information for different entity types
 */

import {
  FileTextIcon,
  SettingsIcon,
  UsersIcon,
  MapPinIcon,
} from "lucide-react";

/**
 * Icons for different entity types
 * Used in search results, navigation, and other entity displays
 */
export const ENTITY_ICONS = {
  issues: FileTextIcon,
  machines: SettingsIcon,
  users: UsersIcon,
  locations: MapPinIcon,
} as const;

/**
 * Material Design 3 color classes for different entity types
 * Consistent with the project's color system from globals.css
 */
export const ENTITY_COLORS = {
  issues: "bg-primary-container text-on-primary-container",
  machines: "bg-tertiary-container text-on-tertiary-container",
  users: "bg-primary-container text-on-primary-container",
  locations: "bg-secondary-container text-on-secondary-container",
} as const;

/**
 * Display names for entity types
 * Used for pluralization and user-facing labels
 */
export const ENTITY_NAMES = {
  issues: "Issues",
  machines: "Machines",
  users: "Users",
  locations: "Locations",
} as const;

/**
 * Singular forms for entity types
 * Used in creation dialogs and singular references
 */
export const ENTITY_SINGULAR = {
  issues: "Issue",
  machines: "Machine",
  users: "User",
  locations: "Location",
} as const;

/**
 * Metadata field keys used in Supabase user metadata
 * Centralizes string constants to prevent typos and ensure consistency
 */
export const METADATA_KEYS = {
  /** Organization ID field in user app_metadata */
  ORGANIZATION_ID: "organizationId",
  /** User role field in user app_metadata */
  ROLE: "role",
} as const;

/**
 * Type definitions for entity types
 */
export type EntityType = keyof typeof ENTITY_ICONS;
export type MetadataKey = (typeof METADATA_KEYS)[keyof typeof METADATA_KEYS];

/**
 * Utility function to get entity display information
 */
export function getEntityInfo(entityType: EntityType): {
  icon: (typeof ENTITY_ICONS)[EntityType];
  colors: string;
  name: string;
  singular: string;
} {
  // ESLint security warnings are false positive - entityType parameter is strictly
  // typed as EntityType union ("issues" | "machines" | "users" | "locations")
  // making object access safe with these controlled keys
  // eslint-disable-next-line security/detect-object-injection
  const icon = ENTITY_ICONS[entityType];
  // eslint-disable-next-line security/detect-object-injection
  const colors = ENTITY_COLORS[entityType];
  // eslint-disable-next-line security/detect-object-injection
  const name = ENTITY_NAMES[entityType];
  // eslint-disable-next-line security/detect-object-injection
  const singular = ENTITY_SINGULAR[entityType];

  return {
    icon,
    colors,
    name,
    singular,
  };
}
