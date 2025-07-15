/**
 * PinballMap synchronization service
 * Core business logic for syncing games between PinballMap and our database
 *
 * Game Title Logic:
 * - OPDB games (with opdbId): Global records shared across all organizations
 * - Custom games (no opdbId): Per-organization records, unique by name + organizationId
 * - Machines: Always organization-specific through room hierarchy
 */

import type {
  PinballMapMachine,
  PinballMapMachineDetailsResponse,
} from "../../lib/pinballmap/types";
import type { PrismaClient } from "@prisma/client";

export interface SyncResult {
  success: boolean;
  added: number;
  removed: number;
  error?: string;
}

export interface ProcessResult {
  created: number;
  error?: string;
}

/**
 * Main sync function - syncs a location's games with PinballMap data
 */
export async function syncLocationGames(
  prisma: PrismaClient,
  locationId: string,
): Promise<SyncResult> {
  try {
    // 1. Find the location and validate it has a PinballMap ID
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return {
        success: false,
        added: 0,
        removed: 0,
        error: "Location not found",
      };
    }

    // IMPORTANT: PinballMap integration is currently non-functional due to V1.0 schema changes
    // The Location model no longer has pinballMapId field required for PinballMap sync
    // This entire service will be completely redesigned in Task 10: Redesign PinballMap Integration
    // See: docs/backend_impl_tasks/10-redesign-pinballmap-integration.md
    // Until then, this function returns an error to prevent silent failures
    return {
      success: false,
      added: 0,
      removed: 0,
      error: "PinballMap sync functionality needs to be updated for new schema",
    };
  } catch (error) {
    // Provide specific error messages for different failure types
    let errorMessage = "Unknown error occurred during sync";

    if (error instanceof Error) {
      if (
        error.message.includes("fetch") ||
        error.message.includes("Network")
      ) {
        errorMessage =
          "PinballMap API is currently unavailable. Please try again later.";
      } else if (
        error.message.includes("Invalid response") ||
        error.message.includes("malformed")
      ) {
        errorMessage =
          "PinballMap API returned invalid data. Please contact support if this persists.";
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      added: 0,
      removed: 0,
      error: errorMessage,
    };
  }
}

/**
 * Process fixture data for seeding (instead of calling live API)
 */
export async function processFixtureData(
  prisma: PrismaClient,
  fixtureData: PinballMapMachineDetailsResponse,
  locationId: string,
  organizationId: string,
): Promise<ProcessResult> {
  try {
    let created = 0;

    for (const machine of fixtureData.machines) {
      // Create or update game title
      const model = await createOrUpdateModel(prisma, machine, organizationId);

      // Create game instance
      await prisma.machine.create({
        data: {
          organizationId: organizationId,
          modelId: model.id,
          locationId: locationId,
        },
      });

      created++;
    }

    return { created };
  } catch (error) {
    return {
      created: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reconcile machines - add new machines, remove old ones
 */
export async function reconcileMachines(
  prisma: PrismaClient,
  locationId: string,
  organizationId: string,
  remoteMachines: PinballMapMachine[],
): Promise<{ added: number; removed: number }> {
  // Get current game instances in the room
  const localGames = await prisma.machine.findMany({
    where: { locationId },
    include: { model: true },
  });

  // Create sets of OPDB IDs for comparison
  const remoteOpdbIds = new Set(
    remoteMachines.map((m) => m.opdb_id).filter(Boolean), // Remove null/undefined values
  );

  // For local games, we need to check OPDB games
  const localOpdbIds = new Set(
    localGames.filter((g) => g.model.opdbId).map((g) => g.model.opdbId),
  );

  // Determine which games to remove
  // Remove games that have OPDB IDs but are not in the remote list
  const gamesToRemove = localGames.filter((lg) => {
    if (!lg.model.opdbId) return false; // Don't remove custom games automatically
    return !remoteOpdbIds.has(lg.model.opdbId);
  });

  // Remove obsolete games
  await prisma.machine.deleteMany({
    where: { id: { in: gamesToRemove.map((g) => g.id) } },
  });

  // Determine which games to add (remote games not in local)
  const machinesToAdd = remoteMachines.filter(
    (rm) => !rm.opdb_id || !localOpdbIds.has(rm.opdb_id),
  );

  // Add new games
  let addedCount = 0;
  for (const machine of machinesToAdd) {
    // Create or update game title
    const model = await createOrUpdateModel(prisma, machine, organizationId);

    // Create game instance
    await prisma.machine.create({
      data: {
        organizationId: organizationId,
        modelId: model.id,
        locationId: locationId,
      },
    });

    addedCount++;
  }

  return {
    added: addedCount,
    removed: gamesToRemove.length,
  };
}

/**
 * Create or update a game title from PinballMap machine data
 */
export async function createOrUpdateModel(
  prisma: PrismaClient,
  machine: PinballMapMachine,
  organizationId: string,
) {
  // Handle OPDB games vs custom games differently
  if (machine.opdb_id) {
    // OPDB games are global - check if it exists first
    const existingModel = await prisma.model.findUnique({
      where: { opdbId: machine.opdb_id },
    });

    if (existingModel) {
      // Update existing global OPDB game
      return await prisma.model.update({
        where: { opdbId: machine.opdb_id },
        data: {
          name: machine.name,
          // Update other OPDB fields if needed
        },
      });
    } else {
      // Create new global OPDB game
      return await prisma.model.create({
        data: {
          name: machine.name,
          opdbId: machine.opdb_id,
          // Global OPDB games have no organization (null)
          // Could add more fields like manufacturer, year if needed
        },
      });
    }
  } else {
    // Custom games - in new schema, they are global but marked as custom
    // TODO: Need to redesign custom game handling without organizationId
    return await prisma.model.upsert({
      where: {
        name: machine.name, // Simplified for now - may create duplicates
      },
      update: {
        name: machine.name,
      },
      create: {
        name: machine.name,
        opdbId: null, // Custom games have no OPDB ID
        isCustom: true, // Mark as custom game
      },
    });
  }
}
