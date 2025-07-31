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
  const regex = /^G([a-zA-Z0-9]+)(?:-M([a-zA-Z0-9]+)(?:-A([a-zA-Z0-9]+))?)?$/;
  const match = regex.exec(opdbId);

  if (!match) return null;

  return {
    groupId: match[1] ?? "",
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
    return machine.images[0] ?? null;
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
 * Extract backbox/backglass image URL from OPDB machine data
 * Prioritizes backglass > cabinet > playfield for card backgrounds
 */
export function getBackboxImageUrl(machine: OPDBMachine): string | null {
  // If machine has extended details with specific image types
  const extendedMachine = machine as OPDBMachine & {
    playfield_image?: string;
    backglass_image?: string;
    cabinet_image?: string;
  };

  // Prioritize backglass image for backbox display
  if (extendedMachine.backglass_image) {
    return extendedMachine.backglass_image;
  }
  if (extendedMachine.cabinet_image) {
    return extendedMachine.cabinet_image;
  }
  if (extendedMachine.playfield_image) {
    return extendedMachine.playfield_image;
  }

  // Fallback to generic images array
  if (machine.images && machine.images.length > 0) {
    return machine.images[0] ?? null;
  }

  return null;
}

/**
 * Format machine name for display
 */
export function formatMachineName(machine: OPDBMachine): string {
  let name = machine.name;

  // Extract manufacturer name - handle both string and object formats
  const getManufacturerName = (manufacturer: unknown): string | null => {
    if (typeof manufacturer === "string") return manufacturer;
    if (typeof manufacturer === "object" && manufacturer !== null) {
      const mfgObj = manufacturer as { name?: string; full_name?: string };
      return mfgObj.name ?? mfgObj.full_name ?? null;
    }
    return null;
  };

  // Extract year - handle both year field and manufacture_date
  const getYearValue = (machine: OPDBMachine): string | null => {
    // Try the year field first
    if (typeof machine.year === "number") return machine.year.toString();
    if (typeof machine.year === "string") return machine.year;

    // Try manufacture_date field (OPDB format: "2012-01-01")
    const machineWithDate = machine as OPDBMachine & {
      manufacture_date?: string;
    };
    if (machineWithDate.manufacture_date) {
      const year = machineWithDate.manufacture_date.split("-")[0];
      return year ?? null;
    }

    return null;
  };

  const manufacturerName = getManufacturerName(machine.manufacturer);
  const yearValue = getYearValue(machine);

  if (manufacturerName && yearValue) {
    name += ` (${manufacturerName}, ${yearValue})`;
  } else if (manufacturerName) {
    name += ` (${manufacturerName})`;
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
