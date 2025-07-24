# Task 07: Fix IssueHistory Model Schema

## Agent Context

**You are a backend development agent** assigned to implement Task 07: Fix IssueHistory Model Schema. You are working in a coordinated multi-agent environment where multiple agents work in parallel on different backend tasks.

**Your Mission**: Fix the IssueHistory model to include missing fields required for proper issue activity tracking and multi-tenancy. Your work will enable Task 16 (Issue Merging) to begin.

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

**Multi-Agent Coordination**: This task is part of Phase 3A parallel development. See @MULTI_AGENT_WORKFLOW.md for complete worktree setup, sync procedures, and coordination guidelines.

**FIRST TIME SETUP**: You must run `./scripts/setup-worktree.sh` in your worktree to configure your development environment.

## Workflow

- **Base Branch**: `epic/backend-refactor`
- **Task Branch**: `task/07-fix-issue-history-model`
- **PR Target**: `epic/backend-refactor` (NOT main)
- **Worktree**: `~/Code/PinPoint-worktrees/task-07-fix-issue-history-model/`

## Dependencies

- Task 05 (Rebuild tRPC Authorization) must be completed first
- This task blocks proper issue activity tracking

## Objective

Fix the IssueHistory model to include missing fields required for proper issue activity tracking and multi-tenancy. The current model is missing `organizationId` for tenant isolation and `actorId` to track who performed the action.

## Status

- [ ] In Progress
- [ ] Completed

## Current Issues

### 1. Missing organizationId Field

The IssueHistory model lacks `organizationId` field, causing:

- Multi-tenancy violations in activity queries
- TypeScript errors in `issueActivityService.ts:24`
- Unable to properly filter activities by organization

### 2. Missing actorId Field

Activities cannot track who performed the action:

- No way to show "Admin assigned issue to John"
- Lost audit trail for compliance
- Poor user experience in activity feeds

### 3. Missing Activity Type System

Current `type: string` is too vague:

- No type safety for activity types
- Inconsistent activity naming
- Hard to build proper activity feeds

## Implementation Steps

### 1. Update IssueHistory Model in Schema

Edit `prisma/schema.prisma`:

```prisma
model IssueHistory {
  id             String   @id @default(cuid())
  field          String   // e.g., "status", "assignee", "priority"
  oldValue       String?
  newValue       String?
  changedAt      DateTime @default(now())

  // Add missing fields
  organizationId String   // For multi-tenancy
  actorId        String?  // Who performed the action (null for system actions)
  type           ActivityType // Replace string with proper enum

  // Relations
  issueId        String
  issue          Issue        @relation(fields: [issueId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  actor          User?        @relation("ActivityActor", fields: [actorId], references: [id])
}
```

### 2. Define Activity Type Enum

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
  SYSTEM          // System-generated activity
}
```

### 3. Update Organization Model

Add IssueHistory relation to Organization:

```prisma
model Organization {
  // ... existing fields

  // Relations
  memberships     Membership[]
  locations       Location[]
  roles           Role[]
  machines        Machine[]
  issues          Issue[]
  priorities      Priority[]
  issueStatuses   IssueStatus[]
  collectionTypes CollectionType[]
  issueHistory    IssueHistory[]    // Add this line
}
```

### 4. Update User Model

Add actor relation to User:

```prisma
model User {
  // ... existing fields

  // Relations
  accounts       Account[]
  sessions       Session[]
  memberships    Membership[]
  ownedMachines  Machine[] @relation("MachineOwner")
  issuesCreated  Issue[]   @relation("CreatedBy")
  issuesAssigned Issue[]   @relation("AssignedTo")
  comments       Comment[]
  upvotes        Upvote[]
  activityHistory IssueHistory[] @relation("ActivityActor") // Add this line
}
```

### 5. Update IssueActivityService

Fix `src/server/services/issueActivityService.ts`:

```typescript
import { type PrismaClient, ActivityType } from "@prisma/client";

export interface ActivityData {
  type: ActivityType; // Use enum instead of string
  actorId?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
}

export class IssueActivityService {
  constructor(private prisma: PrismaClient) {}

  async recordActivity(
    issueId: string,
    organizationId: string,
    activityData: ActivityData,
  ): Promise<void> {
    await this.prisma.issueHistory.create({
      data: {
        issueId,
        organizationId, // Now properly supported
        type: activityData.type,
        actorId: activityData.actorId,
        field: activityData.fieldName || "",
        oldValue: activityData.oldValue,
        newValue: activityData.newValue,
      },
    });
  }

  async recordIssueCreated(
    issueId: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.CREATED,
      actorId,
      fieldName: "status",
      newValue: "created",
    });
  }

  async recordStatusChange(
    issueId: string,
    organizationId: string,
    actorId: string,
    oldStatus: string,
    newStatus: string,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.STATUS_CHANGED,
      actorId,
      fieldName: "status",
      oldValue: oldStatus,
      newValue: newStatus,
    });
  }

  async recordAssignment(
    issueId: string,
    organizationId: string,
    actorId: string,
    oldAssignee: string | null,
    newAssignee: string | null,
  ): Promise<void> {
    await this.recordActivity(issueId, organizationId, {
      type: ActivityType.ASSIGNED,
      actorId,
      fieldName: "assignee",
      oldValue: oldAssignee,
      newValue: newAssignee,
    });
  }
}
```

### 6. Update Activity Queries

Fix activity retrieval in `issueActivityService.ts`:

```typescript
async getIssueActivity(
  issueId: string,
  organizationId: string,
): Promise<IssueHistoryWithActor[]> {
  return this.prisma.issueHistory.findMany({
    where: {
      issueId,
      organizationId, // Properly scope by organization
    },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          profilePicture: true,
        },
      },
    },
    orderBy: {
      changedAt: "desc",
    },
  });
}
```

### 7. Update Existing Activity Calls

Find and update all calls to activity service:

```bash
# Find files calling recordActivity
rg "recordActivity\|IssueActivityService" src/ --type ts

# Update each call to include organizationId and proper ActivityType
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
# Should pass without IssueHistory-related errors
```

### 2. Test Activity Recording

```bash
# Test that activities are properly recorded
npm run test src/server/services/__tests__/issueActivityService.test.ts
```

### 3. Verify Multi-Tenancy

Create test to verify:

- Activities are scoped by organizationId
- No cross-tenant activity leakage
- Actor information is properly recorded

### 4. Manual Testing

1. Create an issue
2. Change status
3. Assign to user
4. Verify activity feed shows proper attribution

## Progress Notes

### Implementation Decisions Made:

- Used enum for ActivityType for better type safety
- Added optional actorId (null for system actions)
- Maintained backward compatibility with existing field names
- Added proper multi-tenant scoping

### Database Changes:

- Added organizationId (String, required)
- Added actorId (String, optional)
- Changed type from string to ActivityType enum
- Added foreign key constraints for data integrity

### Service Updates:

- Enhanced ActivityData interface with enum types
- Added specific methods for common activities
- Improved query scoping for multi-tenancy
- Added actor information in activity retrieval

## Rollback Procedure

```bash
# Restore schema
git checkout HEAD -- prisma/schema.prisma

# Restore service files
git checkout HEAD -- src/server/services/issueActivityService.ts

# Reset database
npm run db:reset
```
