/**
 * Pure transformation functions for PinballMap API data
 * Extracted from PinballMapService for better testability and performance
 */

import type { PinballMapMachine } from "../pinballmap/types";

/**
 * Model data that can be created from PinballMap machine data
 */
export interface ModelCreateData {
  name: string;
  manufacturer?: string;
  year?: number;
  opdbId?: string;
  ipdbId?: string;
  machineType?: string;
  machineDisplay?: string;
  isActive: boolean;
  ipdbLink?: string;
  opdbImgUrl?: string;
  kineticistUrl?: string;
  isCustom: boolean;
}

/**
 * Result of model lookup operations
 */
export interface ModelLookupResult {
  found: boolean;
  searchBy: "opdb" | "ipdb" | "none";
  model?: { id: string; name: string };
}

/**
 * Machine matching result
 */
export interface MachineMatchResult {
  existingMachineId: string | undefined;
  shouldUpdate: boolean;
  isNewMachine: boolean;
}

/**
 * Transform PinballMap machine data to Model creation data
 * Pure function that handles all field mapping and defaults
 */
export function transformPinballMapMachineToModel(
  pmMachine: PinballMapMachine,
): ModelCreateData {
  return {
    name: pmMachine.machine_name ?? pmMachine.name,
    ...(pmMachine.manufacturer && { manufacturer: pmMachine.manufacturer }),
    ...(pmMachine.year && { year: pmMachine.year }),

    // Cross-database references
    ...(pmMachine.opdb_id && { opdbId: pmMachine.opdb_id }),
    ...(pmMachine.ipdb_id && { ipdbId: pmMachine.ipdb_id.toString() }),

    // Technical details
    ...(pmMachine.machine_type && { machineType: pmMachine.machine_type }),
    ...(pmMachine.machine_display && {
      machineDisplay: pmMachine.machine_display,
    }),
    isActive: pmMachine.is_active ?? true,

    // Metadata and links
    ...(pmMachine.ipdb_link && { ipdbLink: pmMachine.ipdb_link }),
    ...(pmMachine.opdb_img && { opdbImgUrl: pmMachine.opdb_img }),
    ...(pmMachine.kineticist_url && {
      kineticistUrl: pmMachine.kineticist_url,
    }),

    // PinPoint-specific
    isCustom: false, // OPDB games are not custom
  };
}

/**
 * Determine the search strategy for finding an existing model
 * Returns the order of database lookups to perform
 */
export function getModelLookupStrategy(
  pmMachine: PinballMapMachine,
): { type: "opdb" | "ipdb"; value: string }[] {
  const lookups: { type: "opdb" | "ipdb"; value: string }[] = [];

  // OPDB ID has priority (more reliable for pinball machines)
  if (pmMachine.opdb_id) {
    lookups.push({ type: "opdb", value: pmMachine.opdb_id });
  }

  // IPDB ID as fallback
  if (pmMachine.ipdb_id) {
    lookups.push({ type: "ipdb", value: pmMachine.ipdb_id.toString() });
  }

  return lookups;
}

/**
 * Validate that PinballMap machine data has required fields
 * Returns validation errors or null if valid
 */
export function validatePinballMapMachine(pmMachine: unknown): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!pmMachine || typeof pmMachine !== "object") {
    return { isValid: false, errors: ["Machine data must be an object"] };
  }

  const machine = pmMachine as Partial<PinballMapMachine>;

  // Required fields - check both possible name fields
  const hasValidName =
    (machine.machine_name && typeof machine.machine_name === "string") ??
    (machine.name && typeof machine.name === "string");
  if (!hasValidName) {
    errors.push("machine_name or name is required and must be a string");
  }

  // At least one ID should be present
  if (!machine.opdb_id && !machine.ipdb_id) {
    errors.push("Either opdb_id or ipdb_id must be present");
  }

  // Type validation for optional numeric fields
  if (
    machine.year !== undefined &&
    (typeof machine.year !== "number" ||
      machine.year < 1900 ||
      machine.year > new Date().getFullYear() + 2)
  ) {
    errors.push(
      "year must be a valid number between 1900 and current year + 2",
    );
  }

  // Type validation for boolean fields
  if (
    machine.is_active !== undefined &&
    typeof machine.is_active !== "boolean"
  ) {
    errors.push("is_active must be a boolean");
  }

  // URL validation for links
  const urlFields = ["ipdb_link", "opdb_img", "kineticist_url"] as const;
  for (const field of urlFields) {
    const value = machine[field];
    if (value !== undefined && value !== null) {
      if (typeof value !== "string") {
        errors.push(`${field} must be a string`);
      } else if (value && !isValidUrl(value)) {
        errors.push(`${field} must be a valid URL`);
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Find matching machine in current location machines by model
 * Pure function for machine reconciliation logic
 */
export function findMatchingMachine(
  modelId: string,
  currentMachines: { id: string; modelId: string }[],
): MachineMatchResult {
  const existingMachine = currentMachines.find((m) => m.modelId === modelId);

  return {
    existingMachineId: existingMachine?.id,
    isNewMachine: !existingMachine,
    shouldUpdate: false, // Currently no updatable fields from PinballMap
  };
}

/**
 * Calculate sync statistics for machine reconciliation
 * Pure function that determines what operations need to be performed
 */
export function calculateSyncOperations(
  pinballMapMachines: PinballMapMachine[],
  currentMachines: { id: string; modelId: string }[],
  foundModels: Map<string, { id: string; name: string }>, // pmMachine.opdb_id -> model
): {
  toAdd: { pmMachine: PinballMapMachine; modelId: string }[];
  toUpdate: { machineId: string; pmMachine: PinballMapMachine }[];
  candidatesForRemoval: string[]; // machine IDs not found on PinballMap
} {
  const toAdd: { pmMachine: PinballMapMachine; modelId: string }[] = [];
  const toUpdate: { machineId: string; pmMachine: PinballMapMachine }[] = [];
  const foundMachineIds = new Set<string>();

  // Process PinballMap machines
  for (const pmMachine of pinballMapMachines) {
    const model = foundModels.get(
      pmMachine.opdb_id ?? pmMachine.ipdb_id?.toString() ?? "",
    );
    if (!model) continue; // Skip if model couldn't be found/created

    const matchResult = findMatchingMachine(model.id, currentMachines);

    if (matchResult.isNewMachine) {
      toAdd.push({ pmMachine, modelId: model.id });
    } else if (matchResult.shouldUpdate && matchResult.existingMachineId) {
      toUpdate.push({
        machineId: matchResult.existingMachineId,
        pmMachine,
      });
      foundMachineIds.add(matchResult.existingMachineId);
    } else if (matchResult.existingMachineId) {
      foundMachineIds.add(matchResult.existingMachineId);
    }
  }

  // Find machines to potentially remove
  const candidatesForRemoval = currentMachines
    .filter((m) => !foundMachineIds.has(m.id))
    .map((m) => m.id);

  return {
    toAdd,
    toUpdate,
    candidatesForRemoval,
  };
}

/**
 * Generate a machine name from model data
 * Pure function for consistent machine naming
 */
export function generateMachineName(
  modelName: string,
  instanceNumber?: number,
): string {
  if (instanceNumber && instanceNumber > 1) {
    return `${modelName} #${instanceNumber.toString()}`;
  }
  return modelName;
}

/**
 * Helper function to validate URLs
 * Private utility for validation
 */
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract machine creation data for database insertion
 * Pure function that prepares data for Drizzle create operations
 */
export function prepareMachineCreateData(
  modelId: string,
  organizationId: string,
  locationId: string,
  modelName: string,
): {
  name: string;
  organizationId: string;
  locationId: string;
  modelId: string;
} {
  return {
    name: generateMachineName(modelName),
    organizationId,
    locationId,
    modelId,
  };
}
