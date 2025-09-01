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
 * Type definitions for entity types
 */
export type EntityType = keyof typeof ENTITY_ICONS;

/**
 * Utility function to get entity display information
 */
export function getEntityInfo(entityType: EntityType) {
  return {
    icon: ENTITY_ICONS[entityType],
    colors: ENTITY_COLORS[entityType],
    name: ENTITY_NAMES[entityType],
    singular: ENTITY_SINGULAR[entityType],
  };
}