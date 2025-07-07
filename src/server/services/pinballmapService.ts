/**
 * PinballMap synchronization service
 * Core business logic for syncing games between PinballMap and our database
 *
 * Game Title Logic:
 * - OPDB games (with opdbId): Global records shared across all organizations
 * - Custom games (no opdbId): Per-organization records, unique by name + organizationId
 * - GameInstances: Always organization-specific through room hierarchy
 */

import type { PrismaClient } from '@prisma/client';
import { fetchLocationMachineDetails } from '../../lib/pinballmap/client';
import type {
  PinballMapMachine,
  PinballMapMachineDetailsResponse
} from '../../lib/pinballmap/types';

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
  locationId: string
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
        error: 'Location not found',
      };
    }

    if (!location.pinballMapId) {
      return {
        success: false,
        added: 0,
        removed: 0,
        error: 'Location does not have a PinballMap ID configured',
      };
    }

    // 2. Find the Main Floor room for this location
    const mainFloorRoom = await prisma.room.findFirst({
      where: {
        locationId: location.id,
        name: 'Main Floor',
      },
    });

    if (!mainFloorRoom) {
      return {
        success: false,
        added: 0,
        removed: 0,
        error: 'Main Floor room not found for location',
      };
    }

    // 3. Fetch machine data from PinballMap
    const machineData = await fetchLocationMachineDetails(location.pinballMapId);

    // 4. Validate the response structure
    if (!machineData || !Array.isArray(machineData.machines)) {
      return {
        success: false,
        added: 0,
        removed: 0,
        error: 'PinballMap API returned invalid data. Please contact support if this persists.',
      };
    }

    // 5. Reconcile the games
    const result = await reconcileGameInstances(
      prisma,
      mainFloorRoom.id,
      location.organizationId,
      machineData.machines
    );

    return {
      success: true,
      added: result.added,
      removed: result.removed,
    };
  } catch (error) {
    // Provide specific error messages for different failure types
    let errorMessage = 'Unknown error occurred during sync';

    if (error instanceof Error) {
      if (error.message.includes('fetch') || error.message.includes('Network')) {
        errorMessage = 'PinballMap API is currently unavailable. Please try again later.';
      } else if (error.message.includes('Invalid response') || error.message.includes('malformed')) {
        errorMessage = 'PinballMap API returned invalid data. Please contact support if this persists.';
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
  roomId: string,
  organizationId: string
): Promise<ProcessResult> {
  try {
    let created = 0;

    for (const machine of fixtureData.machines) {
      // Create or update game title
      const gameTitle = await createOrUpdateGameTitle(prisma, machine, organizationId);

      // Create game instance
      await prisma.gameInstance.create({
        data: {
          name: gameTitle.name,
          gameTitleId: gameTitle.id,
          roomId: roomId,
        },
      });

      created++;
    }

    return { created };
  } catch (error) {
    return {
      created: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reconcile game instances - add new games, remove old ones
 */
export async function reconcileGameInstances(
  prisma: PrismaClient,
  roomId: string,
  organizationId: string,
  remoteMachines: PinballMapMachine[]
): Promise<{ added: number; removed: number }> {
  // Get current game instances in the room
  const localGames = await prisma.gameInstance.findMany({
    where: { roomId },
    include: { gameTitle: true },
  });

  // Create sets of OPDB IDs for comparison
  const remoteOpdbIds = new Set(
    remoteMachines
      .map(m => m.opdb_id)
      .filter(Boolean) // Remove null/undefined values
  );

  // For local games, we need to check OPDB games
  const localOpdbIds = new Set(
    localGames
      .filter(g => g.gameTitle.opdbId)
      .map(g => g.gameTitle.opdbId)
  );

  // Determine which games to remove
  // Remove games that have OPDB IDs but are not in the remote list
  const gamesToRemove = localGames.filter(lg => {
    if (!lg.gameTitle.opdbId) return false; // Don't remove custom games automatically
    return !remoteOpdbIds.has(lg.gameTitle.opdbId);
  });

  // Remove obsolete games
  await prisma.gameInstance.deleteMany({
    where: { id: { in: gamesToRemove.map(g => g.id) } },
  });

  // Determine which games to add (remote games not in local)
  const machinesToAdd = remoteMachines.filter(
    rm => !rm.opdb_id || !localOpdbIds.has(rm.opdb_id)
  );

  // Add new games
  let addedCount = 0;
  for (const machine of machinesToAdd) {
    // Create or update game title
    const gameTitle = await createOrUpdateGameTitle(prisma, machine, organizationId);

    // Create game instance
    await prisma.gameInstance.create({
      data: {
        name: gameTitle.name,
        gameTitleId: gameTitle.id,
        roomId: roomId,
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
export async function createOrUpdateGameTitle(
  prisma: PrismaClient,
  machine: PinballMapMachine,
  organizationId: string
) {
  // Handle OPDB games vs custom games differently
  if (machine.opdb_id) {
    // OPDB games are global - check if it exists first
    const existingGameTitle = await prisma.gameTitle.findUnique({
      where: { opdbId: machine.opdb_id },
    });

    if (existingGameTitle) {
      // Update existing global OPDB game
      return await prisma.gameTitle.update({
        where: { opdbId: machine.opdb_id },
        data: {
          name: machine.name,
          // Update other OPDB fields if needed
        },
      });
    } else {
      // Create new global OPDB game
      return await prisma.gameTitle.create({
        data: {
          name: machine.name,
          opdbId: machine.opdb_id,
          // Global OPDB games have no organization (null)
          // Could add more fields like manufacturer, year if needed
        },
      });
    }
  } else {
    // Custom games are per-organization - use the compound unique constraint
    return await prisma.gameTitle.upsert({
      where: {
        unique_custom_game_per_org: {
          name: machine.name,
          organizationId: organizationId,
        },
      },
      update: {
        name: machine.name,
      },
      create: {
        name: machine.name,
        opdbId: null, // Custom games have no OPDB ID
        organizationId: organizationId,
      },
    });
  }
}
