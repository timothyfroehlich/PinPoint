/**
 * PinballMap synchronization service for V1.0 schema
 * Handles syncing machine data between PinballMap and PinPoint
 */

import { transformPinballMapMachineToModel } from "../../lib/external/pinballmapTransformer";

import type { ExtendedPrismaClient } from "./types";
import type {
  PinballMapMachine,
  PinballMapMachineDetailsResponse,
} from "../../lib/pinballmap/types";

export interface SyncResult {
  success: boolean;
  added: number;
  updated: number;
  removed: number;
  error?: string;
}

export class PinballMapService {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Enable PinballMap integration for an organization
   */
  async enableIntegration(organizationId: string): Promise<void> {
    await this.prisma.pinballMapConfig.upsert({
      where: { organizationId },
      create: {
        organizationId,
        apiEnabled: true,
        autoSyncEnabled: false, // Start with manual sync
      },
      update: {
        apiEnabled: true,
      },
    });
  }

  /**
   * Configure a location for PinballMap sync
   */
  async configureLocationSync(
    locationId: string,
    pinballMapId: number,
    organizationId: string,
  ): Promise<void> {
    // Verify organization has PinballMap enabled
    const config = await this.prisma.pinballMapConfig.findUnique({
      where: { organizationId },
    });

    if (!config?.apiEnabled) {
      throw new Error("PinballMap integration not enabled for organization");
    }

    // Update location with PinballMap configuration
    await this.prisma.location.update({
      where: { id: locationId },
      data: {
        pinballMapId,
        syncEnabled: true,
      },
    });
  }

  /**
   * Sync a specific location with PinballMap
   */
  async syncLocation(locationId: string): Promise<SyncResult> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: {
        organization: {
          include: {
            pinballMapConfig: true,
          },
        },
      },
    });

    if (!location) {
      return {
        success: false,
        added: 0,
        updated: 0,
        removed: 0,
        error: "Location not found",
      };
    }

    if (!location.pinballMapId) {
      return {
        success: false,
        added: 0,
        updated: 0,
        removed: 0,
        error: "Location not configured for PinballMap sync",
      };
    }

    if (!location.organization.pinballMapConfig?.apiEnabled) {
      return {
        success: false,
        added: 0,
        updated: 0,
        removed: 0,
        error: "PinballMap integration not enabled",
      };
    }

    try {
      // Fetch machine data from PinballMap
      const machineData = await this.fetchLocationMachines(
        location.pinballMapId,
      );

      if (!machineData?.machines) {
        return {
          success: false,
          added: 0,
          updated: 0,
          removed: 0,
          error: "No machine data returned from PinballMap",
        };
      }

      // Process the machines
      const result = await this.reconcileMachines(
        location.id,
        location.organizationId,
        machineData.machines,
        location.organization.pinballMapConfig,
      );

      // Update last sync time
      await this.prisma.location.update({
        where: { id: locationId },
        data: { lastSyncAt: new Date() },
      });

      return result;
    } catch (error) {
      return {
        success: false,
        added: 0,
        updated: 0,
        removed: 0,
        error: error instanceof Error ? error.message : "Unknown sync error",
      };
    }
  }

  /**
   * Reconcile PinballMap machines with local database
   */
  private async reconcileMachines(
    locationId: string,
    organizationId: string,
    pinballMapMachines: PinballMapMachine[],
    config: { createMissingModels: boolean; updateExistingData: boolean },
  ): Promise<SyncResult> {
    let added = 0;
    let updated = 0;
    let removed = 0;

    // Get current machines at this location
    const currentMachines = await this.prisma.machine.findMany({
      where: { locationId },
      include: {
        model: true,
      },
    });

    // Track which machines we found on PinballMap
    const foundMachineIds = new Set<string>();

    for (const pmMachine of pinballMapMachines) {
      try {
        // Find or create the Model record
        const model = await this.findOrCreateModel(
          pmMachine,
          config.createMissingModels,
        );

        if (!model) {
          continue; // Skip if model creation is disabled and model doesn't exist
        }

        // Find existing machine by model and location
        const existingMachine = currentMachines.find(
          (m) => m.modelId === model.id,
        );

        if (existingMachine) {
          foundMachineIds.add(existingMachine.id);

          if (config.updateExistingData) {
            // Update existing machine if needed
            // For now, machines don't have updatable fields from PinballMap
            // This could be expanded for condition, notes, etc.
            updated++;
          }
        } else {
          // Create new machine
          await this.prisma.machine.create({
            data: {
              name: model.name, // Use model name as default instance name
              organizationId,
              locationId,
              modelId: model.id,
              // ownerId will be null initially
            },
          });
          added++;
        }
      } catch (error) {
        console.error(
          `Error processing machine ${pmMachine.opdb_id ?? "unknown"}:`,
          error,
        );
        // Continue processing other machines
      }
    }

    // Remove machines that are no longer on PinballMap
    const machinesToRemove = currentMachines.filter(
      (m) => !foundMachineIds.has(m.id),
    );

    for (const machine of machinesToRemove) {
      // Check if machine has issues before removing
      const issueCount = await this.prisma.issue.count({
        where: { machineId: machine.id },
      });

      if (issueCount === 0) {
        // Only remove machines with no issues
        await this.prisma.machine.delete({
          where: { id: machine.id },
        });
        removed++;
      }
    }

    return {
      success: true,
      added,
      updated,
      removed,
    };
  }

  /**
   * Find existing Model or create new one from PinballMap data
   */
  async findOrCreateModel(
    pmMachine: PinballMapMachine,
    createMissingModels: boolean,
  ): Promise<{ id: string; name: string } | null> {
    // Look for existing model by OPDB ID
    let model = pmMachine.opdb_id
      ? await this.prisma.model.findUnique({
          where: { opdbId: pmMachine.opdb_id },
        })
      : null;

    if (model) {
      return model;
    }

    // Look for existing model by IPDB ID if available
    if (pmMachine.ipdb_id) {
      model = await this.prisma.model.findUnique({
        where: { ipdbId: pmMachine.ipdb_id.toString() },
      });

      if (model) {
        return model;
      }
    }

    if (!createMissingModels) {
      return null;
    }

    // Create new global model from PinballMap data using extracted transformer
    try {
      const modelData = transformPinballMapMachineToModel(pmMachine);
      model = await this.prisma.model.create({
        data: modelData,
      });

      return model;
    } catch (error) {
      // Handle duplicate key errors gracefully
      if (error instanceof Error && error.message.includes("unique")) {
        // Another sync might have created this model
        return pmMachine.opdb_id
          ? this.prisma.model.findUnique({
              where: { opdbId: pmMachine.opdb_id },
            })
          : null;
      }
      throw error;
    }
  }

  /**
   * Fetch machine data from PinballMap API
   */
  private async fetchLocationMachines(
    pinballMapId: number,
  ): Promise<PinballMapMachineDetailsResponse | null> {
    try {
      const response = await fetch(
        `https://pinballmap.com/api/v1/locations/${pinballMapId.toString()}/machine_details.json`,
      );

      if (!response.ok) {
        throw new Error(`PinballMap API error: ${response.status.toString()}`);
      }

      const result: unknown = await response.json();
      return result as PinballMapMachineDetailsResponse;
    } catch (error) {
      console.error("Failed to fetch PinballMap data:", error);
      return null;
    }
  }

  /**
   * Get sync status for all locations in an organization
   */
  async getOrganizationSyncStatus(organizationId: string): Promise<{
    configEnabled: boolean;
    locations: {
      id: string;
      name: string;
      pinballMapId: number | null;
      syncEnabled: boolean;
      lastSyncAt: Date | null;
      machineCount: number;
    }[];
  }> {
    const config = await this.prisma.pinballMapConfig.findUnique({
      where: { organizationId },
    });

    const locations = await this.prisma.location.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            machines: true,
          },
        },
      },
    });

    return {
      configEnabled: config?.apiEnabled ?? false,
      locations: locations.map((location) => ({
        id: location.id,
        name: location.name,
        pinballMapId: location.pinballMapId,
        syncEnabled: location.syncEnabled,
        lastSyncAt: location.lastSyncAt,
        machineCount: location._count.machines,
      })),
    };
  }
}

// Export legacy functions for backward compatibility during transition
export async function syncLocationGames(
  prisma: ExtendedPrismaClient,
  locationId: string,
): Promise<SyncResult> {
  const service = new PinballMapService(prisma);
  return service.syncLocation(locationId);
}

export async function processFixtureData(
  prisma: ExtendedPrismaClient,
  fixtureData: PinballMapMachineDetailsResponse,
  locationId: string,
  organizationId: string,
): Promise<{ created: number; error?: string }> {
  try {
    let created = 0;
    const service = new PinballMapService(prisma);

    for (const machine of fixtureData.machines) {
      // Create or update model
      const model = await service.findOrCreateModel(machine, true);

      if (model) {
        // Create machine instance
        await prisma.machine.create({
          data: {
            name: model.name, // Use model name as default instance name
            organizationId: organizationId,
            modelId: model.id,
            locationId: locationId,
          },
        });
        created++;
      }
    }

    return { created };
  } catch (error) {
    return {
      created: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
