# Task 10: Redesign PinballMap Integration for New Schema

## Agent Context

**You are a backend development agent** assigned to implement Task 10: Redesign PinballMap Integration for New Schema. You are working in a coordinated multi-agent environment where multiple agents work in parallel on different backend tasks.

**Your Mission**: Completely redesign the PinballMap integration service with comprehensive schema enhancements based on PinballMap API analysis. This includes geographic data support, cross-database references (IPDB/OPDB), and modern integration architecture.

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

**Multi-Agent Coordination**: This task is part of Phase 3B development. See @MULTI_AGENT_WORKFLOW.md for complete worktree setup, sync procedures, and coordination guidelines.

**FIRST TIME SETUP**: You must run `./scripts/setup-worktree.sh` in your worktree to configure your development environment.

## Workflow

- **Base Branch**: `epic/backend-refactor`
- **Task Branch**: `task/10-redesign-pinballmap-integration`
- **PR Target**: `epic/backend-refactor` (NOT main)
- **Worktree**: `~/Code/PinPoint-worktrees/task-10-redesign-pinballmap-integration/`

## Dependencies

- Task 03 (New Schema) must be completed first
- Independent of other tasks but impacts machine management features

## Objective

Completely redesign the PinballMap integration service to work with the new V1.0 schema. The current service is non-functional due to schema changes that removed the `pinballMapId` field from Location model and renamed GameTitle/GameInstance to Model/Machine.

**Enhanced Scope**: Based on PinballMap API analysis, this task now includes comprehensive schema enhancements to support full PinballMap integration with geographic data, machine metadata, and proper cross-database references (IPDB/OPDB).

## Status

- [ ] In Progress
- [ ] Completed

## Current Issues

### 1. Missing PinballMap Location Linking

`src/server/services/pinballmapService.ts:51`:

- TODO: Location model no longer has pinballMapId field
- Cannot link locations to PinballMap entries
- Sync functionality completely broken

### 2. Broken Sync Implementation

Multiple sync functions are disabled:

- `syncLocationGames()` returns early with error
- `reconcileMachines()` not callable
- All sync operations return hardcoded values

### 3. Model Name Changes

Service still references old model names:

- `GameTitle` → `Model`
- `GameInstance` → `Machine`
- Need complete service rewrite

### 4. Custom Game Handling

`src/server/services/pinballmapService.ts:277`:

- TODO: Need to redesign custom game handling without organizationId
- Model table now global (no organizationId for OPDB games)

## Implementation Steps

### 1. Enhanced Location Model for PinballMap Integration

Based on PinballMap API analysis, enhance Location with geographic and contact data:

```prisma
model Location {
  id             String  @id @default(cuid())
  name           String
  organizationId String

  // Geographic and Contact Information (from PinballMap API analysis)
  street         String?
  city           String?
  state          String?
  zip            String?
  phone          String?
  website        String?
  latitude       Float?
  longitude      Float?
  description    String? @db.Text

  // PinballMap Integration (optional)
  pinballMapId   Int?      // PinballMap location ID
  regionId       String?   // PinballMap region ("austin", "portland", etc.)
  lastSyncAt     DateTime? // When was last sync performed
  syncEnabled    Boolean   @default(false) // Enable/disable sync for this location

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  machines     Machine[]
}
```

### 2. Enhanced Model for Cross-Database Support

Based on PinballMap API analysis, enhance Model with IPDB/OPDB cross-references and machine metadata:

```prisma
model Model {
  id           String  @id @default(cuid())
  name         String
  manufacturer String?
  year         Int?

  // Cross-Database References (both IPDB and OPDB from PinballMap)
  ipdbId       String? @unique     // Internet Pinball Database ID
  opdbId       String? @unique     // Open Pinball Database ID

  // Machine Technical Details (from PinballMap API)
  machineType    String?           // "em", "ss", "digital"
  machineDisplay String?           // "reels", "dmd", "lcd", "alphanumeric"
  isActive       Boolean @default(true)

  // Metadata and Links
  ipdbLink       String?           // Direct link to IPDB entry
  opdbImgUrl     String?           // Image from OPDB
  kineticistUrl  String?           // Link to additional machine information

  // PinPoint-specific
  isCustom       Boolean @default(false) // Flag for custom/homebrew models

  // Relations
  machines Machine[]
}
```

### 3. Create PinballMap Configuration Model

Add configuration model for PinballMap integration:

```prisma
model PinballMapConfig {
  id             String   @id @default(cuid())
  organizationId String   @unique

  // API Configuration
  apiEnabled     Boolean  @default(false)
  apiKey         String?  // If PinballMap requires API key in future

  // Sync Settings
  autoSyncEnabled Boolean @default(false)
  syncIntervalHours Int   @default(24)
  lastGlobalSync DateTime?

  // Data Preferences
  createMissingModels Boolean @default(true) // Create Model records for unknown OPDB games
  updateExistingData  Boolean @default(false) // Whether to update existing machine data

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

### 4. Optional: Machine Condition Tracking (Future Enhancement)

Based on PinballMap's user submission system, consider adding machine condition tracking:

```prisma
model MachineCondition {
  id        String   @id @default(cuid())
  machineId String
  condition String   @db.Text  // User-reported condition
  createdAt DateTime @default(now())
  userId    String?

  machine Machine @relation(fields: [machineId], references: [id], onDelete: Cascade)
  user    User?   @relation(fields: [userId], references: [id])
}

// Add to Machine model:
model Machine {
  // ... existing fields
  conditions MachineCondition[]
}

// Add to User model:
model User {
  // ... existing fields
  machineConditions MachineCondition[]
}
```

**Note**: This is optional for V1.0 but aligns with PinballMap's condition tracking feature.

### 5. Update Organization Model

Add PinballMap config relation:

```prisma
model Organization {
  // ... existing fields

  // Relations
  memberships       Membership[]
  locations         Location[]
  roles             Role[]
  machines          Machine[]
  issues            Issue[]
  priorities        Priority[]
  issueStatuses     IssueStatus[]
  collectionTypes   CollectionType[]
  pinballMapConfig  PinballMapConfig? // Add this line
}
```

### 6. Redesign PinballMapService

Complete rewrite of `src/server/services/pinballmapService.ts`:

```typescript
/**
 * PinballMap synchronization service for V1.0 schema
 * Handles syncing machine data between PinballMap and PinPoint
 */

import type {
  PinballMapMachine,
  PinballMapMachineDetailsResponse,
} from "../../lib/pinballmap/types";
import type { PrismaClient } from "@prisma/client";

export interface SyncResult {
  success: boolean;
  added: number;
  updated: number;
  removed: number;
  error?: string;
}

export interface SyncSummary {
  locationsProcessed: number;
  totalMachines: number;
  newModels: number;
  errors: string[];
}

export class PinballMapService {
  constructor(private prisma: PrismaClient) {}

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
  async configurLocationSync(
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
        let model = await this.findOrCreateModel(
          pmMachine,
          config.createMissingModels,
        );

        if (!model) {
          continue; // Skip if model creation is disabled and model doesn't exist
        }

        // Find existing machine by model and location
        const existingMachine = currentMachines.find(
          (m) => m.modelId === model!.id,
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
              organizationId,
              locationId,
              modelId: model.id,
              // ownerId will be null initially
            },
          });
          added++;
        }
      } catch (error) {
        console.error(`Error processing machine ${pmMachine.opdb_id}:`, error);
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
  private async findOrCreateModel(
    pmMachine: PinballMapMachine,
    createMissingModels: boolean,
  ): Promise<{ id: string; name: string } | null> {
    // Look for existing model by OPDB ID
    let model = await this.prisma.model.findUnique({
      where: { opdbId: pmMachine.opdb_id },
    });

    if (model) {
      return model;
    }

    if (!createMissingModels) {
      return null;
    }

    // Create new global model from PinballMap data
    try {
      model = await this.prisma.model.create({
        data: {
          name: pmMachine.machine_name,
          manufacturer: pmMachine.manufacturer || null,
          year: pmMachine.year || null,

          // Cross-database references
          opdbId: pmMachine.opdb_id,
          ipdbId: pmMachine.ipdb_id || null,

          // Technical details
          machineType: pmMachine.machine_type || null,
          machineDisplay: pmMachine.machine_display || null,
          isActive: pmMachine.is_active ?? true,

          // Metadata and links
          ipdbLink: pmMachine.ipdb_link || null,
          opdbImgUrl: pmMachine.opdb_img || null,
          kineticistUrl: pmMachine.kineticist_url || null,

          // PinPoint-specific
          isCustom: false, // OPDB games are not custom
        },
      });

      return model;
    } catch (error) {
      // Handle duplicate key errors gracefully
      if (error instanceof Error && error.message.includes("unique")) {
        // Another sync might have created this model
        return this.prisma.model.findUnique({
          where: { opdbId: pmMachine.opdb_id },
        });
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
        `https://pinballmap.com/api/v1/locations/${pinballMapId}/machine_details.json`,
      );

      if (!response.ok) {
        throw new Error(`PinballMap API error: ${response.status}`);
      }

      return response.json();
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
    locations: Array<{
      id: string;
      name: string;
      pinballMapId: number | null;
      syncEnabled: boolean;
      lastSyncAt: Date | null;
      machineCount: number;
    }>;
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
```

### 7. Create PinballMap tRPC Router

Create `src/server/api/routers/pinballMap.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { PinballMapService } from "~/server/services/pinballmapService";

export const pinballMapRouter = createTRPCRouter({
  // Enable PinballMap integration for organization
  enableIntegration: organizationManageProcedure.mutation(async ({ ctx }) => {
    const service = new PinballMapService(ctx.db);
    await service.enableIntegration(ctx.organization.id);
    return { success: true };
  }),

  // Configure location for sync
  configureLocation: organizationManageProcedure
    .input(
      z.object({
        locationId: z.string(),
        pinballMapId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = new PinballMapService(ctx.db);
      await service.configurLocationSync(
        input.locationId,
        input.pinballMapId,
        ctx.organization.id,
      );
      return { success: true };
    }),

  // Sync a specific location
  syncLocation: organizationManageProcedure
    .input(z.object({ locationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new PinballMapService(ctx.db);
      const result = await service.syncLocation(input.locationId);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Sync failed",
        });
      }

      return result;
    }),

  // Get sync status for organization
  getSyncStatus: organizationManageProcedure.query(async ({ ctx }) => {
    const service = new PinballMapService(ctx.db);
    return service.getOrganizationSyncStatus(ctx.organization.id);
  }),
});
```

### 8. Update Main tRPC Router

Add PinballMap router to `src/server/api/root.ts`:

```typescript
import { pinballMapRouter } from "./routers/pinballMap";

export const appRouter = createTRPCRouter({
  // ... existing routers
  pinballMap: pinballMapRouter,
});
```

### 9. Database Migration

```bash
# Push schema changes
npm run db:push

# Reset database with new schema
npm run db:reset
```

## Validation Steps

### 1. TypeScript Compilation

```bash
npm run typecheck
# Should pass without PinballMap-related errors
```

### 2. Test Service Integration

```bash
# Test PinballMap service
npm run test src/server/services/__tests__/pinballmapService.test.ts
```

### 3. Manual Testing

1. Enable PinballMap integration for organization
2. Configure a location with PinballMap ID
3. Run sync and verify machines are created
4. Check that Model records are properly created
5. Verify organization isolation works

### 4. API Testing

Test tRPC endpoints:

- Enable integration
- Configure location sync
- Trigger manual sync
- Get sync status

## Progress Notes

### Implementation Decisions Made:

- **Enhanced Location Model**: Added geographic/contact fields based on PinballMap API analysis
- **Enhanced Model Schema**: Added IPDB/OPDB cross-references and machine technical metadata
- **Comprehensive Integration**: Support for both Internet Pinball Database and Open Pinball Database
- **Optional Condition Tracking**: Framework for machine condition reporting (future enhancement)
- **Created separate PinballMapConfig**: Organization-level settings with flexible sync options
- **Global Model Strategy**: OPDB games remain global (no organizationId) for cross-organization sharing
- **Proper Error Handling**: Graceful API failures and duplicate key handling

### Architecture Changes:

- **Service Class Pattern**: Better testability and dependency injection
- **Cross-Database Support**: Handle both IPDB and OPDB references from PinballMap
- **Geographic Integration**: Support for location mapping and regional organization
- **Optional Per-Location Sync**: Flexible configuration per location
- **Rich Metadata Storage**: Technical details, images, and external links

### Data Model Enhancements:

- **Location**: Geographic fields (lat/lng, address), PinballMap integration (regionId, pinballMapId)
- **Model**: Cross-database IDs (ipdbId, opdbId), technical specs (machineType, machineDisplay), metadata (images, links)
- **PinballMapConfig**: Organization-level integration settings and sync preferences
- **Optional MachineCondition**: User-reported condition tracking (future enhancement)

## Rollback Procedure

```bash
# Restore original service file
git checkout HEAD -- src/server/services/pinballmapService.ts

# Remove new router
rm src/server/api/routers/pinballMap.ts

# Restore schema
git checkout HEAD -- prisma/schema.prisma

# Reset database
npm run db:reset
```
