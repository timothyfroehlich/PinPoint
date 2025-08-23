/**
 * Comment Router Business Logic Integration Tests (PGlite)
 *
 * Tests comment router functionality and database operations with PGlite in-memory database.
 *
 * ⚠️  SECURITY BOUNDARIES ARE NOT TESTED HERE
 * Security boundary testing is done in pgTAP tests (supabase/tests/rls/)
 * PGlite cannot enforce RLS policies - this tests business logic only
 *
 * What this tests:
 * - Router function execution and error handling
 * - Database record creation, updates, and soft deletes
 * - Service integrations (CommentCleanupService, IssueActivityService)
 * - Data relationships and foreign key constraints
 * - Soft delete patterns and restoration logic
 *
 * What this does NOT test:
 * - Organizational data isolation (tested in pgTAP)
 * - RLS policy enforcement (impossible in PGlite)
 * - Cross-organizational access prevention (tested in pgTAP)
 *
 * Uses modern August 2025 patterns with memory-safe PGlite integration.
 */

import { describe, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "~/server/api/root";
import * as schema from "~/server/db/schema";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { createSeededIssueTestContext } from "~/test/helpers/createSeededIssueTestContext";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { generateTestId } from "~/test/helpers/test-id-generator";

// Mock external dependencies that aren't database-related (but not ID generation for integration tests)
// Integration tests use real seeded data with SEED_TEST_IDS constants

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue(["issue:view", "issue:delete", "organization:manage"]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue(["issue:view", "issue:delete", "organization:manage"]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

// Mock ActivityType enum to fix service integration
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

/**
 * Business Logic Test Setup Helper
 *
 * Tests application functionality and database operations ONLY.
 *
 * ⚠️  SECURITY BOUNDARIES ARE NOT TESTED HERE
 * Security boundary testing is done in pgTAP tests (supabase/tests/rls/)
 * PGlite cannot enforce RLS policies - this tests business logic only
 *
 * What this tests:
 * - Router function execution
 * - Database record creation/updates
 * - Service integrations
 * - Data relationships and constraints
 *
 * What this does NOT test:
 * - Organizational data isolation (pgTAP only)
 * - RLS policy enforcement (impossible in PGlite)
 * - Cross-organizational access prevention (pgTAP only)
 */
async function withCommentBusinessLogicSetup(workerDb, testFn) {
  await withIsolatedTest(workerDb, async (db) => {
    // Direct business logic setup - no RLS context needed
    const testContext = await createSeededIssueTestContext(
      db,
      SEED_TEST_IDS.ORGANIZATIONS.primary,
      SEED_TEST_IDS.USERS.ADMIN,
    );
    const caller = appRouter.createCaller(testContext);
    await testFn(db, caller, testContext);
  });
}

describe("Comment Router Integration (PGlite)", () => {
  describe("getForIssue", () => {
    test("should get comments for an issue with author info", async ({
      workerDb,
    }) => {
      await withCommentBusinessLogicSetup(workerDb, async (db, caller) => {
        // Create a comment for testing
        const uniqueCommentId = generateTestId("test-comment");
        await db.insert(schema.comments).values({
          id: uniqueCommentId,
          content: "Test comment content",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
          authorId: SEED_TEST_IDS.USERS.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Generate unique IDs for this test to avoid conflicts
        const comment2Id = generateTestId("comment-2");
        const comment3Id = generateTestId("comment-3-deleted");

        // Create additional test comments for comprehensive testing
        await db.insert(schema.comments).values([
          {
            id: comment2Id,
            content: "Second test comment",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
          },
          {
            id: comment3Id,
            content: "Deleted comment",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            deletedAt: new Date(), // Soft deleted
            deletedBy: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date("2024-01-03"),
            updatedAt: new Date("2024-01-03"),
          },
        ]);

        const result = await caller.comment.getForIssue({
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
        });

        expect(result).toHaveLength(2); // Should exclude deleted comment

        // Comments are ordered by createdAt, so the first one should be the earlier one
        // uniqueCommentId was created now, comment2Id was created at 2024-01-02
        // So comment2Id should come first (earlier date)
        expect(result[0]).toMatchObject({
          id: comment2Id,
          content: "Second test comment",
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
          authorId: SEED_TEST_IDS.USERS.ADMIN,
          deletedAt: null,
          deletedBy: null,
          author: {
            id: SEED_TEST_IDS.USERS.ADMIN,
            name: "Tim Froehlich",
            profilePicture: null,
          },
        });
        expect(result[0].createdAt).toBeInstanceOf(Date);
        expect(result[0].updatedAt).toBeInstanceOf(Date);

        // Verify second comment (uniqueCommentId created now, so comes after)
        expect(result[1]).toMatchObject({
          id: uniqueCommentId,
          content: "Test comment content",
        });

        // Verify soft-deleted comment is excluded
        expect(result.find((c) => c.id === comment3Id)).toBeUndefined();
      });
    });

    test("should handle empty results", async ({ workerDb }) => {
      await withCommentBusinessLogicSetup(workerDb, async (db, caller) => {
        const result = await caller.comment.getForIssue({
          issueId: "nonexistent-issue",
        });
        expect(result).toEqual([]);
      });
    });

    test("should order comments by creation date", async ({ workerDb }) => {
      await withCommentBusinessLogicSetup(workerDb, async (db, caller) => {
        // Create test comments
        const comment1Id = generateTestId("comment-1");
        const comment2Id = generateTestId("comment-2");

        // Create additional test comments for comprehensive testing
        await db.insert(schema.comments).values([
          {
            id: comment1Id,
            content: "First test comment",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
          {
            id: comment2Id,
            content: "Second test comment",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
          },
        ]);

        const result = await caller.comment.getForIssue({
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
        });

        expect(result).toHaveLength(2);
        expect(result[0].createdAt.getTime()).toBeLessThanOrEqual(
          result[1].createdAt.getTime(),
        );
      });
    });
  });

  describe("delete (soft delete)", () => {
    test("should soft delete a comment successfully", async ({ workerDb }) => {
      await withCommentBusinessLogicSetup(workerDb, async (db, caller) => {
        // Create a comment to delete
        const testCommentId = generateTestId("test-comment-to-delete");
        await db.insert(schema.comments).values({
          id: testCommentId,
          content: "Comment to delete",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
          authorId: SEED_TEST_IDS.USERS.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Verify comment exists before deletion
        const beforeDeletion = await db.query.comments.findFirst({
          where: eq(schema.comments.id, testCommentId),
        });
        expect(beforeDeletion).toBeDefined();
        expect(beforeDeletion?.deletedAt).toBeNull();

        const result = await caller.comment.delete({
          commentId: testCommentId,
        });

        expect(result).toEqual({ success: true });

        // Verify soft delete in database
        const afterDeletion = await db.query.comments.findFirst({
          where: eq(schema.comments.id, testCommentId),
        });
        expect(afterDeletion).toBeDefined();
        expect(afterDeletion?.deletedAt).toBeInstanceOf(Date);
        expect(afterDeletion?.deletedBy).toBe(SEED_TEST_IDS.USERS.ADMIN);

        // Verify comment is filtered out of normal queries
        const comments = await caller.comment.getForIssue({
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
        });
        expect(comments.find((c) => c.id === testCommentId)).toBeUndefined();

        // Verify issue activity was recorded
        const activities = await db.query.issueHistory.findMany({
          where: eq(
            schema.issueHistory.issueId,
            SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
          ),
        });
        expect(
          activities.some(
            (a) => a.type === "COMMENT_DELETED" && a.oldValue === testCommentId,
          ),
        ).toBe(true);
      });
    });

    test("should throw NOT_FOUND for non-existent comment", async ({
      workerDb,
    }) => {
      await withCommentBusinessLogicSetup(workerDb, async (db, caller) => {
        await expect(
          caller.comment.delete({ commentId: "nonexistent" }),
        ).rejects.toThrow("Comment not found");
      });
    });
  });

  describe("getDeleted (admin)", () => {
    test("should get deleted comments for organization managers", async ({
      workerDb,
    }) => {
      await withCommentBusinessLogicSetup(workerDb, async (db, caller) => {
        // Generate unique IDs for this test to avoid conflicts
        const deletedComment1Id = generateTestId("deleted-comment-1");
        const deletedComment2Id = generateTestId("deleted-comment-2");

        // Create deleted comments for testing
        await db.insert(schema.comments).values([
          {
            id: deletedComment1Id,
            content: "First deleted comment",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            deletedAt: new Date("2024-01-01"),
            deletedBy: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
          {
            id: deletedComment2Id,
            content: "Second deleted comment",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            deletedAt: new Date("2024-01-02"),
            deletedBy: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
          },
        ]);

        const result = await caller.comment.getDeleted();

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          id: deletedComment2Id, // Ordered by deletedAt desc
          content: "Second deleted comment",
          deletedAt: expect.any(Date),
          deletedBy: SEED_TEST_IDS.USERS.ADMIN,
        });
        expect(result[1]).toMatchObject({
          id: deletedComment1Id,
          content: "First deleted comment",
        });

        // Verify author and issue relationships
        expect(result[0]).toHaveProperty("author");
        expect(result[0]).toHaveProperty("issue");
      });
    });
  });

  describe("restore (admin)", () => {
    test("should restore a deleted comment", async ({ workerDb }) => {
      await withCommentBusinessLogicSetup(workerDb, async (db, caller) => {
        // Generate unique IDs for this test to avoid conflicts
        const restoreCommentId = generateTestId("restore-comment");

        // Create deleted comment for restoration testing
        await db.insert(schema.comments).values({
          id: restoreCommentId,
          content: "Comment to restore",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
          authorId: SEED_TEST_IDS.USERS.ADMIN,
          deletedAt: new Date(),
          deletedBy: SEED_TEST_IDS.USERS.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Verify comment is deleted before restoration
        const beforeRestore = await db.query.comments.findFirst({
          where: eq(schema.comments.id, restoreCommentId),
        });
        expect(beforeRestore).toBeDefined();
        expect(beforeRestore?.deletedAt).toBeInstanceOf(Date);

        const result = await caller.comment.restore({
          commentId: restoreCommentId,
        });

        expect(result).toEqual({ success: true });

        // Verify restoration in database
        const afterRestore = await db.query.comments.findFirst({
          where: eq(schema.comments.id, restoreCommentId),
        });
        expect(afterRestore).toBeDefined();
        expect(afterRestore?.deletedAt).toBeNull();
        expect(afterRestore?.deletedBy).toBeNull();

        // Verify comment appears in normal queries again
        const comments = await caller.comment.getForIssue({
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
        });
        expect(comments.find((c) => c.id === restoreCommentId)).toBeDefined();
      });
    });
  });

  describe("getCleanupStats (admin)", () => {
    test("should get cleanup statistics", async ({ workerDb }) => {
      await withCommentBusinessLogicSetup(workerDb, async (db, caller) => {
        // Create old deleted comments that qualify for cleanup
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 200); // 200 days ago (way > 90 day threshold)

        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 30); // 30 days ago (way < 90 day threshold)

        // Generate unique IDs for this test to avoid conflicts
        const oldDeleted1Id = generateTestId("old-deleted-1");
        const oldDeleted2Id = generateTestId("old-deleted-2");
        const recentDeletedId = generateTestId("recent-deleted");

        await db.insert(schema.comments).values([
          {
            id: oldDeleted1Id,
            content: "Old deleted comment 1",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            deletedAt: oldDate,
            deletedBy: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: oldDeleted2Id,
            content: "Old deleted comment 2",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            deletedAt: oldDate,
            deletedBy: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: recentDeletedId,
            content: "Recent deleted comment",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            deletedAt: recentDate,
            deletedBy: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.comment.getCleanupStats();

        expect(result).toEqual({
          candidateCount: 2, // Only the 2 old deleted comments qualify
          cleanupThresholdDays: 90,
        });
      });
    });
  });

  describe("Complex Integration Scenarios", () => {
    test("should handle concurrent soft delete operations correctly", async ({
      workerDb,
    }) => {
      await withCommentBusinessLogicSetup(workerDb, async (db, caller) => {
        // Generate unique IDs for this test to avoid conflicts
        const concurrent1Id = generateTestId("concurrent-1");
        const concurrent2Id = generateTestId("concurrent-2");

        // Create multiple comments for concurrent deletion
        await db.insert(schema.comments).values([
          {
            id: concurrent1Id,
            content: "Concurrent comment 1",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: concurrent2Id,
            content: "Concurrent comment 2",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
            authorId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Delete both comments concurrently
        const [result1, result2] = await Promise.all([
          caller.comment.delete({ commentId: concurrent1Id }),
          caller.comment.delete({ commentId: concurrent2Id }),
        ]);

        expect(result1).toEqual({ success: true });
        expect(result2).toEqual({ success: true });

        // Verify both comments are soft deleted
        const comment1 = await db.query.comments.findFirst({
          where: eq(schema.comments.id, concurrent1Id),
        });
        const comment2 = await db.query.comments.findFirst({
          where: eq(schema.comments.id, concurrent2Id),
        });

        expect(comment1?.deletedAt).toBeInstanceOf(Date);
        expect(comment2?.deletedAt).toBeInstanceOf(Date);

        // Verify activity records were created for both
        const activities = await db.query.issueHistory.findMany({
          where: eq(
            schema.issueHistory.issueId,
            SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
          ),
        });
        expect(
          activities.filter((a) => a.type === "COMMENT_DELETED"),
        ).toHaveLength(2);
      });
    });

    test("should maintain referential integrity across service operations", async ({
      workerDb,
    }) => {
      await withCommentBusinessLogicSetup(workerDb, async (db, caller) => {
        // Create a test comment for the lifecycle test
        const testCommentId = generateTestId("lifecycle-comment");
        await db.insert(schema.comments).values({
          id: testCommentId,
          content: "Comment for lifecycle test",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
          authorId: SEED_TEST_IDS.USERS.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Test complete comment lifecycle: create -> soft delete -> restore -> cleanup

        // 1. Soft delete the comment
        await caller.comment.delete({ commentId: testCommentId });

        // 2. Verify it appears in deleted comments
        const deletedComments = await caller.comment.getDeleted();
        expect(
          deletedComments.find((c) => c.id === testCommentId),
        ).toBeDefined();

        // 3. Restore the comment
        await caller.comment.restore({ commentId: testCommentId });

        // 4. Verify it no longer appears in deleted comments
        const deletedAfterRestore = await caller.comment.getDeleted();
        expect(
          deletedAfterRestore.find((c) => c.id === testCommentId),
        ).toBeUndefined();

        // 5. Verify it appears in normal queries
        const normalComments = await caller.comment.getForIssue({
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
        });
        expect(
          normalComments.find((c) => c.id === testCommentId),
        ).toBeDefined();
      });
    });
  });
});
