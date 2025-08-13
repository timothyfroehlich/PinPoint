/**
 * Comment Router Integration Tests (PGlite)
 *
 * Integration tests for the comment router using PGlite in-memory PostgreSQL database.
 * Tests real database operations with proper schema, relationships, and data integrity.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real Drizzle ORM operations
 * - Multi-tenant data isolation testing
 * - Complex query validation with actual results
 * - Service integration testing (CommentCleanupService, IssueActivityService)
 * - Soft delete patterns with real database constraints
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { eq, count, and, ne, isNotNull, lte } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";
import type { ExtendedPrismaClient } from "~/server/db";

import { commentRouter } from "~/server/api/routers/comment";
import * as schema from "~/server/db/schema";
import { CommentCleanupService } from "~/server/services/commentCleanupService";
import { IssueActivityService } from "~/server/services/issueActivityService";
import {
  createSeededTestDatabase,
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => `test-comment-id-${Date.now()}`),
}));

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

describe("Comment Router Integration (PGlite)", () => {
  let db: TestDatabase;
  let context: TRPCContext;
  let caller: ReturnType<typeof commentRouter.createCaller>;

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
    comment?: string;
  };

  beforeEach(async () => {
    // Create fresh PGlite database with real schema and seed data
    const setup = await createSeededTestDatabase();
    db = setup.db;

    // Query actual seeded IDs instead of using hardcoded ones
    testData = await getSeededTestData(db, setup.organizationId);

    // Create additional test comments for complex scenarios
    const testComment = await db
      .insert(schema.comments)
      .values({
        id: "test-comment-1",
        content: "Test comment content",
        issueId: testData.issue || "test-issue-1",
        authorId: testData.user || "test-user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .then((result) => result[0]);

    testData.comment = testComment.id;

    // Create mock Prisma client for tRPC middleware compatibility
    const mockPrismaClient = {
      membership: {
        findFirst: vi.fn().mockResolvedValue({
          id: "test-membership",
          organizationId: testData.organization,
          userId: testData.user || "test-user-1",
          role: {
            id: testData.adminRole || "test-admin-role",
            name: "Admin",
            permissions: [
              { id: "perm1", name: "issue:view" },
              { id: "perm2", name: "issue:delete" },
              { id: "perm3", name: "organization:manage" },
            ],
          },
        }),
      },
      // Add comment operations for service compatibility
      comment: {
        deleteMany: vi.fn().mockImplementation(({ where: _where }) => {
          // Calculate retention cutoff for cleanup
          const retentionCutoff = new Date();
          retentionCutoff.setDate(retentionCutoff.getDate() - 90);

          return db
            .delete(schema.comments)
            .where(
              and(
                ne(schema.comments.deletedAt, null),
                schema.comments.deletedAt <= retentionCutoff,
              ),
            )
            .then((result) => ({ count: result.rowCount || 0 }));
        }),
        count: vi.fn().mockImplementation(async ({ where }) => {
          // Count old deleted comments that qualify for cleanup
          if (where?.deletedAt?.lte) {
            const retentionCutoff = where.deletedAt.lte;
            const result = await db
              .select({ count: count() })
              .from(schema.comments)
              .where(
                and(
                  isNotNull(schema.comments.deletedAt),
                  lte(schema.comments.deletedAt, retentionCutoff),
                ),
              );
            return result[0]?.count || 0;
          }
          return 0;
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          // Update comment in real database
          return db
            .update(schema.comments)
            .set(data)
            .where(eq(schema.comments.id, where.id))
            .returning()
            .then((result) => result[0]);
        }),
        findMany: vi
          .fn()
          .mockImplementation(async ({ where, include, orderBy }) => {
            // Debug logging
            console.log(
              "findMany called with:",
              JSON.stringify({ where, include, orderBy }, null, 2),
            );

            // Handle deleted comments query for getDeletedComments
            if (
              where?.deletedAt?.not !== undefined &&
              where?.issue?.organizationId
            ) {
              console.log("Processing getDeletedComments query...");
              const organizationId = where.issue.organizationId;

              // Get all deleted comments and filter by organization
              const allDeletedComments = await db.query.comments.findMany({
                where: (comments, { isNotNull }) =>
                  isNotNull(comments.deletedAt),
                with: {
                  author: include?.author
                    ? {
                        columns: {
                          id: true,
                          name: true,
                        },
                      }
                    : false,
                  deleter: include?.deleter
                    ? {
                        columns: {
                          id: true,
                          name: true,
                        },
                      }
                    : false,
                  issue: {
                    columns: {
                      id: true,
                      title: true,
                      organizationId: true, // We need this to filter
                    },
                  },
                },
              });
              console.log("Target organization ID:", organizationId);

              // Filter by organization and format results
              const orgDeletedComments = allDeletedComments
                .filter(
                  (comment) => comment.issue?.organizationId === organizationId,
                )
                .map((comment) => ({
                  id: comment.id,
                  content: comment.content,
                  createdAt: comment.createdAt,
                  updatedAt: comment.updatedAt,
                  deletedAt: comment.deletedAt,
                  deletedBy: comment.deletedBy,
                  issueId: comment.issueId,
                  authorId: comment.authorId,
                  author: include?.author ? comment.author : undefined,
                  deleter: include?.deleter ? comment.deleter : undefined,
                  issue: include?.issue
                    ? {
                        id: comment.issue?.id ?? "unknown",
                        title: comment.issue?.title ?? "Unknown Issue",
                      }
                    : undefined,
                }));

              console.log(
                "Filtered org deleted comments:",
                orgDeletedComments.length,
              );

              // Sort by deletedAt desc if requested
              if (orderBy?.deletedAt === "desc") {
                orgDeletedComments.sort(
                  (a, b) =>
                    (b.deletedAt?.getTime() || 0) -
                    (a.deletedAt?.getTime() || 0),
                );
              }

              return orgDeletedComments;
            }

            // Default: return empty array for other queries
            console.log("Returning empty array for unhandled query");
            return [];
          }),
      },
      issueHistory: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          // Create issue history in real database
          const historyEntry = {
            id: `history-${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };

          return await db
            .insert(schema.issueHistory)
            .values(historyEntry)
            .returning()
            .then((result) => result[0]);
        }),
      },
    } as unknown as ExtendedPrismaClient;

    // Create test context with real database and services
    context = {
      user: {
        id: testData.user || "test-user-1",
        email: "test@example.com",
        user_metadata: { name: "Test User" },
        app_metadata: { organization_id: testData.organization, role: "Admin" },
      },
      organization: {
        id: testData.organization,
        name: "Test Organization",
        subdomain: "test-org",
      },
      db: mockPrismaClient,
      drizzle: db,
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as any,
      services: {
        createCommentCleanupService: vi.fn(
          () => new CommentCleanupService(mockPrismaClient),
        ),
        createIssueActivityService: vi.fn(
          () => new IssueActivityService(mockPrismaClient),
        ),
        createNotificationService: vi.fn(),
        createCollectionService: vi.fn(),
        createPinballMapService: vi.fn(),
        createQRCodeService: vi.fn(),
      },
      headers: new Headers(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(() => context.logger),
        withRequest: vi.fn(() => context.logger),
        withUser: vi.fn(() => context.logger),
        withOrganization: vi.fn(() => context.logger),
        withContext: vi.fn(() => context.logger),
      },
      userPermissions: ["issue:view", "issue:delete", "organization:manage"],
    } as any;

    caller = commentRouter.createCaller(context);
  });

  describe("getForIssue", () => {
    beforeEach(async () => {
      // Create additional test comments for comprehensive testing
      await db.insert(schema.comments).values([
        {
          id: "comment-2",
          content: "Second test comment",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
        },
        {
          id: "comment-3-deleted",
          content: "Deleted comment",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          deletedAt: new Date(), // Soft deleted
          deletedBy: testData.user || "test-user-1",
          createdAt: new Date("2024-01-03"),
          updatedAt: new Date("2024-01-03"),
        },
      ]);
    });

    it("should get comments for an issue with author info", async () => {
      const result = await caller.getForIssue({
        issueId: testData.issue || "test-issue-1",
      });

      expect(result).toHaveLength(2); // Should exclude deleted comment

      // Comments are ordered by createdAt, so the first one should be the earlier one
      // testData.comment was created now, comment-2 was created at 2024-01-02
      // So comment-2 should come first (earlier date)
      expect(result[0]).toMatchObject({
        id: "comment-2",
        content: "Second test comment",
        issueId: testData.issue,
        authorId: testData.user,
        deletedAt: null,
        deletedBy: null,
        author: {
          id: testData.user,
          name: "Dev Admin",
          profilePicture: null,
        },
      });
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);

      // Verify second comment (test-comment-1 created now, so comes after)
      expect(result[1]).toMatchObject({
        id: testData.comment,
        content: "Test comment content",
      });

      // Verify soft-deleted comment is excluded
      expect(result.find((c) => c.id === "comment-3-deleted")).toBeUndefined();
    });

    it("should handle empty results", async () => {
      const result = await caller.getForIssue({ issueId: "nonexistent-issue" });
      expect(result).toEqual([]);
    });

    it("should order comments by creation date", async () => {
      const result = await caller.getForIssue({
        issueId: testData.issue || "test-issue-1",
      });

      expect(result).toHaveLength(2);
      expect(result[0].createdAt.getTime()).toBeLessThanOrEqual(
        result[1].createdAt.getTime(),
      );
    });

    it("should maintain organizational scoping", async () => {
      // Create comment in different organization
      const otherOrgId = "other-org-id";
      await db.insert(schema.organizations).values({
        id: otherOrgId,
        name: "Other Organization",
        subdomain: "other-org",
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
        id: "other-comment",
        content: "Other org comment",
        issueId: "other-issue",
        authorId: testData.user || "test-user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await caller.getForIssue({
        issueId: testData.issue || "test-issue-1",
      });

      // Should only get comments from our organization's issue
      expect(result).toHaveLength(2);
      expect(result.find((c) => c.id === "other-comment")).toBeUndefined();
    });
  });

  describe("delete (soft delete)", () => {
    it("should soft delete a comment successfully", async () => {
      // Verify comment exists before deletion
      const beforeDeletion = await db.query.comments.findFirst({
        where: eq(schema.comments.id, testData.comment || "test-comment-1"),
      });
      expect(beforeDeletion).toBeDefined();
      expect(beforeDeletion?.deletedAt).toBeNull();

      const result = await caller.delete({
        commentId: testData.comment || "test-comment-1",
      });

      expect(result).toEqual({ success: true });

      // Verify soft delete in database
      const afterDeletion = await db.query.comments.findFirst({
        where: eq(schema.comments.id, testData.comment || "test-comment-1"),
      });
      expect(afterDeletion).toBeDefined();
      expect(afterDeletion.deletedAt).toBeInstanceOf(Date);
      expect(afterDeletion.deletedBy).toBe(testData.user);

      // Verify comment is filtered out of normal queries
      const comments = await caller.getForIssue({
        issueId: testData.issue || "test-issue-1",
      });
      expect(comments.find((c) => c.id === testData.comment)).toBeUndefined();

      // Verify issue activity was recorded
      const activities = await db.query.issueHistory.findMany({
        where: eq(
          schema.issueHistory.issueId,
          testData.issue || "test-issue-1",
        ),
      });
      expect(
        activities.some(
          (a) =>
            a.type === "COMMENT_DELETED" && a.oldValue === testData.comment,
        ),
      ).toBe(true);
    });

    it("should throw NOT_FOUND for non-existent comment", async () => {
      await expect(caller.delete({ commentId: "nonexistent" })).rejects.toThrow(
        "Comment not found",
      );
    });

    it("should throw FORBIDDEN for comment not in user's organization", async () => {
      // Create comment in different organization (reuse setup from previous test)
      const otherOrgId = "other-org-forbidden";
      await db.insert(schema.organizations).values({
        id: otherOrgId,
        name: "Other Organization",
        subdomain: "other-org-forbidden",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.priorities).values({
        id: "other-priority-forbidden",
        name: "Other Priority",
        organizationId: otherOrgId,
        order: 1,
      });

      await db.insert(schema.issueStatuses).values({
        id: "other-status-forbidden",
        name: "Other Status",
        category: "NEW",
        organizationId: otherOrgId,
      });

      await db.insert(schema.issues).values({
        id: "other-issue-forbidden",
        title: "Other Issue",
        organizationId: otherOrgId,
        machineId: testData.machine || "test-machine-1",
        statusId: "other-status-forbidden",
        priorityId: "other-priority-forbidden",
        createdById: testData.user || "test-user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.comments).values({
        id: "other-comment-forbidden",
        content: "Other org comment",
        issueId: "other-issue-forbidden",
        authorId: testData.user || "test-user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        caller.delete({ commentId: "other-comment-forbidden" }),
      ).rejects.toThrow("Comment not in organization");
    });
  });

  describe("getDeleted (admin)", () => {
    beforeEach(async () => {
      // Create deleted comments for testing
      await db.insert(schema.comments).values([
        {
          id: "deleted-comment-1",
          content: "First deleted comment",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          deletedAt: new Date("2024-01-01"),
          deletedBy: testData.user || "test-user-1",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
        {
          id: "deleted-comment-2",
          content: "Second deleted comment",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          deletedAt: new Date("2024-01-02"),
          deletedBy: testData.user || "test-user-1",
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
        },
      ]);
    });

    it("should get deleted comments for organization managers", async () => {
      const result = await caller.getDeleted();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: "deleted-comment-2", // Ordered by deletedAt desc
        content: "Second deleted comment",
        deletedAt: expect.any(Date),
        deletedBy: testData.user,
      });
      expect(result[1]).toMatchObject({
        id: "deleted-comment-1",
        content: "First deleted comment",
      });

      // Verify author and issue relationships
      expect(result[0]).toHaveProperty("author");
      expect(result[0]).toHaveProperty("issue");
    });

    it("should maintain organizational scoping", async () => {
      // Create deleted comment in different organization
      const otherOrgId = "other-org-deleted";
      await db.insert(schema.organizations).values({
        id: otherOrgId,
        name: "Other Organization",
        subdomain: "other-org-deleted",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.priorities).values({
        id: "other-priority-deleted",
        name: "Other Priority",
        organizationId: otherOrgId,
        order: 1,
      });

      await db.insert(schema.issueStatuses).values({
        id: "other-status-deleted",
        name: "Other Status",
        category: "NEW",
        organizationId: otherOrgId,
      });

      await db.insert(schema.issues).values({
        id: "other-issue-deleted",
        title: "Other Issue",
        organizationId: otherOrgId,
        machineId: testData.machine || "test-machine-1",
        statusId: "other-status-deleted",
        priorityId: "other-priority-deleted",
        createdById: testData.user || "test-user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.comments).values({
        id: "other-deleted-comment",
        content: "Other org deleted comment",
        issueId: "other-issue-deleted",
        authorId: testData.user || "test-user-1",
        deletedAt: new Date(),
        deletedBy: testData.user || "test-user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await caller.getDeleted();

      // Should only see deleted comments from our organization
      expect(result).toHaveLength(2);
      expect(
        result.find((c) => c.id === "other-deleted-comment"),
      ).toBeUndefined();
    });
  });

  describe("restore (admin)", () => {
    beforeEach(async () => {
      // Create deleted comment for restoration testing
      await db.insert(schema.comments).values({
        id: "restore-comment",
        content: "Comment to restore",
        issueId: testData.issue || "test-issue-1",
        authorId: testData.user || "test-user-1",
        deletedAt: new Date(),
        deletedBy: testData.user || "test-user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it("should restore a deleted comment", async () => {
      // Verify comment is deleted before restoration
      const beforeRestore = await db.query.comments.findFirst({
        where: eq(schema.comments.id, "restore-comment"),
      });
      expect(beforeRestore).toBeDefined();
      expect(beforeRestore?.deletedAt).toBeInstanceOf(Date);

      const result = await caller.restore({ commentId: "restore-comment" });

      expect(result).toEqual({ success: true });

      // Verify restoration in database
      const afterRestore = await db.query.comments.findFirst({
        where: eq(schema.comments.id, "restore-comment"),
      });
      expect(afterRestore).toBeDefined();
      expect(afterRestore?.deletedAt).toBeNull();
      expect(afterRestore?.deletedBy).toBeNull();

      // Verify comment appears in normal queries again
      const comments = await caller.getForIssue({
        issueId: testData.issue || "test-issue-1",
      });
      expect(comments.find((c) => c.id === "restore-comment")).toBeDefined();
    });
  });

  describe("getCleanupStats (admin)", () => {
    beforeEach(async () => {
      // Create old deleted comments that qualify for cleanup
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200); // 200 days ago (way > 90 day threshold)

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30 days ago (way < 90 day threshold)

      await db.insert(schema.comments).values([
        {
          id: "old-deleted-1",
          content: "Old deleted comment 1",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          deletedAt: oldDate,
          deletedBy: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "old-deleted-2",
          content: "Old deleted comment 2",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          deletedAt: oldDate,
          deletedBy: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "recent-deleted",
          content: "Recent deleted comment",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          deletedAt: recentDate,
          deletedBy: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it("should get cleanup statistics", async () => {
      const result = await caller.getCleanupStats();

      expect(result).toEqual({
        candidateCount: 2, // Only the 2 old deleted comments qualify
        cleanupThresholdDays: 90,
      });
    });
  });

  describe("Complex Integration Scenarios", () => {
    it("should handle concurrent soft delete operations correctly", async () => {
      // Create multiple comments for concurrent deletion
      await db.insert(schema.comments).values([
        {
          id: "concurrent-1",
          content: "Concurrent comment 1",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "concurrent-2",
          content: "Concurrent comment 2",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Delete both comments concurrently
      const [result1, result2] = await Promise.all([
        caller.delete({ commentId: "concurrent-1" }),
        caller.delete({ commentId: "concurrent-2" }),
      ]);

      expect(result1).toEqual({ success: true });
      expect(result2).toEqual({ success: true });

      // Verify both comments are soft deleted
      const comment1 = await db.query.comments.findFirst({
        where: eq(schema.comments.id, "concurrent-1"),
      });
      const comment2 = await db.query.comments.findFirst({
        where: eq(schema.comments.id, "concurrent-2"),
      });

      expect(comment1?.deletedAt).toBeInstanceOf(Date);
      expect(comment2?.deletedAt).toBeInstanceOf(Date);

      // Verify activity records were created for both
      const activities = await db.query.issueHistory.findMany({
        where: eq(
          schema.issueHistory.issueId,
          testData.issue || "test-issue-1",
        ),
      });
      expect(
        activities.filter((a) => a.type === "COMMENT_DELETED"),
      ).toHaveLength(2);
    });

    it("should maintain referential integrity across service operations", async () => {
      // Test complete comment lifecycle: create -> soft delete -> restore -> cleanup

      // 1. Soft delete the comment
      await caller.delete({ commentId: testData.comment || "test-comment-1" });

      // 2. Verify it appears in deleted comments
      const deletedComments = await caller.getDeleted();
      expect(
        deletedComments.find((c) => c.id === testData.comment),
      ).toBeDefined();

      // 3. Restore the comment
      await caller.restore({ commentId: testData.comment || "test-comment-1" });

      // 4. Verify it no longer appears in deleted comments
      const deletedAfterRestore = await caller.getDeleted();
      expect(
        deletedAfterRestore.find((c) => c.id === testData.comment),
      ).toBeUndefined();

      // 5. Verify it appears in normal queries
      const normalComments = await caller.getForIssue({
        issueId: testData.issue || "test-issue-1",
      });
      expect(
        normalComments.find((c) => c.id === testData.comment),
      ).toBeDefined();
    });
  });
});
