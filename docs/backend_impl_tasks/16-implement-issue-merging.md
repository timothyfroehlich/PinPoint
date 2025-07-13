# Task 16: Implement Issue Merging System

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

**Multi-Agent Coordination**: This task is part of Phase 3D development. See @MULTI_AGENT_WORKFLOW.md for complete worktree setup, sync procedures, and coordination guidelines.

## Workflow

- **Base Branch**: `epic/backend-refactor`
- **Task Branch**: `task/16-implement-issue-merging`
- **PR Target**: `epic/backend-refactor` (NOT main)
- **Worktree**: `~/Code/PinPoint-worktrees/task-16-implement-issue-merging/`

## Dependencies

- Task 07 (Fix IssueHistory Model) must be completed first (IssueHistory model conflict)
- Task 15 (Internal Issues) should be completed for full functionality

## Objective

Implement issue merging system to handle duplicate issue reports as described in CUJ 4.4. This enables technicians to merge new duplicate reports into existing issues while preserving all details, comments, and attachments from both issues.

## Status

- [ ] In Progress
- [ ] Completed

## Current Requirements from CUJs

### 4.4 Merging Duplicate Issues

"A technician merges a new report into an existing one, preserving the new report's details and photos."

### 1.4 Reporting a Duplicate Issue

"A user, unaware of an existing report, submits a new issue for the same underlying problem."

## Implementation Steps

### 1. Add Issue Merging Fields to Schema

Update `prisma/schema.prisma`:

```prisma
model Issue {
  id          String @id @default(cuid())
  title       String
  description String? @db.Text
  consistency String? // e.g., "Always", "Occasionally"

  // Issue visibility system
  visibility  IssueVisibility @default(PUBLIC)
  isInternal  Boolean         @default(false)

  // Issue merging system
  isMerged       Boolean   @default(false)  // Is this issue merged into another?
  mergedIntoId   String?   // ID of the issue this was merged into
  mergedAt       DateTime? // When was this issue merged
  mergedById     String?   // Who performed the merge

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

  // Merging relations
  mergedInto   Issue?  @relation("IssueMerge", fields: [mergedIntoId], references: [id])
  mergedIssues Issue[] @relation("IssueMerge") // Issues merged into this one
  mergedBy     User?   @relation("MergedBy", fields: [mergedById], references: [id])

  comments    Comment[]
  attachments Attachment[]
  history     IssueHistory[]
  upvotes     Upvote[]

  @@index([organizationId, visibility])
  @@index([machineId, visibility])
  @@index([isInternal])
  @@index([isMerged])
  @@index([mergedIntoId])
}
```

### 2. Update User Model for Merge Tracking

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
  machineMovements MachineMovement[]
  issueMerges      Issue[]   @relation("MergedBy") // Add merge tracking
}
```

### 3. Create IssueMergingService

Create `src/server/services/issueMergingService.ts`:

```typescript
import { type PrismaClient, ActivityType } from "@prisma/client";
import { IssueActivityService } from "./issueActivityService";

export interface MergeIssuesData {
  sourceIssueId: string; // Issue to be merged (will be marked as merged)
  targetIssueId: string; // Issue to merge into (will receive content)
  mergeComments: boolean; // Whether to copy comments
  mergeAttachments: boolean; // Whether to copy attachments
  mergeUpvotes: boolean; // Whether to copy upvotes
  mergeNotes?: string; // Optional notes about the merge
}

export interface MergedIssueInfo {
  id: string;
  title: string;
  mergedAt: Date;
  mergedBy: {
    id: string;
    name: string | null;
  };
  originalDetails: {
    description: string | null;
    reporterEmail: string | null;
    reporterName: string | null;
  };
  mergedCounts: {
    comments: number;
    attachments: number;
    upvotes: number;
  };
}

export class IssueMergingService {
  constructor(
    private prisma: PrismaClient,
    private activityService: IssueActivityService,
  ) {}

  /**
   * Merge one issue into another
   */
  async mergeIssues(
    mergeData: MergeIssuesData,
    mergedById: string,
    organizationId: string,
  ): Promise<{
    success: boolean;
    mergedCounts: {
      comments: number;
      attachments: number;
      upvotes: number;
    };
  }> {
    const mergedCounts = {
      comments: 0,
      attachments: 0,
      upvotes: 0,
    };

    await this.prisma.$transaction(async (tx) => {
      // 1. Verify both issues exist and belong to organization
      const [sourceIssue, targetIssue] = await Promise.all([
        tx.issue.findFirst({
          where: {
            id: mergeData.sourceIssueId,
            organizationId,
            isMerged: false, // Can't merge already merged issues
          },
          include: {
            comments: true,
            attachments: true,
            upvotes: true,
          },
        }),
        tx.issue.findFirst({
          where: {
            id: mergeData.targetIssueId,
            organizationId,
            isMerged: false, // Can't merge into merged issues
          },
        }),
      ]);

      if (!sourceIssue || !targetIssue) {
        throw new Error("One or both issues not found or already merged");
      }

      if (sourceIssue.machineId !== targetIssue.machineId) {
        throw new Error("Can only merge issues for the same machine");
      }

      // 2. Copy comments if requested
      if (mergeData.mergeComments && sourceIssue.comments.length > 0) {
        for (const comment of sourceIssue.comments) {
          await tx.comment.create({
            data: {
              content: `[Merged from issue #${sourceIssue.id}] ${comment.content}`,
              issueId: mergeData.targetIssueId,
              authorId: comment.authorId,
              createdAt: comment.createdAt,
            },
          });
        }
        mergedCounts.comments = sourceIssue.comments.length;
      }

      // 3. Copy attachments if requested
      if (mergeData.mergeAttachments && sourceIssue.attachments.length > 0) {
        for (const attachment of sourceIssue.attachments) {
          await tx.attachment.create({
            data: {
              url: attachment.url,
              fileName: `[Merged] ${attachment.fileName}`,
              fileType: attachment.fileType,
              issueId: mergeData.targetIssueId,
              organizationId: attachment.organizationId,
              createdAt: attachment.createdAt,
            },
          });
        }
        mergedCounts.attachments = sourceIssue.attachments.length;
      }

      // 4. Copy upvotes if requested (avoid duplicates)
      if (mergeData.mergeUpvotes && sourceIssue.upvotes.length > 0) {
        for (const upvote of sourceIssue.upvotes) {
          // Check if user already upvoted target issue
          const existingUpvote = await tx.upvote.findUnique({
            where: {
              issueId_userId: {
                issueId: mergeData.targetIssueId,
                userId: upvote.userId,
              },
            },
          });

          if (!existingUpvote) {
            await tx.upvote.create({
              data: {
                issueId: mergeData.targetIssueId,
                userId: upvote.userId,
                createdAt: upvote.createdAt,
              },
            });
            mergedCounts.upvotes++;
          }
        }
      }

      // 5. Mark source issue as merged
      await tx.issue.update({
        where: { id: mergeData.sourceIssueId },
        data: {
          isMerged: true,
          mergedIntoId: mergeData.targetIssueId,
          mergedAt: new Date(),
          mergedById,
        },
      });

      // 6. Add merge note to target issue if provided
      if (mergeData.mergeNotes) {
        await tx.comment.create({
          data: {
            content: `Issue merged from #${sourceIssue.id}: ${mergeData.mergeNotes}`,
            issueId: mergeData.targetIssueId,
            authorId: mergedById,
          },
        });
      }

      // 7. Record activity on both issues
      await this.activityService.recordActivity(
        mergeData.targetIssueId,
        organizationId,
        {
          type: ActivityType.MERGED,
          actorId: mergedById,
          fieldName: "merge",
          newValue: `Merged issue #${sourceIssue.id} into this issue`,
        },
      );

      await this.activityService.recordActivity(
        mergeData.sourceIssueId,
        organizationId,
        {
          type: ActivityType.MERGED,
          actorId: mergedById,
          fieldName: "merge",
          newValue: `This issue was merged into #${targetIssue.id}`,
        },
      );
    });

    return {
      success: true,
      mergedCounts,
    };
  }

  /**
   * Get potential duplicate issues for a machine
   */
  async getPotentialDuplicates(
    machineId: string,
    organizationId: string,
    excludeIssueId?: string,
  ): Promise<
    Array<{
      id: string;
      title: string;
      status: {
        name: string;
        category: string;
      };
      createdAt: Date;
      similarity?: number; // Future: similarity score
    }>
  > {
    const issues = await this.prisma.issue.findMany({
      where: {
        machineId,
        organizationId,
        isMerged: false,
        ...(excludeIssueId && { id: { not: excludeIssueId } }),
        status: {
          category: {
            in: ["NEW", "IN_PROGRESS"], // Only suggest open issues
          },
        },
      },
      include: {
        status: {
          select: {
            name: true,
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10, // Limit suggestions
    });

    // Future: Add similarity scoring based on title/description
    return issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      status: issue.status,
      createdAt: issue.createdAt,
    }));
  }

  /**
   * Get issues that were merged into this issue
   */
  async getMergedIssues(issueId: string): Promise<MergedIssueInfo[]> {
    const mergedIssues = await this.prisma.issue.findMany({
      where: {
        mergedIntoId: issueId,
        isMerged: true,
      },
      include: {
        mergedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
            upvotes: true,
          },
        },
      },
      orderBy: {
        mergedAt: "desc",
      },
    });

    return mergedIssues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      mergedAt: issue.mergedAt!,
      mergedBy: issue.mergedBy!,
      originalDetails: {
        description: issue.description,
        reporterEmail: issue.reporterEmail,
        reporterName: issue.reporterName,
      },
      mergedCounts: {
        comments: issue._count.comments,
        attachments: issue._count.attachments,
        upvotes: issue._count.upvotes,
      },
    }));
  }

  /**
   * Unmerge an issue (restore it as standalone)
   */
  async unmergeIssue(
    issueId: string,
    organizationId: string,
    unmergedById: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.findFirst({
        where: {
          id: issueId,
          organizationId,
          isMerged: true,
        },
      });

      if (!issue) {
        throw new Error("Issue not found or not merged");
      }

      // Restore issue as standalone
      await tx.issue.update({
        where: { id: issueId },
        data: {
          isMerged: false,
          mergedIntoId: null,
          mergedAt: null,
          mergedById: null,
        },
      });

      // Record activity
      await this.activityService.recordActivity(issueId, organizationId, {
        type: ActivityType.SYSTEM,
        actorId: unmergedById,
        fieldName: "merge",
        newValue: "Issue was unmerged and restored as standalone",
      });

      if (issue.mergedIntoId) {
        await this.activityService.recordActivity(
          issue.mergedIntoId,
          organizationId,
          {
            type: ActivityType.SYSTEM,
            actorId: unmergedById,
            fieldName: "merge",
            newValue: `Issue #${issueId} was unmerged from this issue`,
          },
        );
      }
    });
  }

  /**
   * Get merge statistics for organization
   */
  async getMergeStats(organizationId: string): Promise<{
    totalMerged: number;
    mergedThisMonth: number;
    topMergedIssues: Array<{
      id: string;
      title: string;
      mergedCount: number;
    }>;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalMerged, mergedThisMonth] = await Promise.all([
      this.prisma.issue.count({
        where: {
          organizationId,
          isMerged: true,
        },
      }),
      this.prisma.issue.count({
        where: {
          organizationId,
          isMerged: true,
          mergedAt: {
            gte: startOfMonth,
          },
        },
      }),
    ]);

    // Get issues with most merges
    const topMerged = await this.prisma.issue.findMany({
      where: {
        organizationId,
        mergedIssues: {
          some: {},
        },
      },
      select: {
        id: true,
        title: true,
        _count: {
          select: {
            mergedIssues: true,
          },
        },
      },
      orderBy: {
        mergedIssues: {
          _count: "desc",
        },
      },
      take: 5,
    });

    return {
      totalMerged,
      mergedThisMonth,
      topMergedIssues: topMerged.map((issue) => ({
        id: issue.id,
        title: issue.title,
        mergedCount: issue._count.mergedIssues,
      })),
    };
  }
}
```

### 4. Create Issue Merging tRPC Router

Create `src/server/api/routers/issueMerging.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  organizationProcedure,
  issueEditProcedure,
} from "~/server/api/trpc";
import { IssueMergingService } from "~/server/services/issueMergingService";
import { IssueActivityService } from "~/server/services/issueActivityService";

export const issueMergingRouter = createTRPCRouter({
  // Merge issues
  merge: issueEditProcedure
    .input(
      z.object({
        sourceIssueId: z.string(),
        targetIssueId: z.string(),
        mergeComments: z.boolean().default(true),
        mergeAttachments: z.boolean().default(true),
        mergeUpvotes: z.boolean().default(true),
        mergeNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activityService = new IssueActivityService(ctx.db);
      const mergingService = new IssueMergingService(ctx.db, activityService);

      return mergingService.mergeIssues(
        input,
        ctx.session.user.id,
        ctx.organization.id,
      );
    }),

  // Get potential duplicates
  getPotentialDuplicates: organizationProcedure
    .input(
      z.object({
        machineId: z.string(),
        excludeIssueId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const activityService = new IssueActivityService(ctx.db);
      const mergingService = new IssueMergingService(ctx.db, activityService);

      return mergingService.getPotentialDuplicates(
        input.machineId,
        ctx.organization.id,
        input.excludeIssueId,
      );
    }),

  // Get merged issues
  getMergedIssues: organizationProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }) => {
      const activityService = new IssueActivityService(ctx.db);
      const mergingService = new IssueMergingService(ctx.db, activityService);

      return mergingService.getMergedIssues(input.issueId);
    }),

  // Unmerge issue
  unmerge: issueEditProcedure
    .input(z.object({ issueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const activityService = new IssueActivityService(ctx.db);
      const mergingService = new IssueMergingService(ctx.db, activityService);

      await mergingService.unmergeIssue(
        input.issueId,
        ctx.organization.id,
        ctx.session.user.id,
      );

      return { success: true };
    }),

  // Get merge statistics
  getStats: organizationProcedure.query(async ({ ctx }) => {
    const activityService = new IssueActivityService(ctx.db);
    const mergingService = new IssueMergingService(ctx.db, activityService);

    return mergingService.getMergeStats(ctx.organization.id);
  }),
});
```

### 5. Update Main tRPC Router

Add merging router to `src/server/api/root.ts`:

```typescript
import { issueMergingRouter } from "./routers/issueMerging";

export const appRouter = createTRPCRouter({
  // ... existing routers
  issueMerging: issueMergingRouter,
});
```

### 6. Add Issue Merging Permissions

Update permissions in seed data:

```typescript
// In prisma/seed.ts or permission setup
{
  name: "issue:merge",
  roles: ["Admin", "Technician"] // Who can merge issues
},
{
  name: "issue:unmerge",
  roles: ["Admin"] // Who can unmerge issues (more restricted)
}
```

### 7. Update ActivityType Enum

Ensure MERGED activity type exists in `prisma/schema.prisma`:

```prisma
enum ActivityType {
  CREATED         // Issue created
  STATUS_CHANGED  // Status updated
  ASSIGNED        // Assignee changed
  PRIORITY_CHANGED // Priority updated
  COMMENTED       // Comment added
  ATTACHMENT_ADDED // File attached
  MERGED          // Issue merged
  RESOLVED        // Issue resolved
  REOPENED        // Issue reopened
  VISIBILITY_CHANGED // Issue visibility changed (public/internal)
  SYSTEM          // System-generated activity
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
# Should pass without merge-related errors
```

### 2. Test Issue Merging

1. Create two duplicate issues
2. Merge one into the other
3. Verify comments/attachments are copied
4. Test merge activity tracking

### 3. Test Duplicate Detection

1. Create issues for same machine
2. Test potential duplicate suggestions
3. Verify proper filtering

### 4. Test Unmerging

1. Merge an issue
2. Unmerge it
3. Verify it's restored properly
4. Test activity tracking

## Progress Notes

### Implementation Decisions Made:

- Added merge tracking fields to Issue model
- Created comprehensive merging service with transaction safety
- Implemented duplicate detection for same machine
- Added merge statistics for admin oversight

### Database Changes:

- Added isMerged, mergedIntoId, mergedAt, mergedById fields
- Added merge relations to Issue and User models
- Maintained referential integrity with proper constraints
- Added indexing for merge queries

### Service Architecture:

- Centralized IssueMergingService for all merge operations
- Transaction-based merging for data consistency
- Activity tracking integration
- Comprehensive merge statistics

## Rollback Procedure

```bash
# Restore schema
git checkout HEAD -- prisma/schema.prisma

# Remove merging files
rm src/server/services/issueMergingService.ts
rm src/server/api/routers/issueMerging.ts

# Restore activity service
git checkout HEAD -- src/server/services/issueActivityService.ts

# Reset database
npm run db:reset
```
