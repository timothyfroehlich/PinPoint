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

---

# Testing Requirements for PinballMap Integration

> **GitHub Issue**: [#73 - Implement Comprehensive Test Suite for Redesigned PinballMap Integration](https://github.com/timothyfroehlich/PinPoint/issues/73)

## Overview

The redesigned PinballMap integration requires comprehensive testing to ensure reliability, security, and proper functionality. This section outlines the testing strategy, expected behaviors, and specific test cases needed for beta release and beyond.

## Background: PinballMap Integration Business Logic

### Core Workflow Understanding

The PinballMap integration follows this essential workflow:

1. **Organization Setup**: Admin enables PinballMap integration for their organization
2. **Location Configuration**: Admin links a PinPoint location to a PinballMap location ID
3. **Machine Synchronization**: System fetches machine data from PinballMap and reconciles with local database
4. **Data Management**: System handles machine additions, updates, and removals based on configuration

### Critical Business Rules

#### **Machine Reconciliation Logic**

The core business logic centers around reconciling PinballMap machine data with local PinPoint data:

- **Addition**: If a machine exists on PinballMap but not locally, create a new Machine record
- **Preservation**: If a machine exists both places, keep the local Machine record (mark as "found")
- **Removal Decision**: If a machine exists locally but not on PinballMap:
  - **With Issues**: NEVER remove machines that have associated Issue records (data protection)
  - **Without Issues**: Remove based on `updateExistingData` configuration setting
  - **Configuration Control**: Organizations can choose to "keep removed games" or "remove missing games"

#### **Model (Game Title) Management**

Models represent pinball machine types (e.g., "Medieval Madness", "Twilight Zone"):

- **Global OPDB Models**: Games with OPDB IDs are shared across all organizations (global records)
- **Cross-Database Priority**: OPDB ID lookup → IPDB ID lookup → create new Model
- **Custom Games**: Games without OPDB/IPDB IDs become organization-specific Models
- **Deduplication**: Prevent duplicate Models through unique constraints on opdbId/ipdbId

#### **Multi-Tenancy & Security**

Organization isolation is critical throughout the sync process:

- **Scoped Queries**: All database queries must include organization filtering
- **Configuration Inheritance**: Location sync settings inherit from organization PinballMapConfig
- **Access Control**: Only organization admins can configure and trigger syncs
- **Data Isolation**: Cross-organization data access must be impossible

#### **Error Handling & Resilience**

The system must gracefully handle various failure scenarios:

- **API Failures**: PinballMap API downtime or rate limiting
- **Partial Failures**: Some machines succeed, others fail during sync
- **Concurrent Operations**: Multiple syncs or overlapping operations
- **Data Integrity**: Maintain database consistency despite external API issues

## Testing Strategy

### Priority 1: Beta-Critical Tests

These tests are essential for beta release and must be implemented first:

#### **1. Core PinballMapService Class Tests**

**File**: `src/server/services/__tests__/pinballmapService.test.ts`

##### Constructor & Basic Setup

```typescript
describe("PinballMapService", () => {
  describe("constructor", () => {
    it("should instantiate with Prisma client dependency injection", () => {
      const service = new PinballMapService(mockPrisma);
      expect(service).toBeInstanceOf(PinballMapService);
    });
  });
});
```

##### enableIntegration() Method

```typescript
describe("enableIntegration", () => {
  it("should create PinballMapConfig for new organization", async () => {
    mockPrisma.pinballMapConfig.upsert.mockResolvedValue(mockConfig);

    await service.enableIntegration("org-123");

    expect(mockPrisma.pinballMapConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: "org-123" },
      create: {
        organizationId: "org-123",
        apiEnabled: true,
        autoSyncEnabled: false,
      },
      update: { apiEnabled: true },
    });
  });

  it("should update existing PinballMapConfig to enabled", async () => {
    // Test that re-enabling updates existing config
  });
});
```

##### configureLocationSync() Method

```typescript
describe("configureLocationSync", () => {
  it("should require PinballMap integration to be enabled", async () => {
    mockPrisma.pinballMapConfig.findUnique.mockResolvedValue(null);

    await expect(
      service.configureLocationSync("loc-123", 26454, "org-123"),
    ).rejects.toThrow("PinballMap integration not enabled for organization");
  });

  it("should update location with PinballMap ID and enable sync", async () => {
    mockPrisma.pinballMapConfig.findUnique.mockResolvedValue({
      apiEnabled: true,
    });

    await service.configureLocationSync("loc-123", 26454, "org-123");

    expect(mockPrisma.location.update).toHaveBeenCalledWith({
      where: { id: "loc-123" },
      data: {
        pinballMapId: 26454,
        syncEnabled: true,
      },
    });
  });
});
```

##### syncLocation() Method - Core Sync Logic

This is the most critical method requiring extensive testing:

```typescript
describe("syncLocation", () => {
  beforeEach(() => {
    setupMockLocation();
    setupMockPinballMapAPI();
  });

  it("should return error if location not found", async () => {
    mockPrisma.location.findUnique.mockResolvedValue(null);

    const result = await service.syncLocation("invalid-location");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Location not found");
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it("should return error if location lacks PinballMap ID", async () => {
    mockPrisma.location.findUnique.mockResolvedValue({
      ...mockLocation,
      pinballMapId: null,
    });

    const result = await service.syncLocation("loc-123");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Location not configured for PinballMap sync");
  });

  it("should return error if organization has integration disabled", async () => {
    mockPrisma.location.findUnique.mockResolvedValue({
      ...mockLocation,
      organization: {
        pinballMapConfig: { apiEnabled: false },
      },
    });

    const result = await service.syncLocation("loc-123");

    expect(result.success).toBe(false);
    expect(result.error).toBe("PinballMap integration not enabled");
  });

  it("should successfully sync machines from PinballMap", async () => {
    setupSuccessfulSync();

    const result = await service.syncLocation("loc-123");

    expect(result.success).toBe(true);
    expect(result.added).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/locations/26454/machine_details.json"),
    );
  });

  it("should update lastSyncAt timestamp on successful sync", async () => {
    setupSuccessfulSync();
    const beforeSync = new Date();

    await service.syncLocation("loc-123");

    expect(mockPrisma.location.update).toHaveBeenCalledWith({
      where: { id: "loc-123" },
      data: { lastSyncAt: expect.any(Date) },
    });
  });
});
```

#### **2. Machine Reconciliation Logic Tests**

**Critical Business Logic**: The heart of the PinballMap integration

```typescript
describe("reconcileMachines", () => {
  const mockConfig = {
    createMissingModels: true,
    updateExistingData: false,
  };

  it("should add machines that exist on PinballMap but not locally", async () => {
    const pinballMapMachines = [
      { opdb_id: "MM-001", machine_name: "Medieval Madness" },
      { opdb_id: "TZ-001", machine_name: "Twilight Zone" },
    ];
    mockPrisma.machine.findMany.mockResolvedValue([]); // No existing machines
    setupModelCreation();

    const result = await service.reconcileMachines(
      "loc-123",
      "org-123",
      pinballMapMachines,
      mockConfig,
    );

    expect(result.added).toBe(2);
    expect(result.removed).toBe(0);
    expect(mockPrisma.machine.create).toHaveBeenCalledTimes(2);
  });

  it("should preserve existing machines found on PinballMap", async () => {
    const existingMachine = {
      id: "machine-existing",
      modelId: "model-mm",
      model: { opdbId: "MM-001" },
    };
    const pinballMapMachines = [
      { opdb_id: "MM-001", machine_name: "Medieval Madness" },
    ];
    mockPrisma.machine.findMany.mockResolvedValue([existingMachine]);
    setupExistingModel("MM-001", "model-mm");

    const result = await service.reconcileMachines(
      "loc-123",
      "org-123",
      pinballMapMachines,
      mockConfig,
    );

    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(mockPrisma.machine.delete).not.toHaveBeenCalled();
  });

  it("should NEVER remove machines with associated issues", async () => {
    const machineWithIssues = {
      id: "machine-with-issues",
      modelId: "model-old",
      model: { opdbId: "OLD-001" },
    };
    mockPrisma.machine.findMany.mockResolvedValue([machineWithIssues]);
    mockPrisma.issue.count.mockResolvedValue(3); // Machine has 3 issues
    // PinballMap returns empty (machine removed from location)

    const result = await service.reconcileMachines(
      "loc-123",
      "org-123",
      [],
      mockConfig,
    );

    expect(result.removed).toBe(0);
    expect(mockPrisma.machine.delete).not.toHaveBeenCalled();
    expect(mockPrisma.issue.count).toHaveBeenCalledWith({
      where: { machineId: "machine-with-issues" },
    });
  });

  it("should remove machines without issues when missing from PinballMap", async () => {
    const machineWithoutIssues = {
      id: "machine-no-issues",
      modelId: "model-old",
      model: { opdbId: "OLD-001" },
    };
    mockPrisma.machine.findMany.mockResolvedValue([machineWithoutIssues]);
    mockPrisma.issue.count.mockResolvedValue(0); // No issues
    // PinballMap returns empty (machine removed from location)

    const result = await service.reconcileMachines(
      "loc-123",
      "org-123",
      [],
      mockConfig,
    );

    expect(result.removed).toBe(1);
    expect(mockPrisma.machine.delete).toHaveBeenCalledWith({
      where: { id: "machine-no-issues" },
    });
  });

  it("should respect createMissingModels configuration", async () => {
    const configNoCreate = { ...mockConfig, createMissingModels: false };
    const unknownMachine = {
      opdb_id: "UNKNOWN-001",
      machine_name: "Unknown Game",
    };
    mockPrisma.model.findUnique.mockResolvedValue(null); // Model doesn't exist

    const result = await service.reconcileMachines(
      "loc-123",
      "org-123",
      [unknownMachine],
      configNoCreate,
    );

    expect(result.added).toBe(0);
    expect(mockPrisma.model.create).not.toHaveBeenCalled();
    expect(mockPrisma.machine.create).not.toHaveBeenCalled();
  });
});
```

#### **3. Cross-Database Model Lookup Tests**

**Critical Business Logic**: OPDB → IPDB → create new priority chain

```typescript
describe("findOrCreateModel", () => {
  it("should find existing Model by OPDB ID first", async () => {
    const existingModel = {
      id: "model-123",
      name: "Medieval Madness",
      opdbId: "MM-001",
    };
    mockPrisma.model.findUnique
      .mockResolvedValueOnce(existingModel) // OPDB lookup succeeds
      .mockResolvedValueOnce(null); // IPDB lookup not called

    const result = await service.findOrCreateModel(
      { opdb_id: "MM-001", ipdb_id: "1234", machine_name: "Medieval Madness" },
      true,
    );

    expect(result).toEqual(existingModel);
    expect(mockPrisma.model.findUnique).toHaveBeenCalledWith({
      where: { opdbId: "MM-001" },
    });
    expect(mockPrisma.model.findUnique).toHaveBeenCalledTimes(1); // Only OPDB lookup
  });

  it("should fallback to IPDB ID if OPDB ID not found", async () => {
    const existingModel = {
      id: "model-456",
      name: "Twilight Zone",
      ipdbId: "1234",
    };
    mockPrisma.model.findUnique
      .mockResolvedValueOnce(null) // OPDB lookup fails
      .mockResolvedValueOnce(existingModel); // IPDB lookup succeeds

    const result = await service.findOrCreateModel(
      { opdb_id: "TZ-001", ipdb_id: "1234", machine_name: "Twilight Zone" },
      true,
    );

    expect(result).toEqual(existingModel);
    expect(mockPrisma.model.findUnique).toHaveBeenCalledWith({
      where: { opdbId: "TZ-001" },
    });
    expect(mockPrisma.model.findUnique).toHaveBeenCalledWith({
      where: { ipdbId: "1234" },
    });
  });

  it("should create new Model if neither OPDB nor IPDB found", async () => {
    const newModel = { id: "model-new", name: "New Game" };
    mockPrisma.model.findUnique.mockResolvedValue(null); // Both lookups fail
    mockPrisma.model.create.mockResolvedValue(newModel);

    const result = await service.findOrCreateModel(
      {
        opdb_id: "NEW-001",
        ipdb_id: "5678",
        machine_name: "New Game",
        manufacturer: "Stern",
        year: 2023,
        machine_type: "ss",
        machine_display: "dmd",
        is_active: true,
        ipdb_link: "http://ipdb.org/5678",
        opdb_img: "http://opdb.org/new-001.jpg",
        kineticist_url: "http://kineticist.com/new-001",
      },
      true,
    );

    expect(result).toEqual(newModel);
    expect(mockPrisma.model.create).toHaveBeenCalledWith({
      data: {
        name: "New Game",
        manufacturer: "Stern",
        year: 2023,
        opdbId: "NEW-001",
        ipdbId: "5678",
        machineType: "ss",
        machineDisplay: "dmd",
        isActive: true,
        ipdbLink: "http://ipdb.org/5678",
        opdbImgUrl: "http://opdb.org/new-001.jpg",
        kineticistUrl: "http://kineticist.com/new-001",
        isCustom: false,
      },
    });
  });

  it("should handle duplicate key errors gracefully", async () => {
    const existingModel = { id: "model-existing", name: "Existing Game" };
    mockPrisma.model.findUnique.mockResolvedValue(null); // Initial lookup fails
    mockPrisma.model.create.mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`opdbId`)"),
    );
    mockPrisma.model.findUnique.mockResolvedValue(existingModel); // Retry lookup succeeds

    const result = await service.findOrCreateModel(
      { opdb_id: "DUPLICATE-001", machine_name: "Duplicate Game" },
      true,
    );

    expect(result).toEqual(existingModel);
    expect(mockPrisma.model.findUnique).toHaveBeenCalledTimes(2); // Initial + retry
  });
});
```

#### **4. Organization Isolation Tests**

**Critical Security**: Prevent cross-tenant data access

```typescript
describe("Organization Isolation", () => {
  it("should only access locations within the organization", async () => {
    const org1Location = {
      id: "loc-org1",
      organizationId: "org-1",
      pinballMapId: 26454,
      organization: {
        pinballMapConfig: { apiEnabled: true },
      },
    };
    mockPrisma.location.findUnique.mockResolvedValue(org1Location);

    await service.syncLocation("loc-org1");

    expect(mockPrisma.location.findUnique).toHaveBeenCalledWith({
      where: { id: "loc-org1" },
      include: {
        organization: {
          include: { pinballMapConfig: true },
        },
      },
    });
  });

  it("should only access machines within the location", async () => {
    setupSuccessfulSync();

    await service.syncLocation("loc-123");

    expect(mockPrisma.machine.findMany).toHaveBeenCalledWith({
      where: { locationId: "loc-123" },
      include: { model: true },
    });
  });

  it("should scope getOrganizationSyncStatus to organization", async () => {
    await service.getOrganizationSyncStatus("org-123");

    expect(mockPrisma.pinballMapConfig.findUnique).toHaveBeenCalledWith({
      where: { organizationId: "org-123" },
    });
    expect(mockPrisma.location.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-123" },
      include: { _count: { select: { machines: true } } },
    });
  });
});
```

#### **5. API Error Handling Tests**

**Resilience**: Graceful handling of external API failures

```typescript
describe("API Error Handling", () => {
  it("should handle PinballMap API being unavailable", async () => {
    setupMockLocation();
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const result = await service.syncLocation("loc-123");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it("should handle HTTP error responses from PinballMap", async () => {
    setupMockLocation();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await service.syncLocation("loc-123");

    expect(result.success).toBe(false);
    expect(result.error).toBe("PinballMap API error: 404");
  });

  it("should handle malformed JSON responses", async () => {
    setupMockLocation();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ invalid: "data" }),
    });

    const result = await service.syncLocation("loc-123");

    expect(result.success).toBe(false);
    expect(result.error).toBe("No machine data returned from PinballMap");
  });
});
```

### Priority 2: tRPC Router Tests

**File**: `src/server/api/routers/__tests__/pinballMap.test.ts` (new file)

#### Authentication & Authorization

```typescript
describe("pinballMapRouter", () => {
  const createCaller = createCallerFactory(appRouter);

  describe("Authentication", () => {
    it("should require organizationManageProcedure for all endpoints", async () => {
      const caller = createCaller({
        db: mockPrisma,
        session: null, // No session
      });

      await expect(caller.pinballMap.enableIntegration()).rejects.toThrow(
        "UNAUTHORIZED",
      );
      await expect(caller.pinballMap.getSyncStatus()).rejects.toThrow(
        "UNAUTHORIZED",
      );
    });

    it("should allow organization admin access", async () => {
      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
      });

      // Should not throw authorization errors
      await expect(caller.pinballMap.getSyncStatus()).resolves.toBeDefined();
    });
  });

  describe("enableIntegration", () => {
    it("should call PinballMapService.enableIntegration", async () => {
      const mockService = jest
        .spyOn(PinballMapService.prototype, "enableIntegration")
        .mockResolvedValue(undefined);

      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
      });

      const result = await caller.pinballMap.enableIntegration();

      expect(mockService).toHaveBeenCalledWith(mockOrganization.id);
      expect(result).toEqual({ success: true });
    });
  });

  describe("syncLocation", () => {
    it("should propagate service success results", async () => {
      const mockSyncResult = {
        success: true,
        added: 5,
        updated: 2,
        removed: 1,
      };
      jest
        .spyOn(PinballMapService.prototype, "syncLocation")
        .mockResolvedValue(mockSyncResult);

      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
      });

      const result = await caller.pinballMap.syncLocation({
        locationId: "loc-123",
      });

      expect(result).toEqual(mockSyncResult);
    });

    it("should convert service failures to TRPCError", async () => {
      const mockSyncResult = {
        success: false,
        added: 0,
        updated: 0,
        removed: 0,
        error: "PinballMap API error: 500",
      };
      jest
        .spyOn(PinballMapService.prototype, "syncLocation")
        .mockResolvedValue(mockSyncResult);

      const caller = createCaller({
        db: mockPrisma,
        session: mockAdminSession,
        organization: mockOrganization,
      });

      await expect(
        caller.pinballMap.syncLocation({ locationId: "loc-123" }),
      ).rejects.toThrow("PinballMap API error: 500");
    });
  });
});
```

### Priority 3: Integration Tests

**File**: `src/server/api/routers/__tests__/pinballmap-integration.test.ts` (update existing)

#### End-to-End Workflow Tests

```typescript
describe("PinballMap Integration End-to-End", () => {
  it("should complete full setup and sync workflow", async () => {
    const caller = createCaller({
      db: mockPrisma,
      session: mockAdminSession,
      organization: mockOrganization,
    });

    // Step 1: Enable integration
    await caller.pinballMap.enableIntegration();
    expect(mockPrisma.pinballMapConfig.upsert).toHaveBeenCalled();

    // Step 2: Configure location
    await caller.pinballMap.configureLocation({
      locationId: "loc-123",
      pinballMapId: 26454,
    });
    expect(mockPrisma.location.update).toHaveBeenCalledWith({
      where: { id: "loc-123" },
      data: { pinballMapId: 26454, syncEnabled: true },
    });

    // Step 3: Sync location
    setupSuccessfulSync();
    const syncResult = await caller.pinballMap.syncLocation({
      locationId: "loc-123",
    });
    expect(syncResult.success).toBe(true);
    expect(syncResult.added).toBeGreaterThan(0);

    // Step 4: Check status
    const status = await caller.pinballMap.getSyncStatus();
    expect(status.configEnabled).toBe(true);
    expect(status.locations).toHaveLength(1);
  });
});
```

## Expected Behaviors Reference

### Sync Configuration Behaviors

- Organizations start with PinballMap integration **disabled**
- Locations start with sync **disabled** even when organization has integration enabled
- Each location must be individually configured with a PinballMap location ID
- Invalid PinballMap location IDs should be handled gracefully (API will return 404)

### Machine Reconciliation Behaviors

- **New Machines**: Always added when found on PinballMap
- **Existing Machines**: Preserved and marked as "found" (not duplicated)
- **Missing Machines**: Only removed if they have zero associated Issue records
- **Model Creation**: OPDB games create global Models, custom games remain organization-specific
- **Conflict Resolution**: Duplicate key errors handled through retry logic

### Error Recovery Behaviors

- **API Timeouts**: Return user-friendly error messages
- **Partial Failures**: Continue processing remaining machines after individual failures
- **Rate Limiting**: Respect PinballMap API limits (future enhancement)
- **Data Integrity**: Never leave database in inconsistent state

### Security Behaviors

- **Organization Isolation**: Impossible to access other organization's data
- **Permission Checks**: Only organization admins can configure or sync
- **Input Validation**: All user inputs validated through Zod schemas
- **Audit Trail**: Sync timestamps recorded for tracking

## Test Implementation Notes

### Mocking Strategy

- **Prisma**: Use jest.Mock for all database operations
- **PinballMap API**: Mock global.fetch with realistic response data
- **Time**: Mock Date.now() for consistent timestamp testing
- **Error Scenarios**: Mock various failure conditions systematically

### Test Data Requirements

- **Realistic PinballMap Data**: Use actual Austin Pinball Collective machine data structure
- **Edge Cases**: Include machines without OPDB IDs, malformed data, empty responses
- **Large Datasets**: Test with 100+ machines for performance validation
- **Duplicate Scenarios**: Test concurrent sync operations and race conditions

### Coverage Goals

- **Service Layer**: 90%+ coverage for PinballMapService class
- **Router Layer**: 85%+ coverage for tRPC endpoints
- **Integration**: 75%+ coverage for end-to-end workflows
- **Error Paths**: 100% coverage for error handling code paths

This comprehensive testing strategy ensures the PinballMap integration is robust, secure, and ready for production use while maintaining the high code quality standards expected in the PinPoint codebase.
