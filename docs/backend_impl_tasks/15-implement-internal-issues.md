# Task 15: Implement Internal-Only Issues System

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

## Workflow

- **Base Branch**: `epic/backend-refactor`
- **Task Branch**: `task/15-implement-internal-issues`
- **PR Target**: `epic/backend-refactor` (NOT main)

## Dependencies

- Task 03 (New Schema) must be completed first
- Independent of other tasks

## Objective

Implement internal-only issues system to support private work orders versus public issue reports as described in CUJs 6.3-6.4. This enables technicians to create private maintenance tasks and work orders that are not visible to the public while maintaining the public issue reporting system.

## Status

- [ ] In Progress
- [ ] Completed

## Current Requirements from CUJs

### 6.3 Creating an Internal Work Order

"A technician creates a new issue for a machine and checks the 'Internal Only' box, making it a private work order for proactive maintenance that is not visible to the public."

### 6.4 Differentiating Issue Types

"On the issue list for a machine, a technician sees clear 'Public' and 'Private' badges, allowing them to distinguish between customer reports and internal work orders."

### 6.7 Proactive Internal Maintenance

"A technician creates a low-priority, internal-only issue to track upcoming scheduled maintenance (e.g., 'Flipper Rebuild Due') without alarming the public."

## Implementation Steps

### 1. Add Visibility Field to Issue Model

Update `prisma/schema.prisma`:

```prisma
model Issue {
  id          String @id @default(cuid())
  title       String
  description String? @db.Text
  consistency String? // e.g., "Always", "Occasionally"

  // Issue visibility system
  visibility  IssueVisibility @default(PUBLIC)
  isInternal  Boolean         @default(false) // Computed field for easier querying

  // Reporter information (for public issues)
  reporterEmail String? // Email for anonymous public reports
  reporterName  String? // Name for anonymous public reports

  // For V1.0 checklists
  checklist Json? // Store checklist items as JSON: [{ text: "...", completed: false }]

  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  resolvedAt DateTime?

  // Relations
  organizationId String
  machineId      String
  statusId       String
  priorityId     String
  createdById    String
  assignedToId   String?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  machine      Machine      @relation(fields: [machineId], references: [id])
  priority     Priority     @relation(fields: [priorityId], references: [id])
  status       IssueStatus  @relation(fields: [statusId], references: [id])
  createdBy    User         @relation("CreatedBy", fields: [createdById], references: [id])
  assignedTo   User?        @relation("AssignedTo", fields: [assignedToId], references: [id])

  comments    Comment[]
  attachments Attachment[]
  history     IssueHistory[]
  upvotes     Upvote[]

  @@index([organizationId, visibility])
  @@index([machineId, visibility])
  @@index([isInternal])
}

enum IssueVisibility {
  PUBLIC    // Visible to public users and organization members
  INTERNAL  // Only visible to organization members (private work orders)
}
```

### 2. Create IssueVisibilityService

Create `src/server/services/issueVisibilityService.ts`:

```typescript
import { type PrismaClient, IssueVisibility } from "@prisma/client";

export interface IssueWithVisibility {
  id: string;
  title: string;
  visibility: IssueVisibility;
  isInternal: boolean;
  status: {
    name: string;
    category: string;
  };
  priority: {
    name: string;
  };
  createdAt: Date;
  reporterEmail?: string;
  reporterName?: string;
}

export interface CreateInternalIssueData {
  title: string;
  description?: string;
  machineId: string;
  priorityId: string;
  statusId: string;
  assignedToId?: string;
  checklist?: any[];
}

export class IssueVisibilityService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get public issues for a machine (for public viewing)
   */
  async getPublicIssues(
    machineId: string,
    organizationId: string,
  ): Promise<IssueWithVisibility[]> {
    return this.prisma.issue.findMany({
      where: {
        machineId,
        organizationId,
        visibility: IssueVisibility.PUBLIC,
      },
      include: {
        status: {
          select: {
            name: true,
            category: true,
          },
        },
        priority: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Get all issues for a machine (for authenticated organization members)
   */
  async getAllIssues(
    machineId: string,
    organizationId: string,
  ): Promise<IssueWithVisibility[]> {
    return this.prisma.issue.findMany({
      where: {
        machineId,
        organizationId,
      },
      include: {
        status: {
          select: {
            name: true,
            category: true,
          },
        },
        priority: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { visibility: "asc" }, // Public issues first
        { createdAt: "desc" },
      ],
    });
  }

  /**
   * Create an internal-only issue
   */
  async createInternalIssue(
    organizationId: string,
    createdById: string,
    data: CreateInternalIssueData,
  ): Promise<Issue> {
    return this.prisma.issue.create({
      data: {
        title: data.title,
        description: data.description,
        machineId: data.machineId,
        organizationId,
        statusId: data.statusId,
        priorityId: data.priorityId,
        createdById,
        assignedToId: data.assignedToId,
        visibility: IssueVisibility.INTERNAL,
        isInternal: true,
        checklist: data.checklist,
      },
    });
  }

  /**
   * Convert public issue to internal (for merging duplicates into internal issues)
   */
  async convertToInternal(issueId: string): Promise<void> {
    await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        visibility: IssueVisibility.INTERNAL,
        isInternal: true,
      },
    });
  }

  /**
   * Convert internal issue to public
   */
  async convertToPublic(issueId: string): Promise<void> {
    await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        visibility: IssueVisibility.PUBLIC,
        isInternal: false,
      },
    });
  }

  /**
   * Get internal issues for organization dashboard
   */
  async getInternalIssues(
    organizationId: string,
    options: {
      statusCategory?: string;
      assignedToId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{
    issues: IssueWithVisibility[];
    total: number;
  }> {
    const whereClause: any = {
      organizationId,
      visibility: IssueVisibility.INTERNAL,
    };

    if (options.statusCategory) {
      whereClause.status = {
        category: options.statusCategory,
      };
    }

    if (options.assignedToId) {
      whereClause.assignedToId = options.assignedToId;
    }

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({
        where: whereClause,
        include: {
          status: {
            select: {
              name: true,
              category: true,
            },
          },
          priority: {
            select: {
              name: true,
            },
          },
          machine: {
            select: {
              model: {
                select: {
                  name: true,
                },
              },
              location: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: options.limit || 20,
        skip: options.offset || 0,
      }),
      this.prisma.issue.count({
        where: whereClause,
      }),
    ]);

    return { issues, total };
  }

  /**
   * Get issue statistics by visibility
   */
  async getIssueStats(organizationId: string): Promise<{
    public: {
      total: number;
      open: number;
      inProgress: number;
      resolved: number;
    };
    internal: {
      total: number;
      open: number;
      inProgress: number;
      resolved: number;
    };
  }> {
    const [publicStats, internalStats] = await Promise.all([
      this.getVisibilityStats(organizationId, IssueVisibility.PUBLIC),
      this.getVisibilityStats(organizationId, IssueVisibility.INTERNAL),
    ]);

    return {
      public: publicStats,
      internal: internalStats,
    };
  }

  private async getVisibilityStats(
    organizationId: string,
    visibility: IssueVisibility,
  ): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
  }> {
    const [total, open, inProgress, resolved] = await Promise.all([
      this.prisma.issue.count({
        where: { organizationId, visibility },
      }),
      this.prisma.issue.count({
        where: {
          organizationId,
          visibility,
          status: { category: "NEW" },
        },
      }),
      this.prisma.issue.count({
        where: {
          organizationId,
          visibility,
          status: { category: "IN_PROGRESS" },
        },
      }),
      this.prisma.issue.count({
        where: {
          organizationId,
          visibility,
          status: { category: "RESOLVED" },
        },
      }),
    ]);

    return { total, open, inProgress, resolved };
  }

  /**
   * Check if user can view internal issues
   */
  async canViewInternalIssues(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    return membership !== null; // Only organization members can view internal issues
  }

  /**
   * Get machines with their issue counts by visibility
   */
  async getMachineIssueStats(organizationId: string): Promise<
    Array<{
      machineId: string;
      machineName: string;
      locationName: string;
      publicIssues: number;
      internalIssues: number;
      totalIssues: number;
    }>
  > {
    const machines = await this.prisma.machine.findMany({
      where: { organizationId },
      include: {
        model: {
          select: { name: true },
        },
        location: {
          select: { name: true },
        },
        _count: {
          select: {
            issues: true,
          },
        },
      },
    });

    const machineStats = await Promise.all(
      machines.map(async (machine) => {
        const [publicCount, internalCount] = await Promise.all([
          this.prisma.issue.count({
            where: {
              machineId: machine.id,
              visibility: IssueVisibility.PUBLIC,
            },
          }),
          this.prisma.issue.count({
            where: {
              machineId: machine.id,
              visibility: IssueVisibility.INTERNAL,
            },
          }),
        ]);

        return {
          machineId: machine.id,
          machineName: machine.model.name,
          locationName: machine.location.name,
          publicIssues: publicCount,
          internalIssues: internalCount,
          totalIssues: publicCount + internalCount,
        };
      }),
    );

    return machineStats.sort((a, b) => b.totalIssues - a.totalIssues);
  }
}
```

### 3. Update Issue Router for Internal Issues

Update `src/server/api/routers/issue.ts`:

```typescript
import { IssueVisibility } from "@prisma/client";
import { IssueVisibilityService } from "~/server/services/issueVisibilityService";

// Add to existing issue router

// Get public issues for a machine (public endpoint)
getPublicForMachine: publicProcedure
  .input(
    z.object({
      machineId: z.string(),
      organizationId: z.string(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const visibilityService = new IssueVisibilityService(ctx.db);
    return visibilityService.getPublicIssues(
      input.machineId,
      input.organizationId,
    );
  }),

// Get all issues for a machine (authenticated endpoint)
getAllForMachine: organizationProcedure
  .input(z.object({ machineId: z.string() }))
  .query(async ({ ctx, input }) => {
    const visibilityService = new IssueVisibilityService(ctx.db);
    return visibilityService.getAllIssues(
      input.machineId,
      ctx.organization.id,
    );
  }),

// Create internal issue
createInternal: issueCreateProcedure
  .input(
    z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      machineId: z.string(),
      priorityId: z.string(),
      statusId: z.string(),
      assignedToId: z.string().optional(),
      checklist: z.array(z.object({
        text: z.string(),
        completed: z.boolean(),
      })).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const visibilityService = new IssueVisibilityService(ctx.db);

    return visibilityService.createInternalIssue(
      ctx.organization.id,
      ctx.session.user.id,
      input,
    );
  }),

// Convert issue visibility
convertVisibility: issueEditProcedure
  .input(
    z.object({
      issueId: z.string(),
      visibility: z.nativeEnum(IssueVisibility),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const visibilityService = new IssueVisibilityService(ctx.db);

    if (input.visibility === IssueVisibility.INTERNAL) {
      await visibilityService.convertToInternal(input.issueId);
    } else {
      await visibilityService.convertToPublic(input.issueId);
    }

    return { success: true };
  }),

// Get internal issues dashboard
getInternalDashboard: organizationProcedure
  .input(
    z.object({
      statusCategory: z.string().optional(),
      assignedToId: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const visibilityService = new IssueVisibilityService(ctx.db);
    return visibilityService.getInternalIssues(ctx.organization.id, input);
  }),

// Get issue statistics by visibility
getStatsBy Visibility: organizationProcedure.query(async ({ ctx }) => {
  const visibilityService = new IssueVisibilityService(ctx.db);
  return visibilityService.getIssueStats(ctx.organization.id);
}),

// Get machine issue statistics
getMachineStats: organizationProcedure.query(async ({ ctx }) => {
  const visibilityService = new IssueVisibilityService(ctx.db);
  return visibilityService.getMachineIssueStats(ctx.organization.id);
}),
```

### 4. Add Internal Issue Permissions

Update permissions in seed data:

```typescript
// In prisma/seed.ts or permission setup
{
  name: "issue:create_internal",
  roles: ["Admin", "Technician"] // Who can create internal work orders
},
{
  name: "issue:view_internal",
  roles: ["Admin", "Technician", "Member"] // Who can view internal issues
},
{
  name: "issue:convert_visibility",
  roles: ["Admin", "Technician"] // Who can change issue visibility
}
```

### 5. Update Issue Activity Tracking

Update `src/server/services/issueActivityService.ts`:

```typescript
// Add new activity type for visibility changes
async recordVisibilityChange(
  issueId: string,
  organizationId: string,
  actorId: string,
  oldVisibility: string,
  newVisibility: string,
): Promise<void> {
  await this.recordActivity(issueId, organizationId, {
    type: ActivityType.VISIBILITY_CHANGED,
    actorId,
    fieldName: "visibility",
    oldValue: oldVisibility,
    newValue: newVisibility,
  });
}
```

### 6. Update ActivityType Enum

Add to `prisma/schema.prisma`:

```prisma
enum ActivityType {
  CREATED         // Issue created
  STATUS_CHANGED  // Status updated
  ASSIGNED        // Assignee changed
  PRIORITY_CHANGED // Priority updated
  COMMENTED       // Comment added
  ATTACHMENT_ADDED // File attached
  MERGED          // Issue merged (V1.0)
  RESOLVED        // Issue resolved
  REOPENED        // Issue reopened
  VISIBILITY_CHANGED // Issue visibility changed (public/internal)
  SYSTEM          // System-generated activity
}
```

### 7. Database Migration

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
# Should pass without internal issue-related errors
```

### 2. Test Issue Visibility

1. Create public issue
2. Create internal issue
3. Test public API only shows public issues
4. Test authenticated API shows both types

### 3. Test Visibility Conversion

1. Convert public issue to internal
2. Convert internal issue to public
3. Verify activity tracking
4. Test permission checks

### 4. Test Internal Issue Dashboard

1. Create multiple internal issues
2. Test filtering by status and assignee
3. Verify statistics are correct
4. Test machine issue breakdown

## Progress Notes

### Implementation Decisions Made:

- Added visibility enum with PUBLIC/INTERNAL values
- Created dedicated service for visibility management
- Implemented separate public and authenticated endpoints
- Added comprehensive statistics and reporting

### Database Changes:

- Added visibility field to Issue model
- Added isInternal computed boolean for easier querying
- Added reporter fields for anonymous public issues
- Maintained performance with proper indexing

### Service Architecture:

- Centralized IssueVisibilityService for all visibility operations
- Separate public and authenticated issue access
- Activity tracking for visibility changes
- Statistics generation for dashboard views

## Rollback Procedure

```bash
# Restore schema
git checkout HEAD -- prisma/schema.prisma

# Remove visibility files
rm src/server/services/issueVisibilityService.ts

# Restore issue router
git checkout HEAD -- src/server/api/routers/issue.ts

# Reset database
npm run db:reset
```
