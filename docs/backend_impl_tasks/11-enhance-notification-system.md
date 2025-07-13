# Task 11: Enhance Notification System

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

## Workflow

- **Base Branch**: `epic/backend-refactor`
- **Task Branch**: `task/11-enhance-notification-system`
- **PR Target**: `epic/backend-refactor` (NOT main)

## Dependencies

- Task 03 (New Schema) must be completed first
- Independent of other tasks

## Objective

Complete the Notification model implementation to support machine owner notifications and future notification features. The current Notification model is incomplete and missing critical fields for user targeting and notification types.

## Status

- [ ] In Progress
- [ ] Completed

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
