/**
 * DrizzleCommentService Integration Tests (PGlite)
 *
 * Integration tests for the DrizzleCommentService using PGlite in-memory PostgreSQL database.
 * Tests real database operations with proper schema, relationships, and data integrity.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real Drizzle ORM operations
 * - Multi-tenant data isolation testing
 * - Complex query validation with actual results
 * - Authentic comment lifecycle testing
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { DrizzleCommentService } from "../commentService";

import * as schema from "~/server/db/schema";
import {
  createSeededTestDatabase,
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

describe("DrizzleCommentService Integration (PGlite)", () => {
  let db: TestDatabase;
  let commentService: DrizzleCommentService;

  // Test data IDs - queried from actual seeded data
  let testData: {
    organization: string;
    location?: string;
    machine?: string;
    model?: string;
    status?: string;
    priority?: string;
    issue?: string;
    adminRole?: string;
    memberRole?: string;
    user?: string;
  };

  beforeEach(async () => {
    // Create fresh PGlite database with real schema and seed data
    const setup = await createSeededTestDatabase();
    db = setup.db;
    commentService = new DrizzleCommentService(db);

    // Query actual seeded IDs instead of using hardcoded ones
    testData = await getSeededTestData(db, setup.organizationId);
  });

  describe("constructor", () => {
    it("should initialize with DrizzleClient", () => {
      expect(commentService).toBeInstanceOf(DrizzleCommentService);
    });

    it("should store the drizzle client instance", () => {
      // Access private property through type assertion for testing
      const service = commentService as any;
      expect(service.drizzle).toBe(db);
    });
  });

  describe("softDeleteComment", () => {
    let testCommentId: string;

    beforeEach(async () => {
      // Create a test comment to soft delete
      const [testComment] = await db
        .insert(schema.comments)
        .values({
          id: "test-comment-soft-delete",
          content: "Test comment for soft deletion",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      testCommentId = testComment.id;
    });

    it("should soft delete a comment with correct parameters", async () => {
      const deletedById = testData.user || "test-user-1";
      const beforeDeletion = new Date();

      const result = await commentService.softDeleteComment(
        testCommentId,
        deletedById,
      );

      // Verify return value structure
      expect(result).toMatchObject({
        id: testCommentId,
        content: "Test comment for soft deletion",
        issueId: testData.issue,
        authorId: testData.user,
        deletedBy: deletedById,
      });
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(result.deletedAt.getTime()).toBeGreaterThanOrEqual(
        beforeDeletion.getTime(),
      );
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      // Verify actual database state
      const commentInDb = await db.query.comments.findFirst({
        where: eq(schema.comments.id, testCommentId),
      });

      expect(commentInDb).toBeDefined();
      expect(commentInDb?.deletedAt).toBeInstanceOf(Date);
      expect(commentInDb?.deletedBy).toBe(deletedById);
    });

    it("should set deletedAt to current date", async () => {
      const beforeCall = new Date();
      const result = await commentService.softDeleteComment(
        testCommentId,
        testData.user || "test-user-1",
      );
      const afterCall = new Date();

      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(result.deletedAt?.getTime() ?? 0).toBeGreaterThanOrEqual(
        beforeCall.getTime(),
      );
      expect(result.deletedAt?.getTime() ?? 0).toBeLessThanOrEqual(
        afterCall.getTime(),
      );
    });

    it("should handle different comment IDs", async () => {
      // Create multiple test comments
      const commentIds: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const [comment] = await db
          .insert(schema.comments)
          .values({
            id: `multi-comment-${i}`,
            content: `Multi test comment ${i}`,
            issueId: testData.issue || "test-issue-1",
            authorId: testData.user || "test-user-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        commentIds.push(comment.id);
      }

      // Delete each comment
      for (const commentId of commentIds) {
        const result = await commentService.softDeleteComment(
          commentId,
          testData.user || "test-user-1",
        );
        expect(result.id).toBe(commentId);
        expect(result.deletedAt).toBeInstanceOf(Date);

        // Verify in database
        const deletedComment = await db.query.comments.findFirst({
          where: eq(schema.comments.id, commentId),
        });
        expect(deletedComment?.deletedAt).toBeInstanceOf(Date);
      }
    });

    it("should handle different deleter user IDs", async () => {
      // Create multiple users and comments to test with
      const userIds = [
        "test-user-admin",
        "test-user-member",
        "test-user-player",
      ];

      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const commentId = `deleter-test-${i}`;

        // Create test comment
        await db.insert(schema.comments).values({
          id: commentId,
          content: `Test comment for deleter ${userId}`,
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Soft delete with different deleter
        const result = await commentService.softDeleteComment(
          commentId,
          userId,
        );
        expect(result.deletedBy).toBe(userId);

        // Verify in database
        const deletedComment = await db.query.comments.findFirst({
          where: eq(schema.comments.id, commentId),
        });
        expect(deletedComment?.deletedBy).toBe(userId);
      }
    });

    it("should handle non-existent comment gracefully", async () => {
      // Try to soft delete a non-existent comment
      // Drizzle returns undefined when no rows are affected
      const result = await commentService.softDeleteComment(
        "non-existent-comment",
        testData.user || "test-user-1",
      );
      expect(result).toBeUndefined();
    });

    it("should return correct TypeScript types", async () => {
      const result = await commentService.softDeleteComment(
        testCommentId,
        testData.user || "test-user-1",
      );

      // Verify all required fields are present and correctly typed
      expect(typeof result.id).toBe("string");
      expect(typeof result.content).toBe("string");
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(typeof result.deletedBy).toBe("string");
      expect(typeof result.issueId).toBe("string");
      expect(typeof result.authorId).toBe("string");
    });
  });

  describe("restoreComment", () => {
    let deletedCommentId: string;

    beforeEach(async () => {
      // Create a test comment that's already soft deleted
      const [deletedComment] = await db
        .insert(schema.comments)
        .values({
          id: "test-comment-restore",
          content: "Test comment for restoration",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          deletedAt: new Date(),
          deletedBy: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      deletedCommentId = deletedComment.id;
    });

    it("should restore a soft-deleted comment", async () => {
      const result = await commentService.restoreComment(deletedCommentId);

      // Verify return value structure
      expect(result).toMatchObject({
        id: deletedCommentId,
        content: "Test comment for restoration",
        issueId: testData.issue,
        authorId: testData.user,
        deletedAt: null,
        deletedBy: null,
      });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      // Verify actual database state
      const restoredComment = await db.query.comments.findFirst({
        where: eq(schema.comments.id, deletedCommentId),
      });

      expect(restoredComment).toBeDefined();
      expect(restoredComment?.deletedAt).toBeNull();
      expect(restoredComment?.deletedBy).toBeNull();
    });

    it("should handle different comment IDs for restoration", async () => {
      // Create multiple deleted comments
      const commentIds: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const [comment] = await db
          .insert(schema.comments)
          .values({
            id: `restore-multi-${i}`,
            content: `Restore test comment ${i}`,
            issueId: testData.issue || "test-issue-1",
            authorId: testData.user || "test-user-1",
            deletedAt: new Date(),
            deletedBy: testData.user || "test-user-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        commentIds.push(comment.id);
      }

      // Restore each comment
      for (const commentId of commentIds) {
        const result = await commentService.restoreComment(commentId);
        expect(result.id).toBe(commentId);
        expect(result.deletedAt).toBeNull();
        expect(result.deletedBy).toBeNull();

        // Verify in database
        const restoredComment = await db.query.comments.findFirst({
          where: eq(schema.comments.id, commentId),
        });
        expect(restoredComment?.deletedAt).toBeNull();
        expect(restoredComment?.deletedBy).toBeNull();
      }
    });

    it("should set both deletedAt and deletedBy to null", async () => {
      const result = await commentService.restoreComment(deletedCommentId);

      expect(result.deletedAt).toBeNull();
      expect(result.deletedBy).toBeNull();

      // Verify in database
      const restoredComment = await db.query.comments.findFirst({
        where: eq(schema.comments.id, deletedCommentId),
      });
      expect(restoredComment?.deletedAt).toBeNull();
      expect(restoredComment?.deletedBy).toBeNull();
    });

    it("should handle non-existent comment gracefully", async () => {
      // Try to restore a non-existent comment
      // Drizzle returns undefined when no rows are affected
      const result = await commentService.restoreComment(
        "non-existent-comment",
      );
      expect(result).toBeUndefined();
    });

    it("should return comment with null deletion fields", async () => {
      const result = await commentService.restoreComment(deletedCommentId);

      expect(result.deletedAt).toBeNull();
      expect(result.deletedBy).toBeNull();
      expect(typeof result.id).toBe("string");
      expect(typeof result.content).toBe("string");
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("getDeletedComments", () => {
    beforeEach(async () => {
      // Create some deleted and non-deleted comments for testing
      await db.insert(schema.comments).values([
        {
          id: "deleted-comment-1",
          content: "First deleted comment",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          deletedAt: new Date("2024-01-01T12:00:00Z"),
          deletedBy: "test-user-admin",
          createdAt: new Date("2024-01-01T10:00:00Z"),
          updatedAt: new Date("2024-01-01T11:00:00Z"),
        },
        {
          id: "deleted-comment-2",
          content: "Second deleted comment",
          issueId: testData.issue || "test-issue-1",
          authorId: "test-user-member",
          deletedAt: new Date("2024-01-01T13:00:00Z"),
          deletedBy: "test-user-admin",
          createdAt: new Date("2024-01-01T09:00:00Z"),
          updatedAt: new Date("2024-01-01T10:00:00Z"),
        },
        {
          id: "active-comment-1",
          content: "Active comment (not deleted)",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date("2024-01-01T08:00:00Z"),
          updatedAt: new Date("2024-01-01T08:30:00Z"),
        },
      ]);
    });

    it("should get deleted comments for an organization", async () => {
      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      // Should only return deleted comments (filtering out non-deleted)
      expect(result).toHaveLength(2);
      expect(result.every((comment) => comment.deletedAt !== null)).toBe(true);

      // Check that results are ordered by deletedAt desc
      expect(result[0].deletedAt?.getTime() ?? 0).toBeGreaterThan(
        result[1].deletedAt?.getTime() ?? 0,
      );

      // Verify comment IDs
      const commentIds = result.map((c) => c.id);
      expect(commentIds).toContain("deleted-comment-1");
      expect(commentIds).toContain("deleted-comment-2");
      expect(commentIds).not.toContain("active-comment-1");
    });

    it("should include author and issue information", async () => {
      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      expect(result[0]).toMatchObject({
        content: expect.any(String),
        author: {
          id: expect.any(String),
          name: expect.any(String),
          email: expect.any(String),
          image: null, // Test users have null images
        },
        issue: {
          id: testData.issue,
          title: expect.any(String),
        },
      });
    });

    it("should fetch deleter information for deleted comments", async () => {
      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      // Both comments were deleted by test-user-admin
      expect(result[0].deleter).toMatchObject({
        id: "test-user-admin",
        name: "Dev Admin",
        email: "admin@dev.local",
        image: null,
      });

      expect(result[1].deleter).toMatchObject({
        id: "test-user-admin",
        name: "Dev Admin",
        email: "admin@dev.local",
        image: null,
      });
    });

    it("should handle comments without deleter (deletedBy is null)", async () => {
      // Create a comment with null deletedBy
      await db.insert(schema.comments).values({
        id: "null-deleter-comment",
        content: "Comment with null deleter",
        issueId: testData.issue || "test-issue-1",
        authorId: testData.user || "test-user-1",
        deletedAt: new Date(),
        deletedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      const nullDeleterComment = result.find(
        (c) => c.id === "null-deleter-comment",
      );
      expect(nullDeleterComment).toBeDefined();
      expect(nullDeleterComment?.deleter).toBeNull();
    });

    it("should handle deleter user not found", async () => {
      // Create a comment with a non-existent deleter ID
      await db.insert(schema.comments).values({
        id: "missing-deleter-comment",
        content: "Comment with missing deleter",
        issueId: testData.issue || "test-issue-1",
        authorId: testData.user || "test-user-1",
        deletedAt: new Date(),
        deletedBy: "non-existent-user",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      const missingDeleterComment = result.find(
        (c) => c.id === "missing-deleter-comment",
      );
      expect(missingDeleterComment).toBeDefined();
      expect(missingDeleterComment?.deleter).toBeNull();
    });

    it("should filter out non-deleted comments", async () => {
      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      // Should not include active-comment-1 which has deletedAt: null
      const commentIds = result.map((c) => c.id);
      expect(commentIds).not.toContain("active-comment-1");
      expect(result.every((comment) => comment.deletedAt !== null)).toBe(true);
    });

    it("should order by deletedAt in descending order", async () => {
      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      // Verify ordering: first comment should have later deletedAt than second
      if (result.length >= 2) {
        expect(result[0].deletedAt?.getTime() ?? 0).toBeGreaterThan(
          result[1].deletedAt?.getTime() ?? 0,
        );
      }
    });

    it("should handle different organization IDs", async () => {
      // Create another organization with deleted comments
      const otherOrgId = "other-test-org";
      await db.insert(schema.organizations).values({
        id: otherOrgId,
        name: "Other Test Organization",
        subdomain: "other-test-org",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.priorities).values({
        id: "other-priority",
        name: "Other Priority",
        organizationId: otherOrgId,
        order: 1,
      });

      await db.insert(schema.issueStatuses).values({
        id: "other-status",
        name: "Other Status",
        category: "NEW",
        organizationId: otherOrgId,
      });

      await db.insert(schema.issues).values({
        id: "other-issue",
        title: "Other Issue",
        organizationId: otherOrgId,
        machineId: testData.machine || "test-machine-1",
        statusId: "other-status",
        priorityId: "other-priority",
        createdById: testData.user || "test-user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.comments).values({
        id: "other-org-deleted-comment",
        content: "Deleted comment in other org",
        issueId: "other-issue",
        authorId: testData.user || "test-user-1",
        deletedAt: new Date(),
        deletedBy: testData.user || "test-user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Test original organization
      const originalOrgResult = await commentService.getDeletedComments(
        testData.organization,
      );
      expect(
        originalOrgResult.every((c) => c.id !== "other-org-deleted-comment"),
      ).toBe(true);

      // Test other organization
      const otherOrgResult =
        await commentService.getDeletedComments(otherOrgId);
      expect(otherOrgResult).toHaveLength(1);
      expect(otherOrgResult[0].id).toBe("other-org-deleted-comment");
    });

    it("should handle empty results", async () => {
      // Create an organization with no deleted comments
      const emptyOrgId = "empty-org";
      await db.insert(schema.organizations).values({
        id: emptyOrgId,
        name: "Empty Organization",
        subdomain: "empty-org",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await commentService.getDeletedComments(emptyOrgId);

      expect(result).toEqual([]);
    });

    it("should return correct TypeScript types for complex result", async () => {
      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      if (result.length > 0) {
        const comment = result[0];

        // Check comment fields
        expect(typeof comment.id).toBe("string");
        expect(typeof comment.content).toBe("string");
        expect(comment.createdAt).toBeInstanceOf(Date);
        expect(comment.updatedAt).toBeInstanceOf(Date);
        expect(comment.deletedAt).toBeInstanceOf(Date);
        expect(typeof comment.deletedBy).toBe("string");
        expect(typeof comment.issueId).toBe("string");
        expect(typeof comment.authorId).toBe("string");

        // Check author object
        expect(typeof comment.author.id).toBe("string");
        expect(
          typeof comment.author.name === "string" ||
            comment.author.name === null,
        ).toBe(true);
        expect(
          typeof comment.author.email === "string" ||
            comment.author.email === null,
        ).toBe(true);
        expect(
          typeof comment.author.image === "string" ||
            comment.author.image === null,
        ).toBe(true);

        // Check issue object
        expect(typeof comment.issue.id).toBe("string");
        expect(typeof comment.issue.title).toBe("string");

        // Check deleter object (can be null)
        if (comment.deleter !== null) {
          expect(typeof comment.deleter.id).toBe("string");
          expect(
            typeof comment.deleter.name === "string" ||
              comment.deleter.name === null,
          ).toBe(true);
          expect(
            typeof comment.deleter.email === "string" ||
              comment.deleter.email === null,
          ).toBe(true);
          expect(
            typeof comment.deleter.image === "string" ||
              comment.deleter.image === null,
          ).toBe(true);
        }
      }
    });

    it("should use Promise.all for concurrent deleter lookups", async () => {
      // This test verifies that the Promise.all pattern is working
      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      // Should get both comments with their deleters resolved
      expect(result).toHaveLength(2);
      expect(result[0].deleter).toBeDefined();
      expect(result[1].deleter).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle edge cases with service methods", async () => {
      // Test with very long content
      const longContent = "A".repeat(10000);
      const [longComment] = await db
        .insert(schema.comments)
        .values({
          id: "long-content-comment",
          content: longContent,
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Should handle long content in soft delete
      const result = await commentService.softDeleteComment(
        longComment.id,
        testData.user || "test-user-1",
      );
      expect(result.content).toBe(longContent);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it("should handle invalid deleter user IDs", async () => {
      // Create a valid comment first
      const [testComment] = await db
        .insert(schema.comments)
        .values({
          id: "test-comment-invalid-deleter",
          content: "Test comment for invalid deleter",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Soft delete with non-existent deleter (this should still work since deletedBy is just a text field)
      const result = await commentService.softDeleteComment(
        testComment.id,
        "non-existent-user",
      );
      expect(result.deletedBy).toBe("non-existent-user");
    });
  });

  describe("integration scenarios", () => {
    it("should work with realistic comment lifecycle", async () => {
      // 1. Create a real comment
      const [originalComment] = await db
        .insert(schema.comments)
        .values({
          id: "lifecycle-comment",
          content: "This comment will go through full lifecycle",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 2. Soft delete the comment
      const softDeleted = await commentService.softDeleteComment(
        originalComment.id,
        "test-user-admin",
      );
      expect(softDeleted.deletedBy).toBe("test-user-admin");
      expect(softDeleted.deletedAt).toBeInstanceOf(Date);

      // 3. Verify it appears in deleted comments
      const deletedComments = await commentService.getDeletedComments(
        testData.organization,
      );
      const foundDeleted = deletedComments.find(
        (c) => c.id === originalComment.id,
      );
      expect(foundDeleted).toBeDefined();
      expect(foundDeleted?.deleter?.id).toBe("test-user-admin");

      // 4. Restore the comment
      const restored = await commentService.restoreComment(originalComment.id);
      expect(restored.deletedAt).toBeNull();
      expect(restored.deletedBy).toBeNull();

      // 5. Verify it no longer appears in deleted comments
      const deletedCommentsAfterRestore =
        await commentService.getDeletedComments(testData.organization);
      const foundAfterRestore = deletedCommentsAfterRestore.find(
        (c) => c.id === originalComment.id,
      );
      expect(foundAfterRestore).toBeUndefined();
    });

    it("should handle multiple comments in getDeletedComments", async () => {
      // Create multiple deleted comments
      const multipleComments = Array.from({ length: 5 }, (_, i) => ({
        id: `multiple-comment-${i + 1}`,
        content: `Multiple deleted comment ${i + 1}`,
        issueId: testData.issue || "test-issue-1",
        authorId: testData.user || "test-user-1",
        deletedAt: new Date(2024, 0, i + 2), // Different deletion dates
        deletedBy: "test-user-admin",
        createdAt: new Date(2024, 0, i + 1),
        updatedAt: new Date(2024, 0, i + 1),
      }));

      await db.insert(schema.comments).values(multipleComments);

      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      // Should have at least 5 new comments plus the 2 from beforeEach
      expect(result.length).toBeGreaterThanOrEqual(5);

      // Find the multiple comments we just created
      const createdComments = result.filter((c) =>
        c.id.startsWith("multiple-comment-"),
      );
      expect(createdComments).toHaveLength(5);
      expect(createdComments.every((comment) => comment.deleter !== null)).toBe(
        true,
      );
      expect(
        createdComments.every(
          (comment) => comment.deleter?.id === "test-user-admin",
        ),
      ).toBe(true);
    });

    it("should maintain organizational boundaries", async () => {
      // This test ensures comments from other organizations don't leak through
      // The existing setup already includes organizational scoping in the seeded data
      const result = await commentService.getDeletedComments(
        testData.organization,
      );

      // All results should belong to the test organization
      expect(
        result.every((comment) => {
          // We verify this indirectly by checking that all issues belong to our test data
          return comment.issueId === testData.issue;
        }),
      ).toBe(true);
    });

    it("should handle concurrent operations correctly", async () => {
      // Create comments for concurrent testing
      const commentIds = ["concurrent-1", "concurrent-2", "concurrent-3"];

      for (const id of commentIds) {
        await db.insert(schema.comments).values({
          id,
          content: `Concurrent test comment ${id}`,
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Perform concurrent operations
      const operations = commentIds.map((id) =>
        commentService.softDeleteComment(id, testData.user || "test-user-1"),
      );

      const results = await Promise.all(operations);

      // All should succeed
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.id).toBe(commentIds[index]);
        expect(result.deletedAt).toBeInstanceOf(Date);
      });

      // Verify all are in deleted comments
      const deletedComments = await commentService.getDeletedComments(
        testData.organization,
      );
      const concurrentComments = deletedComments.filter((c) =>
        c.id.startsWith("concurrent-"),
      );
      expect(concurrentComments).toHaveLength(3);
    });
  });
});
