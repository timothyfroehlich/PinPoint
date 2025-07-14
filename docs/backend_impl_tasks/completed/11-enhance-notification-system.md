# Task 11: Enhance Notification System

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

**Multi-Agent Coordination**: This task is part of Phase 3B development. See @MULTI_AGENT_WORKFLOW.md for complete worktree setup, sync procedures, and coordination guidelines.

## Workflow

- **Base Branch**: `epic/backend-refactor`
- **Task Branch**: `task/11-enhance-notification-system`
- **PR Target**: `epic/backend-refactor` (NOT main)
- **Worktree**: `~/Code/PinPoint-worktrees/task-11-enhance-notification-system/`

## Dependencies

- Task 03 (New Schema) must be completed first
- Independent of other tasks

## Objective

Complete the Notification model implementation to support machine owner notifications and future notification features. The current Notification model is incomplete and missing critical fields for user targeting and notification types.

## Status

- [x] In Progress
- [x] Completed

## Current Issues

### 1. Incomplete Notification Model

Current model only has basic fields:

- Missing `userId` to target notifications
- Missing `type` for categorizing notifications
- Missing `entityId` for linking to related records
- Missing notification preferences

### 2. No Machine Owner Notification System

From CUJs 3.2 - Machine owners need to toggle notifications:

- No way to enable/disable notifications per machine
- No system to notify owners of new issues
- Missing notification preference management

### 3. No Notification Delivery System

Missing infrastructure for:

- Sending notifications
- Marking as read/unread
- Notification preferences by type

## Implementation Steps

### 1. Enhanced Notification Model

Update `prisma/schema.prisma`:

```prisma
model Notification {
  id        String   @id @default(cuid())
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  // Enhanced fields
  userId     String              // Who receives this notification
  type       NotificationType    // Category of notification
  entityType NotificationEntity? // What kind of entity (issue, machine, etc.)
  entityId   String?             // ID of the related entity
  actionUrl  String?             // URL to navigate to when clicked

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, read])
  @@index([userId, createdAt])
}

enum NotificationType {
  ISSUE_CREATED       // New issue on owned machine
  ISSUE_UPDATED       // Issue status changed
  ISSUE_ASSIGNED      // Issue assigned to user
  ISSUE_COMMENTED     // New comment on issue
  MACHINE_ASSIGNED    // Machine ownership assigned
  SYSTEM_ANNOUNCEMENT // System-wide announcements
}

enum NotificationEntity {
  ISSUE
  MACHINE
  COMMENT
  ORGANIZATION
}
```

### 2. Machine Ownership Notification Preferences

Add notification preferences to machine ownership:

```prisma
model Machine {
  id             String  @id @default(cuid())
  organizationId String
  locationId     String
  modelId        String
  ownerId        String?

  // Add notification preferences for owner
  ownerNotificationsEnabled Boolean @default(true) // Toggle for all notifications
  notifyOnNewIssues        Boolean @default(true) // Notify when new issues created
  notifyOnStatusChanges    Boolean @default(true) // Notify when issue status changes
  notifyOnComments         Boolean @default(false) // Notify on new comments

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  location     Location     @relation(fields: [locationId], references: [id])
  model        Model        @relation(fields: [modelId], references: [id])
  owner        User?        @relation("MachineOwner", fields: [ownerId], references: [id])
  issues       Issue[]
  collections  Collection[]
}
```

### 3. User Notification Preferences

Add global notification preferences to User model:

```prisma
model User {
  // ... existing fields

  // Global notification preferences
  emailNotificationsEnabled Boolean @default(true)
  pushNotificationsEnabled  Boolean @default(false) // For future mobile app
  notificationFrequency     NotificationFrequency @default(IMMEDIATE)

  // Relations
  accounts       Account[]
  sessions       Session[]
  memberships    Membership[]
  ownedMachines  Machine[] @relation("MachineOwner")
  issuesCreated  Issue[]   @relation("CreatedBy")
  issuesAssigned Issue[]   @relation("AssignedTo")
  comments       Comment[]
  upvotes        Upvote[]
  notifications  Notification[] // Add notification relation
}

enum NotificationFrequency {
  IMMEDIATE // Send immediately
  DAILY     // Daily digest
  WEEKLY    // Weekly digest
  DISABLED  // No notifications
}
```

### 4. Create NotificationService

Create `src/server/services/notificationService.ts`:

```typescript
import {
  type PrismaClient,
  NotificationType,
  NotificationEntity,
} from "@prisma/client";

export interface NotificationData {
  userId: string;
  type: NotificationType;
  message: string;
  entityType?: NotificationEntity;
  entityId?: string;
  actionUrl?: string;
}

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new notification
   */
  async createNotification(data: NotificationData): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
      },
    });
  }

  /**
   * Notify machine owner of new issue
   */
  async notifyMachineOwnerOfIssue(
    issueId: string,
    machineId: string,
  ): Promise<void> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        owner: true,
        model: true,
        issues: {
          where: { id: issueId },
          select: {
            title: true,
          },
        },
      },
    });

    if (
      !machine?.owner ||
      !machine.ownerNotificationsEnabled ||
      !machine.notifyOnNewIssues
    ) {
      return; // No owner, notifications disabled, or new issue notifications disabled
    }

    const issue = machine.issues[0];
    if (!issue) return;

    await this.createNotification({
      userId: machine.owner.id,
      type: NotificationType.ISSUE_CREATED,
      message: `New issue reported on your ${machine.model.name}: "${issue.title}"`,
      entityType: NotificationEntity.ISSUE,
      entityId: issueId,
      actionUrl: `/issues/${issueId}`,
    });
  }

  /**
   * Notify machine owner of issue status change
   */
  async notifyMachineOwnerOfStatusChange(
    issueId: string,
    oldStatus: string,
    newStatus: string,
  ): Promise<void> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        machine: {
          include: {
            owner: true,
            model: true,
          },
        },
      },
    });

    if (
      !issue?.machine.owner ||
      !issue.machine.ownerNotificationsEnabled ||
      !issue.machine.notifyOnStatusChanges
    ) {
      return;
    }

    await this.createNotification({
      userId: issue.machine.owner.id,
      type: NotificationType.ISSUE_UPDATED,
      message: `Issue status changed on your ${issue.machine.model.name}: ${oldStatus} → ${newStatus}`,
      entityType: NotificationEntity.ISSUE,
      entityId: issueId,
      actionUrl: `/issues/${issueId}`,
    });
  }

  /**
   * Notify user of issue assignment
   */
  async notifyUserOfAssignment(
    issueId: string,
    assignedUserId: string,
  ): Promise<void> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        machine: {
          include: {
            model: true,
          },
        },
      },
    });

    if (!issue) return;

    await this.createNotification({
      userId: assignedUserId,
      type: NotificationType.ISSUE_ASSIGNED,
      message: `You were assigned to issue: "${issue.title}" on ${issue.machine.model.name}`,
      entityType: NotificationEntity.ISSUE,
      entityId: issueId,
      actionUrl: `/issues/${issueId}`,
    });
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly && { read: false }),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: options.limit || 50,
      skip: options.offset || 0,
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns the notification
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }
}
```

### 5. Create Notification tRPC Router

Create `src/server/api/routers/notification.ts`:

```typescript
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { NotificationService } from "~/server/services/notificationService";

export const notificationRouter = createTRPCRouter({
  // Get user's notifications
  getNotifications: protectedProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const service = new NotificationService(ctx.db);
      return service.getUserNotifications(ctx.session.user.id, input);
    }),

  // Get unread count
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const service = new NotificationService(ctx.db);
    return service.getUnreadCount(ctx.session.user.id);
  }),

  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new NotificationService(ctx.db);
      await service.markAsRead(input.notificationId, ctx.session.user.id);
      return { success: true };
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const service = new NotificationService(ctx.db);
    await service.markAllAsRead(ctx.session.user.id);
    return { success: true };
  }),
});
```

### 6. Integrate Notifications with Issue Operations

Update issue operations to trigger notifications:

```typescript
// In issue router create mutation
async createIssue(...) {
  // ... create issue logic

  // Notify machine owner
  const notificationService = new NotificationService(ctx.db);
  await notificationService.notifyMachineOwnerOfIssue(
    newIssue.id,
    input.machineId,
  );
}

// In issue router status update mutation
async updateStatus(...) {
  // ... update status logic

  // Notify machine owner of status change
  const notificationService = new NotificationService(ctx.db);
  await notificationService.notifyMachineOwnerOfStatusChange(
    input.issueId,
    oldStatus.name,
    newStatus.name,
  );
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
# Should pass without notification-related errors
```

### 2. Test Notification System

1. Create issue on machine with owner
2. Verify owner receives notification
3. Test notification preferences
4. Test marking as read

### 3. Test Machine Owner Preferences

1. Toggle machine notification settings
2. Verify notifications respect preferences
3. Test different notification types

## Progress Notes

### Implementation Decisions Made:

- Added comprehensive notification types enum
- Separated machine-level and user-level preferences
- Included entity linking for rich notifications
- Added notification frequency options for future use

### Database Changes:

- Enhanced Notification model with targeting and categorization
- Added notification preferences to Machine model
- Added global notification preferences to User model
- Maintained performance with proper indexing

### Service Architecture:

- Centralized NotificationService for all notification operations
- Integration points with issue operations
- Flexible notification creation system

## Implementation Completed

### What Was Implemented:

1. ✅ **Enhanced Notification Model** (prisma/schema.prisma:350-368)
   - Added userId, type, entityType, entityId, actionUrl fields
   - Added NotificationType enum with 6 notification categories
   - Added NotificationEntity enum for linking to related entities
   - Added proper database indexes for performance

2. ✅ **Machine Notification Preferences** (prisma/schema.prisma:179-183)
   - Added ownerNotificationsEnabled (global toggle)
   - Added notifyOnNewIssues preference
   - Added notifyOnStatusChanges preference
   - Added notifyOnComments preference

3. ✅ **User Global Notification Preferences** (prisma/schema.prisma:30-33)
   - Added emailNotificationsEnabled preference
   - Added pushNotificationsEnabled for future mobile app
   - Added notificationFrequency enum (IMMEDIATE, DAILY, WEEKLY, DISABLED)

4. ✅ **NotificationService** (src/server/services/notificationService.ts)
   - Complete service with all notification methods
   - Machine owner notification for new issues
   - Machine owner notification for status changes
   - User assignment notifications
   - Generic notification creation
   - Notification retrieval, marking as read, unread counts

5. ✅ **Notification tRPC Router** (src/server/api/routers/notification.ts)
   - getNotifications procedure with filtering options
   - getUnreadCount procedure
   - markAsRead procedure
   - markAllAsRead procedure
   - Integrated with main router (src/server/api/root.ts:29)

6. ✅ **Issue Operation Integration** (src/server/api/routers/issue.core.ts)
   - Notification calls on issue creation (lines 111-115)
   - Notification calls on status changes (lines 426-431)
   - Notification calls on assignment changes (lines 446-452)

### Database Schema Verified:

- All new fields deployed successfully to database
- Schema verification test passed
- Database indexes created properly

### Files Created/Modified:

- `prisma/schema.prisma` - Enhanced models and enums
- `src/server/services/notificationService.ts` - New service
- `src/server/api/routers/notification.ts` - New router
- `src/server/api/root.ts` - Added notification router
- `src/server/api/routers/issue.core.ts` - Added notification integration

### Future Enhancements Ready:

- Email notification delivery can be added to NotificationService
- Push notification support framework in place
- Notification frequency options available for batch processing
- Comment notifications ready to implement

## Backend Testing Plan

### Phase 1: Immediate Backend Tests (Ready Now)

These tests can be implemented and run immediately with the current backend implementation:

#### 1. NotificationService Unit Tests

**File**: `src/server/services/__tests__/notificationService.test.ts`

**Test Coverage**:

- ✅ **Basic notification creation** - Verify `createNotification()` works with all field combinations
- ✅ **Machine owner new issue notification** - Test `notifyMachineOwnerOfIssue()` with various scenarios:
  - Machine with owner and notifications enabled
  - Machine with owner but notifications disabled
  - Machine without owner
  - Different notification preference combinations
- ✅ **Status change notifications** - Test `notifyMachineOwnerOfStatusChange()`:
  - Status changes with notifications enabled
  - Status changes with notifications disabled
  - Invalid issue IDs
- ✅ **Assignment notifications** - Test `notifyUserOfAssignment()`:
  - Valid user assignments
  - Invalid issue/user combinations
- ✅ **Notification retrieval** - Test `getUserNotifications()`:
  - With and without filters (unreadOnly, limit, offset)
  - Proper ordering by creation date
  - Empty result sets
- ✅ **Mark as read functionality** - Test `markAsRead()` and `markAllAsRead()`:
  - Individual notification marking
  - Bulk operations
  - User ownership validation
- ✅ **Unread count calculation** - Test `getUnreadCount()` accuracy

**Implementation Priority**: High - Core service validation

#### 2. Notification tRPC Router Tests

**File**: `src/server/api/routers/__tests__/notification.test.ts`

**Test Coverage**:

- ✅ **getNotifications endpoint** - Test query with authentication and filtering
- ✅ **getUnreadCount endpoint** - Test unread count retrieval
- ✅ **markAsRead endpoint** - Test individual notification marking
- ✅ **markAllAsRead endpoint** - Test bulk read operations
- ✅ **Authentication requirements** - Verify all endpoints require valid sessions
- ✅ **Input validation** - Test with invalid/missing parameters
- ✅ **Multi-tenancy** - Verify users can only access their own notifications

**Implementation Priority**: High - API contract validation

#### 3. Issue Integration Tests

**File**: `src/server/api/routers/__tests__/issue.notification.test.ts`

**Test Coverage**:

- ✅ **Issue creation triggers notifications** - Test issue.core.create calls NotificationService
- ✅ **Status change triggers notifications** - Test issue.core.update with status changes
- ✅ **Assignment triggers notifications** - Test issue.core.update with assignment changes
- ✅ **Notification preference respect** - Verify preferences are honored in all scenarios
- ✅ **Multiple notification types** - Test combinations of changes triggering multiple notifications

**Implementation Priority**: High - Integration point validation

#### 4. Database Schema Integration Tests

**File**: `src/server/api/__tests__/notification.schema.test.ts`

**Test Coverage**:

- ✅ **Schema constraints validation** - Test required fields, foreign keys, indexes
- ✅ **Enum value validation** - Test NotificationType and NotificationEntity enums
- ✅ **Cascade delete behavior** - Test user deletion removes notifications
- ✅ **Default value behavior** - Test machine and user notification preference defaults
- ✅ **Index performance** - Verify queries use proper indexes

**Implementation Priority**: Medium - Schema contract validation

#### 5. Notification Preference Logic Tests

**File**: `src/server/services/__tests__/notificationPreferences.test.ts`

**Test Coverage**:

- ✅ **Machine-level preference filtering** - Test all machine notification toggles
- ✅ **User-level preference filtering** - Test global user notification settings
- ✅ **Preference hierarchy** - Test interaction between user and machine preferences
- ✅ **Default preference behavior** - Test new users and machines get correct defaults

**Implementation Priority**: Medium - Business logic validation

### Implementation Commands

```bash
# 1. Create NotificationService unit tests
npm run test:create src/server/services/__tests__/notificationService.test.ts

# 2. Create tRPC router tests
npm run test:create src/server/api/routers/__tests__/notification.test.ts

# 3. Create issue integration tests
npm run test:create src/server/api/routers/__tests__/issue.notification.test.ts

# 4. Run all notification tests
npm run test -- --testPathPattern=notification

# 5. Generate coverage report
npm run test:coverage -- --testPathPattern=notification
```

### Test Database Setup

All notification tests will use the existing test database setup with:

- Isolated test transactions
- Seeded test data for organizations, users, machines, and issues
- Proper cleanup between tests

### Success Criteria for Backend Tests

- ✅ **100% unit test coverage** for NotificationService methods
- ✅ **All tRPC endpoints tested** with success and error cases
- ✅ **Integration tests pass** for issue creation/updates triggering notifications
- ✅ **Schema validation** ensures data integrity
- ✅ **Performance tests** verify notification queries are efficient

### Blocking Issues to Address First

1. **Fix existing TypeScript errors** - The pinballmapService tests need Machine model updates
2. **Update seed data** - Ensure seed works with new notification preference fields
3. **Test framework setup** - Verify Jest works with new notification enums

### Estimated Timeline

- **NotificationService tests**: 4-6 hours
- **tRPC router tests**: 2-3 hours
- **Issue integration tests**: 3-4 hours
- **Schema validation tests**: 2-3 hours
- **Total**: 11-16 hours implementation time

### Phase 2: Frontend-Dependent Tests (Future)

Frontend-dependent tests are tracked in **GitHub Issue #79**: [Frontend Notification System Testing - Phase 2](https://github.com/timothyfroehlich/PinPoint/issues/79)

These tests require frontend UI components and include:

- End-to-end UI notification tests (notification bell, dropdown, mark as read)
- Notification settings UI tests (user preferences, machine settings)
- Real-time notification delivery tests (WebSocket/SSE integration)
- Email notification integration tests (actual delivery, templates)
- Mobile push notification tests (when mobile app is developed)
- Accessibility testing (screen readers, keyboard navigation)

**Estimated Timeline**: 27-38 hours total across multiple phases as frontend features are developed.

## Rollback Procedure

```bash
# Restore schema
git checkout HEAD -- prisma/schema.prisma

# Remove notification files
rm src/server/services/notificationService.ts
rm src/server/api/routers/notification.ts

# Reset database
npm run db:reset
```
