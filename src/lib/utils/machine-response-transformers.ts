/**
 * Specialized transformation utilities for machine API responses.
 *
 * This module provides specialized transformers for converting machine and location
 * objects from snake_case database results to camelCase API responses. These transformers
 * handle complex nested structures, arrays, and special fields like QR codes and
 * notification settings.
 *
 * @example
 * ```typescript
 * // Transform a single machine with relations
 * const machineFromDb = {
 *   id: 'machine_123',
 *   name: 'Medieval Madness',
 *   qr_code_id: 'qr_456',
 *   model: { machine_type: 'pinball' },
 *   owner: { profile_picture: 'avatar.jpg' }
 * };
 * const apiResponse = transformMachineResponse(machineFromDb);
 * // { id: 'machine_123', name: 'Medieval Madness', qrCodeId: 'qr_456', ... }
 *
 * // Transform an array of machines
 * const machinesFromDb = [{ id: 'machine_1', qr_code_id: 'qr_1' }];
 * const apiResponse = transformMachinesResponse(machinesFromDb);
 * ```
 */

import {
  transformKeysToCamelCase,
  transformKeysToSnakeCase,
} from "./case-transformers";
import type { MachineResponse, LocationResponse, MachineForIssues } from "~/lib/types/api";

/**
 * NOTE: MachineResponse, LocationResponse, MachineForIssues types are now defined in ~/lib/types/api.ts
 * Import from there for consistent type definitions across the codebase.
 */

export interface MachineWithRelations extends MachineResponse {
  model: NonNullable<MachineResponse["model"]>;
  location: NonNullable<MachineResponse["location"]>;
}

export interface LocationWithMachines extends LocationResponse {
  machines: MachineResponse[];
}

/**
 * Transforms a machine object with model, location, owner relations and notification settings.
 * Handles snake_case to camelCase conversion for complex machine objects with nested relations.
 *
 * @param machine - Raw machine object from database with snake_case fields
 * @returns Transformed machine object with camelCase fields
 *
 * @example
 * ```typescript
 * const dbMachine = {
 *   id: 'machine_123',
 *   qr_code_id: 'qr_456',
 *   owner_notifications_enabled: true,
 *   model: { machine_type: 'pinball' },
 *   owner: { profile_picture: 'avatar.jpg' }
 * };
 * const apiMachine = transformMachineResponse(dbMachine);
 * // { id: 'machine_123', qrCodeId: 'qr_456', ownerNotificationsEnabled: true, ... }
 * ```
 */
export function transformMachineResponse(machine: unknown): MachineResponse {
  if (!machine || typeof machine !== "object") {
    throw new Error("Machine data must be an object");
  }

  return transformKeysToCamelCase(
    machine as Record<string, unknown>,
  ) as MachineResponse;
}

/**
 * Transforms an array of machine objects for machine list endpoints.
 * Efficiently handles transformation of multiple machines with their relations.
 *
 * @param machines - Array of raw machine objects from database
 * @returns Array of transformed machine objects with camelCase fields
 *
 * @example
 * ```typescript
 * const dbMachines = [
 *   { id: 'machine_1', qr_code_id: 'qr_1', notify_on_new_issues: true },
 *   { id: 'machine_2', qr_code_id: 'qr_2', notify_on_status_changes: false }
 * ];
 * const apiMachines = transformMachinesResponse(dbMachines);
 * ```
 */
export function transformMachinesResponse(
  machines: unknown,
): MachineResponse[] {
  if (!Array.isArray(machines)) {
    throw new Error("Machines data must be an array");
  }

  return machines.map((machine) => transformMachineResponse(machine));
}

/**
 * Transforms a location object with machines array and _count objects.
 * Handles complex location structures with nested machine arrays and count metadata.
 *
 * @param location - Raw location object from database with snake_case fields
 * @returns Transformed location object with camelCase fields
 *
 * @example
 * ```typescript
 * const dbLocation = {
 *   id: 'location_123',
 *   organization_id: 'org_456',
 *   pinball_map_id: 789,
 *   _count: { machines: 5 },
 *   machines: [{ id: 'machine_1', qr_code_id: 'qr_1' }]
 * };
 * const apiLocation = transformLocationResponse(dbLocation);
 * ```
 */
export function transformLocationResponse(location: unknown): LocationResponse {
  if (!location || typeof location !== "object") {
    throw new Error("Location data must be an object");
  }

  const transformed = transformKeysToCamelCase(
    location as Record<string, unknown>,
  ) as LocationResponse;

  // Handle nested machines array if present
  if ("machines" in transformed) {
    const locationWithMachines = transformed as unknown as LocationResponse;
    if (Array.isArray(locationWithMachines.machines)) {
      locationWithMachines.machines = transformMachinesResponse(
        locationWithMachines.machines,
      );
    }
  }

  return transformed;
}

/**
 * Transforms an array of location objects for location list endpoints.
 * Efficiently handles transformation of multiple locations with their nested machines.
 *
 * @param locations - Array of raw location objects from database
 * @returns Array of transformed location objects with camelCase fields
 *
 * @example
 * ```typescript
 * const dbLocations = [
 *   { id: 'location_1', pinball_map_id: 123, machines: [...] },
 *   { id: 'location_2', organization_id: 'org_456', _count: { machines: 3 } }
 * ];
 * const apiLocations = transformLocationsResponse(dbLocations);
 * ```
 */
export function transformLocationsResponse(
  locations: unknown,
): LocationResponse[] {
  if (!Array.isArray(locations)) {
    throw new Error("Locations data must be an array");
  }

  return locations.map((location) => transformLocationResponse(location));
}

/**
 * Transforms a simplified machine object for issue reporting endpoints.
 * Handles minimal machine data used in issue forms and public endpoints.
 *
 * @param machine - Raw machine object with minimal fields for issues
 * @returns Transformed machine object for issue contexts
 *
 * @example
 * ```typescript
 * const dbMachine = {
 *   id: 'machine_123',
 *   name: 'Medieval Madness',
 *   model: { name: 'Medieval Madness (Williams 1997)' }
 * };
 * const apiMachine = transformMachineForIssuesResponse(dbMachine);
 * ```
 */
export function transformMachineForIssuesResponse(
  machine: Record<string, unknown>,
): MachineForIssues {
  return transformKeysToCamelCase(machine) as MachineForIssues;
}

/**
 * Transforms an array of simplified machine objects for issue reporting.
 * Used by public endpoints that provide machine lists for issue submission.
 *
 * @param machines - Array of simplified machine objects
 * @returns Array of transformed machines for issue contexts
 */
export function transformMachinesForIssuesResponse(
  machines: unknown,
): MachineForIssues[] {
  if (!Array.isArray(machines)) {
    throw new Error("Machines data must be an array");
  }

  return machines.map((machine) => {
    if (!machine || typeof machine !== "object") {
      throw new Error("Machine data must be an object");
    }
    return transformMachineForIssuesResponse(
      machine as Record<string, unknown>,
    );
  });
}

/**
 * Utility function to convert API request data from camelCase to snake_case.
 * Used when processing incoming API requests that need to be converted to database format.
 *
 * @param data - API request data with camelCase fields
 * @returns Data converted to snake_case for database operations
 *
 * @example
 * ```typescript
 * const apiRequest = {
 *   machineId: 'machine_123',
 *   locationId: 'location_456',
 *   ownerNotificationsEnabled: true
 * };
 * const dbData = transformApiRequestToDb(apiRequest);
 * // { machine_id: 'machine_123', location_id: 'location_456', owner_notifications_enabled: true }
 * ```
 */
export function transformApiRequestToDb(
  data: Record<string, unknown>,
): Record<string, unknown> {
  return transformKeysToSnakeCase(data) as Record<string, unknown>;
}

// Removed redundant type-safe transformers - use the base functions instead
// transformMachineResponse and transformLocationResponse already provide type safety

/**
 * Convenience function for transforming any database result to API response format.
 * Generic transformer that can handle any type of database result.
 *
 * @param data - Any database result object or array
 * @returns Transformed data with camelCase keys
 */
export function transformDbResultToApiResponse(data: unknown): unknown {
  return transformKeysToCamelCase(data);
}

/**
 * Alias for transformApiRequestToDb for backwards compatibility.
 * Use transformApiRequestToDb for new code.
 */
export const transformApiRequestToDbFormat = transformApiRequestToDb;
