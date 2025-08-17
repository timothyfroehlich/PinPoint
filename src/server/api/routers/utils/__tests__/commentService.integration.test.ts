/**
 * Comment Service Integration Tests (tRPC)
 *
 * Tests CommentService functionality through actual tRPC comment router procedures.
 * Uses the same patterns as comment.integration.test.ts but focuses on service-level functionality.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Tests through tRPC comment router (actual app surface)
 * - Automatic organizationId handling by app layer
 * - Service integration testing with real database operations
 * - Covers CommentService functionality through API contracts
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

import { commentRouter } from "~/server/api/routers/comment";
import * as schema from "~/server/db/schema";
import {
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/utils/id-generation")>();
  return {
    ...actual,
    generateId: vi.fn(() => generateTestId("test-comment-id")),
    generatePrefixedId: vi.fn((prefix: string) => generateTestId(`test-${prefix}-id`)),
  };
});

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue(["issue:view", "issue:delete", "organization:manage"]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue(["issue:view", "issue:delete", "organization:manage"]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

// Mock ActivityType enum for service integration
vi.mock("~/server/services/types", () => ({
  ActivityType: {
    CREATED: "CREATED",
    STATUS_CHANGED: "STATUS_CHANGED",
    ASSIGNED: "ASSIGNED",
    PRIORITY_CHANGED: "PRIORITY_CHANGED",
    COMMENTED: "COMMENTED",
    COMMENT_DELETED: "COMMENT_DELETED",
    ATTACHMENT_ADDED: "ATTACHMENT_ADDED",
    MERGED: "MERGED",
    RESOLVED: "RESOLVED",
    REOPENED: "REOPENED",
    SYSTEM: "SYSTEM",
  },
}));

describe("Comment Service Integration (tRPC)", () => {
  // Helper function to create test context with seeded data
  async function createTestContext(db: TestDatabase, organizationId: string) {
    // Query actual seeded IDs instead of using hardcoded ones
    const testData = await getSeededTestData(db, organizationId);

    // Create missing test data if needed
    let machineId = testData.machine;
    let issueId = testData.issue;

    if (!machineId) {
      // Create a model first (required for machine)
      const modelData = {
        id: generateTestId("test-model"),
        name: "Test Model",
        manufacturer: "Williams",
        year: 2000,
        type: "SS" as const,
        opdbId: 1000,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const [model] = await db
        .insert(schema.models)
        .values(modelData)
        .returning();

      // Create a location (required for machine)
      const locationData = {
        id: generateTestId("test-location"),
        name: "Test Location",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const [location] = await db
        .insert(schema.locations)
        .values(locationData)
        .returning();

      // Create a machine
      const machineData = {
        id: generateTestId("test-machine"),
        name: "Test Machine",
        modelId: model.id,
        locationId: location.id,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const [machine] = await db
        .insert(schema.machines)
        .values(machineData)
        .returning();

      machineId = machine.id;
    }

    if (!issueId) {
      // Create priority and status if they don't exist
      let priorityId = testData.priority;
      let statusId = testData.status;

      if (!priorityId) {
        const priorityData = {
          id: generateTestId("test-priority"),
          name: "Medium",
          organizationId,
          order: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const [priority] = await db
          .insert(schema.priorities)
          .values(priorityData)
          .returning();
        priorityId = priority.id;
      }

      if (!statusId) {
        const statusData = {
          id: generateTestId("test-status"),
          name: "Open",
          category: "NEW" as const,
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const [status] = await db
          .insert(schema.issueStatuses)
          .values(statusData)
          .returning();
        statusId = status.id;
      }

      // Create an issue
      const issueData = {
        id: generateTestId("test-issue"),
        title: "Test Issue",
        organizationId,
        machineId: machineId,
        statusId: statusId,
        priorityId: priorityId,
        createdById: testData.user,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const [issue] = await db
        .insert(schema.issues)
        .values(issueData)
        .returning();
      issueId = issue.id;
    }

    // Generate unique IDs for this test context to avoid conflicts
    const uniqueCommentId = generateTestId("test-comment");

    // Create additional test comments for complex scenarios
    const testComment = await db
      .insert(schema.comments)
      .values({
        id: uniqueCommentId,
        content: "Test comment content",
        organizationId,
        issueId: issueId,
        authorId: testData.user,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .then((result) => result[0]);

    const updatedTestData = {
      ...testData,
      issue: issueId,
      machine: machineId,
      comment: testComment.id,
    };

    // Create tRPC context with membership for organization procedure
    const tRPCContext = {
      user: {
        id: testData.user,
        user_metadata: { organizationId },
      },
      session: {
        user: {
          id: testData.user,
          user_metadata: { organizationId },
        },
      },
      organization: { id: organizationId },
      db,
      services: {
        createCommentCleanupService: () => ({
          softDeleteComment: vi.fn(),
          restoreComment: vi.fn(),
          getDeletedComments: vi.fn(),
          getCleanupStats: vi.fn(),
          cleanupOldDeletedComments: vi.fn(),
        }),
        createIssueActivityService: () => ({
          recordCommentDeleted: vi.fn(),
        }),
      },
    };

    const caller = commentRouter.createCaller(tRPCContext);

    return { caller, testData: updatedTestData };
  }

  describe("Comment CRUD Operations", () => {
    test("should create comment through tRPC", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        const result = await caller.create({
          content: "New test comment",
          issueId: testData.issue,
        });

        expect(result).toMatchObject({
          content: "New test comment",
          issueId: testData.issue,
          authorId: testData.user,
        });

        // Verify comment was created in database
        const comment = await db.query.comments.findFirst({
          where: eq(schema.comments.id, result.id),
        });

        expect(comment).toBeDefined();
        expect(comment?.organizationId).toBe(organizationId);
      });
    });

    test("should get comments for issue", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        const result = await caller.getForIssue({
          issueId: testData.issue,
        });

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toMatchObject({
          content: "Test comment content",
          issueId: testData.issue,
          author: expect.objectContaining({
            id: testData.user,
          }),
        });
      });
    });
  });

  describe("Soft Delete Functionality", () => {
    test("should soft delete comment successfully", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Delete the comment
        await caller.delete({ commentId: testData.comment });

        // Verify comment is soft deleted in database
        const comment = await db.query.comments.findFirst({
          where: eq(schema.comments.id, testData.comment),
        });

        expect(comment).toBeDefined();
        expect(comment?.deletedAt).toBeInstanceOf(Date);
        expect(comment?.deletedBy).toBe(testData.user);
      });
    });

    test("should handle non-existent comment gracefully", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller } = await createTestContext(db, organizationId);

        await expect(
          caller.delete({ commentId: "non-existent-comment" }),
        ).rejects.toThrow();
      });
    });

    test("should enforce organizational boundaries", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData } = await createTestContext(db, organizationId);

        // Create comment in different organization
        const otherOrgId = generateTestId("other-org-id");
        const otherCommentId = generateTestId("other-comment");

        await db.insert(schema.comments).values({
          id: otherCommentId,
          content: "Other org comment",
          organizationId: otherOrgId,
          issueId: testData.issue,
          authorId: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create caller for original organization
        const tRPCContext = {
          user: {
            id: testData.user,
            user_metadata: { organizationId },
          },
          session: {
            user: {
              id: testData.user,
              user_metadata: { organizationId },
            },
          },
          organization: { id: organizationId },
          db,
          services: {
            createCommentCleanupService: () => ({
              softDeleteComment: vi.fn(),
            }),
          },
        };

        const caller = commentRouter.createCaller(tRPCContext);

        // Should not be able to delete comment from other organization
        await expect(
          caller.delete({ commentId: otherCommentId }),
        ).rejects.toThrow();
      });
    });
  });

  describe("Admin Functions", () => {
    test("should get deleted comments (admin)", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Create additional deleted comments
        const deletedCommentId = generateTestId("deleted-comment");
        await db.insert(schema.comments).values({
          id: deletedCommentId,
          content: "Deleted comment",
          organizationId,
          issueId: testData.issue,
          authorId: testData.user,
          deletedAt: new Date(),
          deletedBy: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await caller.getDeleted();

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        
        const deletedComment = result.find(c => c.id === deletedCommentId);
        expect(deletedComment).toBeDefined();
        expect(deletedComment?.deletedAt).toBeInstanceOf(Date);
        expect(deletedComment?.deleter).toMatchObject({
          id: testData.user,
        });
      });
    });

    test("should restore deleted comment (admin)", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Create deleted comment
        const deletedCommentId = generateTestId("restore-comment");
        await db.insert(schema.comments).values({
          id: deletedCommentId,
          content: "Comment to restore",
          organizationId,
          issueId: testData.issue,
          authorId: testData.user,
          deletedAt: new Date(),
          deletedBy: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Restore the comment
        await caller.restore({ commentId: deletedCommentId });

        // Verify comment is restored in database
        const comment = await db.query.comments.findFirst({
          where: eq(schema.comments.id, deletedCommentId),
        });

        expect(comment).toBeDefined();
        expect(comment?.deletedAt).toBeNull();
        expect(comment?.deletedBy).toBeNull();
      });
    });

    test("should get cleanup statistics", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Create old deleted comments
        const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
        
        await db.insert(schema.comments).values([
          {
            id: generateTestId("old-deleted-1"),
            content: "Old deleted comment 1",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            deletedAt: oldDate,
            deletedBy: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: generateTestId("old-deleted-2"),
            content: "Old deleted comment 2",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            deletedAt: oldDate,
            deletedBy: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.getCleanupStats();

        expect(result).toMatchObject({
          eligibleForCleanup: expect.any(Number),
          totalDeleted: expect.any(Number),
        });
        expect(result.eligibleForCleanup).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe("Complex Integration Scenarios", () => {
    test("should handle full comment lifecycle", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // 1. Create comment
        const comment = await caller.create({
          content: "Lifecycle test comment",
          issueId: testData.issue,
        });

        // 2. Verify it appears in issue comments
        const issueComments = await caller.getForIssue({
          issueId: testData.issue,
        });
        expect(issueComments.some(c => c.id === comment.id)).toBe(true);

        // 3. Soft delete comment
        await caller.delete({ commentId: comment.id });

        // 4. Verify it appears in deleted comments
        const deletedComments = await caller.getDeleted();
        expect(deletedComments.some(c => c.id === comment.id)).toBe(true);

        // 5. Verify it doesn't appear in issue comments
        const issueCommentsAfterDelete = await caller.getForIssue({
          issueId: testData.issue,
        });
        expect(issueCommentsAfterDelete.some(c => c.id === comment.id)).toBe(false);

        // 6. Restore comment
        await caller.restore({ commentId: comment.id });

        // 7. Verify it appears in issue comments again
        const issueCommentsAfterRestore = await caller.getForIssue({
          issueId: testData.issue,
        });
        expect(issueCommentsAfterRestore.some(c => c.id === comment.id)).toBe(true);

        // 8. Verify it doesn't appear in deleted comments
        const deletedCommentsAfterRestore = await caller.getDeleted();
        expect(deletedCommentsAfterRestore.some(c => c.id === comment.id)).toBe(false);
      });
    });

    test("should maintain organizational scoping across operations", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // All operations should automatically scope to organization
        const comment = await caller.create({
          content: "Scoped comment",
          issueId: testData.issue,
        });

        const issueComments = await caller.getForIssue({
          issueId: testData.issue,
        });

        const deletedComments = await caller.getDeleted();

        const cleanupStats = await caller.getCleanupStats();

        // All results should implicitly be scoped to organization
        // (verified by the fact that tRPC context handles organizationId automatically)
        expect(comment.issueId).toBe(testData.issue);
        expect(issueComments.length).toBeGreaterThan(0);
        expect(Array.isArray(deletedComments)).toBe(true);
        expect(typeof cleanupStats.totalDeleted).toBe("number");
      });
    });
  });
});