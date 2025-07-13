# Task 08: Implement Comment Soft Delete System

## Prerequisites

**REQUIRED**: Read and understand `docs/planning/backend_impl_plan.md` before starting this task.

**Multi-Agent Coordination**: This task is part of Phase 3A parallel development. See @MULTI_AGENT_WORKFLOW.md for complete worktree setup, sync procedures, and coordination guidelines.

## Workflow

- **Base Branch**: `epic/backend-refactor`
- **Task Branch**: `task/08-implement-comment-soft-delete`
- **PR Target**: `epic/backend-refactor` (NOT main)
- **Worktree**: `~/Code/PinPoint-worktrees/task-08-implement-comment-soft-delete/`

## Dependencies

- Task 05 (Rebuild tRPC Authorization) must be completed first
- Independent of other tasks

## Objective

Implement soft delete functionality for comments to enable comment cleanup service and proper comment deletion tracking. Currently, the Comment model lacks `deletedAt` field, making the CommentCleanupService non-functional.

## Status

- [ ] In Progress
- [ ] Completed

## Current Issues

### 1. Missing deletedAt Field

The Comment model lacks soft delete capability:

- `CommentCleanupService.ts:13` - Cannot filter deleted comments
- `CommentCleanupService.ts:34` - Cannot count cleanup candidates
- `issueActivityService.ts:128` - Cannot properly handle comment deletion

### 2. Non-Functional Cleanup Service

`CommentCleanupService` is completely disabled:

- Returns hardcoded 0 for all cleanup operations
- No way to track deleted comments
- Cannot implement data retention policies

### 3. Missing Deletion Tracking

No audit trail for comment deletions:

- Cannot track who deleted a comment
- Cannot restore accidentally deleted comments
- No compliance support for data retention

## Implementation Steps

### 1. Update Comment Model Schema

Edit `prisma/schema.prisma`:

```prisma
model Comment {
  id        String   @id @default(cuid())
  content   String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Add soft delete fields
  deletedAt DateTime? // Null = not deleted, Date = soft deleted
  deletedBy String?   // Who deleted the comment (for audit trail)

  // Relations
  issueId   String
  authorId  String

  issue     Issue @relation(fields: [issueId], references: [id], onDelete: Cascade)
  author    User  @relation(fields: [authorId], references: [id])
  deleter   User? @relation("CommentDeleter", fields: [deletedBy], references: [id])
}
```

### 2. Update User Model

Add relation for comment deletion tracking:

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
  deletedComments Comment[] @relation("CommentDeleter") // Add this line
}
```

### 3. Implement CommentCleanupService

Update `src/server/services/commentCleanupService.ts`:

```typescript
import { type PrismaClient } from "@prisma/client";

export class CommentCleanupService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Permanently delete comments that have been soft-deleted for more than 90 days
   */
  async cleanupOldDeletedComments(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await this.prisma.comment.deleteMany({
      where: {
        deletedAt: {
          lte: ninetyDaysAgo,
        },
      },
    });

    return result.count;
  }

  /**
   * Get count of comments that will be cleaned up (for monitoring/reporting)
   */
  async getCleanupCandidateCount(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return this.prisma.comment.count({
      where: {
        deletedAt: {
          lte: ninetyDaysAgo,
        },
      },
    });
  }

  /**
   * Soft delete a comment (mark as deleted without removing from database)
   */
  async softDeleteComment(
    commentId: string,
    deletedById: string,
  ): Promise<void> {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
        deletedBy: deletedById,
      },
    });
  }

  /**
   * Restore a soft-deleted comment
   */
  async restoreComment(commentId: string): Promise<void> {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  /**
   * Get all soft-deleted comments for an organization (admin view)
   */
  async getDeletedComments(organizationId: string): Promise<Comment[]> {
    return this.prisma.comment.findMany({
      where: {
        deletedAt: { not: null },
        issue: {
          organizationId,
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        deleter: {
          select: {
            id: true,
            name: true,
          },
        },
        issue: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        deletedAt: "desc",
      },
    });
  }
}
```

### 4. Update Comment Queries

All comment queries must exclude soft-deleted comments by default:

```typescript
// Example: In tRPC comment router
async getIssueComments(issueId: string) {
  return this.prisma.comment.findMany({
    where: {
      issueId,
      deletedAt: null, // Exclude soft-deleted comments
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          profilePicture: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
```

### 5. Create Comment Management tRPC Router

Create `src/server/api/routers/comment.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  organizationProcedure,
  issueDeleteProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { CommentCleanupService } from "~/server/services/commentCleanupService";

export const commentRouter = createTRPCRouter({
  // Get comments for an issue (excludes deleted)
  getForIssue: organizationProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.comment.findMany({
        where: {
          issueId: input.issueId,
          deletedAt: null,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    }),

  // Soft delete a comment
  delete: issueDeleteProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.db.comment.findUnique({
        where: { id: input.commentId },
        include: {
          issue: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Verify comment belongs to user's organization
      if (comment.issue.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Comment not in organization",
        });
      }

      const cleanupService = new CommentCleanupService(ctx.db);
      await cleanupService.softDeleteComment(
        input.commentId,
        ctx.session.user.id,
      );

      return { success: true };
    }),

  // Admin: Get deleted comments
  getDeleted: organizationManageProcedure.query(async ({ ctx }) => {
    const cleanupService = new CommentCleanupService(ctx.db);
    return cleanupService.getDeletedComments(ctx.organization.id);
  }),

  // Admin: Restore deleted comment
  restore: organizationManageProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cleanupService = new CommentCleanupService(ctx.db);
      await cleanupService.restoreComment(input.commentId);
      return { success: true };
    }),

  // Admin: Get cleanup statistics
  getCleanupStats: organizationManageProcedure.query(async ({ ctx }) => {
    const cleanupService = new CommentCleanupService(ctx.db);
    const candidateCount = await cleanupService.getCleanupCandidateCount();

    return {
      candidateCount,
      cleanupThresholdDays: 90,
    };
  }),
});
```

### 6. Update IssueActivityService

Fix comment deletion tracking in `src/server/services/issueActivityService.ts`:

```typescript
async recordCommentDeleted(
  issueId: string,
  organizationId: string,
  actorId: string,
  commentId: string,
): Promise<void> {
  await this.recordActivity(issueId, organizationId, {
    type: ActivityType.COMMENT_DELETED,
    actorId,
    fieldName: "comment",
    oldValue: commentId,
    description: "Comment deleted",
  });
}
```

### 7. Add Comment Deletion Permission

Update permissions in seed data or create new permission:

```typescript
// In prisma/seed.ts or permission setup
{
  name: "comment:delete",
  roles: ["Admin", "Technician"] // Who can delete comments
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
# Should pass without comment-related errors
```

### 2. Test Soft Delete Functionality

```bash
# Test comment soft delete
npm run test src/server/services/__tests__/commentCleanupService.test.ts
```

### 3. Test Comment Queries

Verify:

- Regular queries exclude soft-deleted comments
- Admin queries can see deleted comments
- Restore functionality works
- Cleanup service functions properly

### 4. Manual Testing

1. Create a comment
2. Soft delete it
3. Verify it disappears from normal views
4. Check admin can see it in deleted list
5. Restore and verify it reappears

## Progress Notes

### Implementation Decisions Made:

- Used nullable `deletedAt` field for soft delete pattern
- Added `deletedBy` for audit trail
- Created comprehensive CommentCleanupService
- Added permission-based deletion with tRPC router

### Database Changes:

- Added deletedAt (DateTime?, nullable)
- Added deletedBy (String?, nullable)
- Added foreign key constraint for deleter
- Maintained backward compatibility

### Service Enhancements:

- Full soft delete lifecycle (delete/restore)
- Cleanup of old deleted comments
- Admin views for deleted content
- Proper authorization integration

## Rollback Procedure

```bash
# Restore schema
git checkout HEAD -- prisma/schema.prisma

# Restore service files
git checkout HEAD -- src/server/services/commentCleanupService.ts

# Remove new router
rm src/server/api/routers/comment.ts

# Reset database
npm run db:reset
```
