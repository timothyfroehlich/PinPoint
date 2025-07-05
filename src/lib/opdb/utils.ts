/**
 * OPDB Utilities
 *
 * Helper functions for working with OPDB data
 */

import type { OPDBParsedId, OPDBMachine } from './types';

/**
 * Parse OPDB ID format: G43W4-MrRpw-A1B7O
 * - G43W4 = Group ID (mandatory, starts with 'G')
 * - MrRpw = Machine ID (optional, starts with 'M')
 * - A1B7O = Alias ID (optional, starts with 'A')
 */
export function parseOPDBId(opdbId: string): OPDBParsedId | null {
  const regex = /^G([a-zA-Z0-9]+)(?:-([a-zA-Z0-9]+)(?:-([a-zA-Z0-9]+))?)?$/;
  const match = opdbId.match(regex);

  if (!match) return null;

  return {
    groupId: match[1]!,
    machineId: match[2] || undefined,
    aliasId: match[3] || undefined,
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
  aliasId?: string
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
  const extendedMachine = machine as any;
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

  if (machine.manufacturer && machine.year) {
    name += ` (${machine.manufacturer}, ${machine.year})`;
  } else if (machine.manufacturer) {
    name += ` (${machine.manufacturer})`;
  } else if (machine.year) {
    name += ` (${machine.year})`;
  }

  return name;
}

/**
 * Clean and normalize machine description
 */
export function normalizeDescription(description?: string): string | null {
  if (!description) return null;

  // Remove excessive whitespace and normalize
  return description.trim().replace(/\s+/g, ' ');
}

/**
 * Generate cache key for OPDB data
 */
export function generateCacheKey(endpoint: string, params: Record<string, any> = {}): string {
  const paramString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  return `opdb:${endpoint}${paramString ? `:${paramString}` : ''}`;
}

/**
 * Check if OPDB data is stale and needs refresh
 */
export function isDataStale(lastSynced: Date | null, maxAgeHours: number = 24): boolean {
  if (!lastSynced) return true;

  const now = new Date();
  const ageHours = (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60);

  return ageHours > maxAgeHours;
}
