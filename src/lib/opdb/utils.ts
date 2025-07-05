/**
 * OPDB Utilities
 *
 * Helper functions for working with OPDB data
 */

import type { OPDBParsedId, OPDBMachine } from "./types";

/**
 * Parse OPDB ID format: G43W4-MrRpw-A1B7O
 * - G43W4 = Group ID (mandatory, starts with 'G')
 * - MrRpw = Machine ID (optional, starts with 'M')
 * - A1B7O = Alias ID (optional, starts with 'A')
 */
export function parseOPDBId(opdbId: string): OPDBParsedId | null {
  const regex = /^G([a-zA-Z0-9]+)(?:-([a-zA-Z0-9]+)(?:-([a-zA-Z0-9]+))?)?$/;
  const match = regex.exec(opdbId);

  if (!match) return null;

  return {
    groupId: match[1]!,
    machineId: match[2] ?? undefined,
    aliasId: match[3] ?? undefined,
  };
}

/**
 * Validate OPDB ID format
 */
export function isValidOPDBId(opdbId: string): boolean {
  return parseOPDBId(opdbId) !== null;
}

/**
 * Extract group ID from OPDB ID
 */
export function getGroupIdFromOPDBId(opdbId: string): string | null {
  const parsed = parseOPDBId(opdbId);
  return parsed ? parsed.groupId : null;
}

/**
 * Build OPDB ID from components
 */
export function buildOPDBId(
  groupId: string,
  machineId?: string,
  aliasId?: string,
): string {
  let id = `G${groupId}`;
  if (machineId) {
    id += `-${machineId}`;
  }
  if (aliasId) {
    id += `-${aliasId}`;
  }
  return id;
}

/**
 * Extract image URL from OPDB machine data
 * Prioritizes playfield > backglass > cabinet
 */
export function getPreferredImageUrl(machine: OPDBMachine): string | null {
  if (machine.images && machine.images.length > 0) {
    return machine.images[0]!;
  }

  // If machine has extended details with specific image types
  const extendedMachine = machine as OPDBMachine & {
    playfield_image?: string;
    backglass_image?: string;
    cabinet_image?: string;
  };
  if (extendedMachine.playfield_image) {
    return extendedMachine.playfield_image;
  }
  if (extendedMachine.backglass_image) {
    return extendedMachine.backglass_image;
  }
  if (extendedMachine.cabinet_image) {
    return extendedMachine.cabinet_image;
  }

  return null;
}

/**
 * Format machine name for display
 */
export function formatMachineName(machine: OPDBMachine): string {
  let name = machine.name;

  // Handle year field - extract numeric year if it's an object
  const getYearValue = (year: unknown): string | null => {
    if (typeof year === "number") return year.toString();
    if (typeof year === "string") return year;
    if (typeof year === "object" && year !== null) {
      // Handle cases where year might be an object with a value property
      const yearObj = year as {
        value?: number | string;
        year?: number | string;
      };
      return yearObj.value?.toString() ?? yearObj.year?.toString() ?? null;
    }
    return null;
  };

  const yearValue = getYearValue(machine.year);

  if (machine.manufacturer && yearValue) {
    name += ` (${machine.manufacturer}, ${yearValue})`;
  } else if (machine.manufacturer) {
    name += ` (${machine.manufacturer})`;
  } else if (yearValue) {
    name += ` (${yearValue})`;
  }

  return name;
}

/**
 * Clean and normalize machine description
 */
export function normalizeDescription(description?: string): string | null {
  if (!description) return null;

  // Remove excessive whitespace and normalize
  return description.trim().replace(/\s+/g, " ");
}

/**
 * Generate cache key for OPDB data
 */
export function generateCacheKey(
  endpoint: string,
  params: Record<string, unknown> = {},
): string {
  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join("&");

  return `opdb:${endpoint}${paramString ? `:${paramString}` : ""}`;
}

/**
 * Check if OPDB data is stale and needs refresh
 */
export function isDataStale(
  lastSynced: Date | null,
  maxAgeHours = 24,
): boolean {
  if (!lastSynced) return true;

  const now = new Date();
  const ageHours = (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60);

  return ageHours > maxAgeHours;
}
