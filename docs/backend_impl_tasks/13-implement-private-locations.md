# Task 13: Implement Private Locations System

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

**Multi-Agent Coordination**: This task is part of Phase 3C development. See @MULTI_AGENT_WORKFLOW.md for complete worktree setup, sync procedures, and coordination guidelines.

## Workflow

- **Base Branch**: `epic/backend-refactor`
- **Task Branch**: `task/13-implement-private-locations`
- **PR Target**: `epic/backend-refactor` (NOT main)
- **Worktree**: `~/Code/PinPoint-worktrees/task-13-implement-private-locations/`

## Dependencies

- Task 03 (New Schema) must be completed first
- Independent of other tasks

## Objective

Implement private/public location visibility system to support advanced asset management workflows from CUJs 6.1-6.8. This enables workshop/repair locations that are hidden from public view while supporting internal machine movement and maintenance workflows.

## Status

- [ ] In Progress
- [ ] Completed

## Current Requirements from CUJs

### 6.1 Setting Location Visibility

"An admin creates a new location (e.g., 'The Workshop') and marks it as 'Private,' hiding it from the public homepage."

### 6.2 Moving Machines to Private Locations

"A technician moves a broken machine from a public location to the private 'Workshop' location to begin repairs off-floor."

### 6.5 Moving Machines Back On-Floor

"An admin moves a repaired machine from 'The Workshop' to a public location, making it visible and available to the public again."

### 6.6 Strategic Fleet Analysis

"An admin views a dashboard showing machine counts at all locations (including private ones) to plan game swaps."

## Implementation Steps

### 1. Add Visibility Field to Location Model

Update `prisma/schema.prisma`:

```prisma
model Location {
  id             String  @id @default(cuid())
  name           String
  organizationId String

  // Location visibility system
  visibility     LocationVisibility @default(PUBLIC)
  address        String?            // Physical address (optional)
  description    String?            // Location description

  // PinballMap integration (optional)
  pinballMapId   Int?      // PinballMap location ID
  lastSyncAt     DateTime? // When was last sync performed
  syncEnabled    Boolean   @default(false) // Enable/disable sync for this location

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  machines     Machine[]

  @@index([organizationId, visibility])
}

enum LocationVisibility {
  PUBLIC   // Visible on public homepage and location pages
  PRIVATE  // Hidden from public, only visible to authenticated organization members
}
```

### 2. Create Machine Movement History Model

Add machine movement tracking:

```prisma
model MachineMovement {
  id        String   @id @default(cuid())
  machineId String
  fromLocationId String?  // null for initial placement
  toLocationId   String
  movedAt        DateTime @default(now())
  movedById      String   // Who performed the move
  reason         String?  // Optional reason for move
  notes          String?  // Additional notes

  // Relations
  machine      Machine  @relation(fields: [machineId], references: [id], onDelete: Cascade)
  fromLocation Location? @relation("MovementFrom", fields: [fromLocationId], references: [id])
  toLocation   Location  @relation("MovementTo", fields: [toLocationId], references: [id])
  movedBy      User     @relation(fields: [movedById], references: [id])

  @@index([machineId, movedAt])
}
```

### 3. Update Location Model Relations

Add movement tracking relations:

```prisma
model Location {
  // ... existing fields

  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  machines         Machine[]
  movementsFrom    MachineMovement[] @relation("MovementFrom")
  movementsTo      MachineMovement[] @relation("MovementTo")
}
```

### 4. Update User Model for Movement Tracking

```prisma
model User {
  // ... existing fields

  // Relations
  accounts         Account[]
  sessions         Session[]
  memberships      Membership[]
  ownedMachines    Machine[] @relation("MachineOwner")
  issuesCreated    Issue[]   @relation("CreatedBy")
  issuesAssigned   Issue[]   @relation("AssignedTo")
  comments         Comment[]
  upvotes          Upvote[]
  notifications    Notification[]
  machineMovements MachineMovement[] // Add movement tracking
}
```

### 5. Create LocationService

Create `src/server/services/locationService.ts`:

```typescript
import { type PrismaClient, LocationVisibility } from "@prisma/client";

export interface LocationStats {
  totalMachines: number;
  publicMachines: number;
  privateMachines: number;
  activeIssues: number;
}

export interface MachineMovementData {
  machineId: string;
  fromLocationId: string | null;
  toLocationId: string;
  reason?: string;
  notes?: string;
}

export class LocationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get public locations for homepage display
   */
  async getPublicLocations(organizationId: string): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: {
        organizationId,
        visibility: LocationVisibility.PUBLIC,
      },
      include: {
        _count: {
          select: {
            machines: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  /**
   * Get all locations (for authenticated organization members)
   */
  async getAllLocations(organizationId: string): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: {
        organizationId,
      },
      include: {
        _count: {
          select: {
            machines: true,
          },
        },
      },
      orderBy: [
        { visibility: "asc" }, // Public first
        { name: "asc" },
      ],
    });
  }

  /**
   * Get location statistics for dashboard
   */
  async getLocationStats(organizationId: string): Promise<{
    public: LocationStats[];
    private: LocationStats[];
    total: {
      locations: number;
      machines: number;
      activeIssues: number;
    };
  }> {
    const locations = await this.prisma.location.findMany({
      where: { organizationId },
      include: {
        machines: {
          include: {
            _count: {
              select: {
                issues: {
                  where: {
                    status: {
                      category: {
                        in: ["NEW", "IN_PROGRESS"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const publicStats: LocationStats[] = [];
    const privateStats: LocationStats[] = [];
    let totalMachines = 0;
    let totalActiveIssues = 0;

    for (const location of locations) {
      const stats: LocationStats = {
        totalMachines: location.machines.length,
        publicMachines:
          location.visibility === LocationVisibility.PUBLIC
            ? location.machines.length
            : 0,
        privateMachines:
          location.visibility === LocationVisibility.PRIVATE
            ? location.machines.length
            : 0,
        activeIssues: location.machines.reduce(
          (sum, machine) => sum + machine._count.issues,
          0,
        ),
      };

      if (location.visibility === LocationVisibility.PUBLIC) {
        publicStats.push(stats);
      } else {
        privateStats.push(stats);
      }

      totalMachines += stats.totalMachines;
      totalActiveIssues += stats.activeIssues;
    }

    return {
      public: publicStats,
      private: privateStats,
      total: {
        locations: locations.length,
        machines: totalMachines,
        activeIssues: totalActiveIssues,
      },
    };
  }

  /**
   * Move a machine between locations
   */
  async moveMachine(
    movementData: MachineMovementData,
    movedById: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Update machine location
      await tx.machine.update({
        where: { id: movementData.machineId },
        data: { locationId: movementData.toLocationId },
      });

      // Record movement history
      await tx.machineMovement.create({
        data: {
          machineId: movementData.machineId,
          fromLocationId: movementData.fromLocationId,
          toLocationId: movementData.toLocationId,
          movedById,
          reason: movementData.reason,
          notes: movementData.notes,
        },
      });
    });
  }

  /**
   * Get machine movement history
   */
  async getMachineMovementHistory(
    machineId: string,
  ): Promise<MachineMovement[]> {
    return this.prisma.machineMovement.findMany({
      where: { machineId },
      include: {
        fromLocation: {
          select: {
            id: true,
            name: true,
            visibility: true,
          },
        },
        toLocation: {
          select: {
            id: true,
            name: true,
            visibility: true,
          },
        },
        movedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        movedAt: "desc",
      },
    });
  }

  /**
   * Create a new location
   */
  async createLocation(
    organizationId: string,
    data: {
      name: string;
      visibility: LocationVisibility;
      address?: string;
      description?: string;
    },
  ): Promise<Location> {
    return this.prisma.location.create({
      data: {
        organizationId,
        name: data.name,
        visibility: data.visibility,
        address: data.address,
        description: data.description,
      },
    });
  }

  /**
   * Update location visibility
   */
  async updateLocationVisibility(
    locationId: string,
    visibility: LocationVisibility,
  ): Promise<void> {
    await this.prisma.location.update({
      where: { id: locationId },
      data: { visibility },
    });
  }
}
```

### 6. Create Location tRPC Router

Create `src/server/api/routers/location.ts`:

```typescript
import { z } from "zod";
import { LocationVisibility } from "@prisma/client";

import {
  createTRPCRouter,
  publicProcedure,
  organizationProcedure,
  locationEditProcedure,
  machineEditProcedure,
} from "~/server/api/trpc";
import { LocationService } from "~/server/services/locationService";

export const locationRouter = createTRPCRouter({
  // Public: Get public locations for homepage
  getPublic: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new LocationService(ctx.db);
      return service.getPublicLocations(input.organizationId);
    }),

  // Get all locations (authenticated members)
  getAll: organizationProcedure.query(async ({ ctx }) => {
    const service = new LocationService(ctx.db);
    return service.getAllLocations(ctx.organization.id);
  }),

  // Get location statistics for dashboard
  getStats: organizationProcedure.query(async ({ ctx }) => {
    const service = new LocationService(ctx.db);
    return service.getLocationStats(ctx.organization.id);
  }),

  // Create new location
  create: locationEditProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        visibility: z.nativeEnum(LocationVisibility),
        address: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = new LocationService(ctx.db);
      return service.createLocation(ctx.organization.id, input);
    }),

  // Update location visibility
  updateVisibility: locationEditProcedure
    .input(
      z.object({
        locationId: z.string(),
        visibility: z.nativeEnum(LocationVisibility),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = new LocationService(ctx.db);
      await service.updateLocationVisibility(
        input.locationId,
        input.visibility,
      );
      return { success: true };
    }),

  // Move machine between locations
  moveMachine: machineEditProcedure
    .input(
      z.object({
        machineId: z.string(),
        fromLocationId: z.string().nullable(),
        toLocationId: z.string(),
        reason: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const service = new LocationService(ctx.db);
      await service.moveMachine(
        {
          machineId: input.machineId,
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          reason: input.reason,
          notes: input.notes,
        },
        ctx.session.user.id,
      );
      return { success: true };
    }),

  // Get machine movement history
  getMachineHistory: organizationProcedure
    .input(z.object({ machineId: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new LocationService(ctx.db);
      return service.getMachineMovementHistory(input.machineId);
    }),
});
```

### 7. Add Machine Movement Permissions

Update permissions in seed data:

```typescript
// In prisma/seed.ts or permission setup
{
  name: "machine:move",
  roles: ["Admin", "Technician"] // Who can move machines between locations
},
{
  name: "location:create",
  roles: ["Admin"] // Who can create new locations
},
{
  name: "location:edit",
  roles: ["Admin"] // Who can edit location settings
}
```

### 8. Database Migration

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
# Should pass without location-related errors
```

### 2. Test Location Visibility

1. Create public and private locations
2. Verify public endpoints only return public locations
3. Verify authenticated endpoints return all locations
4. Test location visibility updates

### 3. Test Machine Movement

1. Move machine from public to private location
2. Verify movement is recorded in history
3. Test machine appears in correct location
4. Verify movement permissions

### 4. Test Dashboard Statistics

1. Create locations with machines
2. Verify statistics show correct counts
3. Test private/public separation in stats

## Progress Notes

### Implementation Decisions Made:

- Used enum for location visibility (PUBLIC/PRIVATE)
- Created comprehensive movement tracking system
- Added location statistics for dashboard views
- Implemented proper permission checks for movements

### Database Changes:

- Added visibility field to Location model
- Created MachineMovement model for audit trail
- Added address and description fields for better location info
- Maintained performance with proper indexing

### Service Architecture:

- Centralized LocationService for all location operations
- Separation of public vs authenticated location access
- Machine movement tracking with history
- Statistics generation for dashboard views

## Rollback Procedure

```bash
# Restore schema
git checkout HEAD -- prisma/schema.prisma

# Remove location files
rm src/server/services/locationService.ts

# Reset database
npm run db:reset
```
