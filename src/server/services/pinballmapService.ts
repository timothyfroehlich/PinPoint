/**
 * PinballMap synchronization service for V1.0 schema
 * Handles syncing machine data between PinballMap and PinPoint
 */

import { eq, count } from "drizzle-orm";

import type {
  PinballMapMachine,
  PinballMapMachineDetailsResponse,
} from "~/lib/pinballmap/types";
import type { DrizzleClient } from "~/server/db/drizzle";

import { transformPinballMapMachineToModel } from "~/lib/external/pinballmapTransformer";
import { logger } from "~/lib/logger";
// Drizzle ORM imports
import {
  machines,
  models,
  locations,
  pinballMapConfigs,
  issues,
} from "~/server/db/schema";

export interface SyncResult {
  success: boolean;
  added: number;
  updated: number;
  removed: number;
  error?: string;
}

export class PinballMapService {
  constructor(private db: DrizzleClient) {}

  /**
   * Enable PinballMap integration for organization
   */
  async enableIntegration(organizationId: string): Promise<void> {
    // Generate ID using current timestamp for uniqueness
    const configId = `pmc_${Date.now().toString()}`;

    await this.db
      .insert(pinballMapConfigs)
      .values({
        id: configId,
        organization_id: organizationId,
        api_enabled: true,
        auto_sync_enabled: false, // Start with manual sync
        create_missing_models: true, // Allow creating models for unknown games
        update_existing_data: true, // Allow updating existing data
      })
      .onConflictDoUpdate({
        target: pinballMapConfigs.organization_id,
        set: {
          api_enabled: true,
          create_missing_models: true,
          update_existing_data: true,
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
    const config = await this.db.query.pinballMapConfigs.findFirst({
      where: eq(pinballMapConfigs.organization_id, organizationId),
    });

    if (!config?.api_enabled) {
      throw new Error("PinballMap integration not enabled for organization");
    }

    // Update location with PinballMap configuration
    await this.db
      .update(locations)
      .set({
        pinball_map_id: pinballMapId,
        sync_enabled: true,
      })
      .where(eq(locations.id, locationId));
  }

  /**
   * Sync a specific location with PinballMap
   */
  async syncLocation(locationId: string): Promise<SyncResult> {
    const location = await this.db.query.locations.findFirst({
      where: eq(locations.id, locationId),
      with: {
        organization: {
          with: {
            pinballMapConfig: {
              columns: {
                api_enabled: true,
                create_missing_models: true,
                update_existing_data: true,
              },
            },
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

    if (!location.pinball_map_id) {
      return {
        success: false,
        added: 0,
        updated: 0,
        removed: 0,
        error: "Location not configured for PinballMap sync",
      };
    }

    // Get the PinballMap config - array access since schema defines it as many relationship
    const pinballMapConfig = location.organization.pinballMapConfig[0];
    if (!pinballMapConfig?.api_enabled) {
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
        location.pinball_map_id,
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
        machineData.machines,
        pinballMapConfig,
      );

      // Update last sync time
      await this.db
        .update(locations)
        .set({ last_sync_at: new Date() })
        .where(eq(locations.id, locationId));

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
   * Reconcile PinballMap machines with local database (RLS scoped)
   */
  private async reconcileMachines(
    locationId: string,
    pinballMapMachines: PinballMapMachine[],
    config: { create_missing_models: boolean; update_existing_data: boolean },
  ): Promise<SyncResult> {
    let added = 0;
    let updated = 0;
    let removed = 0;

    // Get location to obtain organizationId
    const location = await this.db.query.locations.findFirst({
      where: eq(locations.id, locationId),
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

    // Get current machines at this location
    const currentMachines = await this.db.query.machines.findMany({
      where: eq(machines.location_id, locationId),
      with: {
        model: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Track which machines we found on PinballMap
    const foundMachineIds = new Set<string>();

    for (const pmMachine of pinballMapMachines) {
      try {
        // Find or create the Model record
        const model = await this.findOrCreateModel(
          pmMachine,
          config.create_missing_models,
        );

        if (!model) {
          continue; // Skip if model creation is disabled and model doesn't exist
        }

        // Find existing machine by model and location
        const existingMachine = currentMachines.find(
          (m) => m.model_id === model.id,
        );

        if (existingMachine) {
          foundMachineIds.add(existingMachine.id);

          if (config.update_existing_data) {
            // Update existing machine if needed
            // For now, machines don't have updatable fields from PinballMap
            // This could be expanded for condition, notes, etc.
            updated++;
          }
        } else {
          // Create new machine (organizationId from location)
          await this.db.insert(machines).values({
            id: `machine_${Date.now().toString()}_${Math.random().toString(36).substring(2, 11)}`,
            name: model.name, // Use model name as default instance name
            organization_id: location.organization_id,
            location_id: locationId,
            model_id: model.id,
            qr_code_id: `qr_${Date.now().toString()}_${Math.random().toString(36).substring(2, 11)}`,
            // ownerId will be null initially
          });
          added++;
        }
      } catch (error) {
        logger.error({
          msg: "Error processing PinballMap machine",
          component: "pinballMapService.syncLocation",
          context: {
            locationId,
            machineOpdbId: pmMachine.opdb_id ?? "unknown",
            operation: "sync_machine",
          },
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
        // Continue processing other machines
      }
    }

    // Remove machines that are no longer on PinballMap
    const machinesToRemove = currentMachines.filter(
      (m) => !foundMachineIds.has(m.id),
    );

    for (const machine of machinesToRemove) {
      // Check if machine has issues before removing
      const [issueCountResult] = await this.db
        .select({ count: count() })
        .from(issues)
        .where(eq(issues.machine_id, machine.id));

      if (issueCountResult?.count === 0) {
        // Only remove machines with no issues
        await this.db.delete(machines).where(eq(machines.id, machine.id));
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
    create_missing_models: boolean,
  ): Promise<{ id: string; name: string } | null> {
    // Look for existing model by OPDB ID
    let model = pmMachine.opdb_id
      ? await this.db.query.models.findFirst({
          where: eq(models.opdb_id, pmMachine.opdb_id),
        })
      : null;

    if (model) {
      return model;
    }

    // Look for existing model by IPDB ID if available
    if (pmMachine.ipdb_id) {
      model = await this.db.query.models.findFirst({
        where: eq(models.ipdb_id, pmMachine.ipdb_id.toString()),
      });

      if (model) {
        return model;
      }
    }

    if (!create_missing_models) {
      return null;
    }

    // Create new global model from PinballMap data using extracted transformer
    try {
      const modelData = transformPinballMapMachineToModel(pmMachine);
      const [newModel] = await this.db
        .insert(models)
        .values({
          id: `model_${Date.now().toString()}_${Math.random().toString(36).substring(2, 11)}`,
          ...modelData,
        })
        .returning({
          id: models.id,
          name: models.name,
        });

      return newModel ?? null;
    } catch (error) {
      // Handle duplicate key errors gracefully
      if (error instanceof Error && error.message.includes("unique")) {
        // Another sync might have created this model
        const fallbackModel = pmMachine.opdb_id
          ? await this.db.query.models.findFirst({
              where: eq(models.opdb_id, pmMachine.opdb_id),
            })
          : null;
        return fallbackModel ?? null;
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
      logger.error({
        msg: "Failed to fetch PinballMap data",
        component: "pinballMapService.fetchPinballMapData",
        context: {
          pinballMapId,
          operation: "api_fetch",
        },
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return null;
    }
  }

  /**
   * Get sync status for all locations in organization (RLS scoped)
   */
  async getOrganizationSyncStatus(organizationId: string): Promise<{
    configEnabled: boolean;
    locations: {
      id: string;
      name: string;
      pinball_map_id: number | null;
      sync_enabled: boolean;
      last_sync_at: Date | null;
      machineCount: number;
    }[];
    lastSync: Date | null;
  }> {
    // Get config for specific organization
    const config = await this.db.query.pinballMapConfigs.findFirst({
      where: eq(pinballMapConfigs.organization_id, organizationId),
    });

    const locationsData = await this.db.query.locations.findMany({
      where: eq(locations.organization_id, organizationId),
      with: {
        machines: {
          columns: { id: true },
        },
      },
    });

    return {
      configEnabled: config?.api_enabled ?? false,
      locations: locationsData.map((location) => ({
        id: location.id,
        name: location.name,
        pinball_map_id: location.pinball_map_id,
        sync_enabled: location.sync_enabled,
        last_sync_at: location.last_sync_at,
        machineCount: location.machines.length,
      })),
      lastSync: config?.last_global_sync ?? null,
    };
  }
}

// Export legacy functions for backward compatibility during transition
export async function syncLocationGames(
  db: DrizzleClient,
  locationId: string,
): Promise<SyncResult> {
  const service = new PinballMapService(db);
  return service.syncLocation(locationId);
}

export async function processFixtureData(
  db: DrizzleClient,
  fixtureData: PinballMapMachineDetailsResponse,
  locationId: string,
): Promise<{ created: number; error?: string }> {
  try {
    // Get location to obtain organizationId
    const location = await db.query.locations.findFirst({
      where: eq(locations.id, locationId),
    });

    if (!location) {
      return { created: 0, error: "Location not found" };
    }

    let created = 0;
    const service = new PinballMapService(db);

    for (const machine of fixtureData.machines) {
      // Create or update model
      const model = await service.findOrCreateModel(machine, true);

      if (model) {
        // Create machine instance with organizationId
        await db.insert(machines).values({
          id: `machine_${Date.now().toString()}_${Math.random().toString(36).substring(2, 11)}`,
          name: model.name, // Use model name as default instance name
          organization_id: location.organization_id,
          model_id: model.id,
          location_id: locationId,
          qr_code_id: `qr_${Date.now().toString()}_${Math.random().toString(36).substring(2, 11)}`,
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
