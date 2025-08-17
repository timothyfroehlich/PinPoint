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

import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

import { commentRouter } from "~/server/api/routers/comment";
import * as schema from "~/server/db/schema";
import { CommentCleanupService } from "~/server/services/commentCleanupService";
import { IssueActivityService } from "~/server/services/issueActivityService";
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
        organizationId,
        locationId: location.id,
        modelId: model.id,
        qrCodeId: generateTestId("test-qr"),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const [machine] = await db
        .insert(schema.machines)
        .values(machineData)
        .returning();
      machineId = machine.id;
    }

    if (!issueId && machineId && testData.user) {
      // Create priority and status if they don't exist
      let priorityId = testData.priority;
      let statusId = testData.status;

      if (!priorityId) {

        const priorityData = {
          id: generateTestId("test-priority"),
          name: "Medium",
          order: 2,
          organizationId,
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
        description: "Test issue for comment tests",
        organizationId,
        machineId,
        statusId,
        priorityId,
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

    // Ensure we have valid test data
    if (!issueId || !testData.user || !machineId) {
      throw new Error(
        `Missing required test data after creation: issue=${issueId}, user=${testData.user}, machine=${machineId}, organization=${testData.organization}`,
      );
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

    // Create services with direct Drizzle access
    const commentCleanupService = new CommentCleanupService(db);
    const issueActivityService = new IssueActivityService(db);

    // Create test context with real database and services
    const context = {
      user: {
        id: updatedTestData.user,
        email: "test@example.com",
        user_metadata: { name: "Test User" },
        app_metadata: {
          organization_id: updatedTestData.organization,
          role: "Admin",
        },
      },
      organization: {
        id: updatedTestData.organization,
        name: "Test Organization",
        subdomain: "test-org",
      },
      db: db,
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as any,
      services: {
        createCommentCleanupService: vi.fn(() => commentCleanupService),
        createIssueActivityService: vi.fn(() => issueActivityService),
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

    const caller = commentRouter.createCaller(context);

    return { context, caller, testData: updatedTestData };
  }

  describe("getForIssue", () => {
    test("should get comments for an issue with author info", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Generate unique IDs for this test to avoid conflicts
        const comment2Id = generateTestId("comment-2");
        const comment3Id = generateTestId("comment-3-deleted");

        // Create additional test comments for comprehensive testing
        await db.insert(schema.comments).values([
          {
            id: comment2Id,
            content: "Second test comment",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
          },
          {
            id: comment3Id,
            content: "Deleted comment",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            deletedAt: new Date(), // Soft deleted
            deletedBy: testData.user,
            createdAt: new Date("2024-01-03"),
            updatedAt: new Date("2024-01-03"),
          },
        ]);

        const result = await caller.getForIssue({
          issueId: testData.issue,
        });

        expect(result).toHaveLength(2); // Should exclude deleted comment

        // Comments are ordered by createdAt, so the first one should be the earlier one
        // testData.comment was created now, comment2Id was created at 2024-01-02
        // So comment2Id should come first (earlier date)
        expect(result[0]).toMatchObject({
          id: comment2Id,
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

        // Verify second comment (testData.comment created now, so comes after)
        expect(result[1]).toMatchObject({
          id: testData.comment,
          content: "Test comment content",
        });

        // Verify soft-deleted comment is excluded
        expect(result.find((c) => c.id === comment3Id)).toBeUndefined();
      });
    });

    test("should handle empty results", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller } = await createTestContext(db, organizationId);

        const result = await caller.getForIssue({
          issueId: "nonexistent-issue",
        });
        expect(result).toEqual([]);
      });
    });

    test("should order comments by creation date", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Generate unique IDs for this test to avoid conflicts
        const comment2Id = generateTestId("comment-2");

        // Create additional test comments for comprehensive testing
        await db.insert(schema.comments).values([
          {
            id: comment2Id,
            content: "Second test comment",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
          },
        ]);

        const result = await caller.getForIssue({
          issueId: testData.issue,
        });

        expect(result).toHaveLength(2);
        expect(result[0].createdAt.getTime()).toBeLessThanOrEqual(
          result[1].createdAt.getTime(),
        );
      });
    });

    test("should maintain organizational scoping", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Generate unique IDs for this test to avoid conflicts
        const comment2Id = generateTestId("comment-2");

        // Create additional test comments for comprehensive testing
        await db.insert(schema.comments).values([
          {
            id: comment2Id,
            content: "Second test comment",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
          },
        ]);

        // Create comment in different organization
        const otherOrgId = generateTestId("other-org-id");
        const otherPriorityId = generateTestId("other-priority");
        const otherStatusId = generateTestId("other-status");
        const otherIssueId = generateTestId("other-issue");
        const otherCommentId = generateTestId("other-comment");

        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Organization",
          subdomain: generateTestId("other-org"),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.priorities).values({
          id: otherPriorityId,
          name: "Other Priority",
          organizationId: otherOrgId,
          order: 1,
        });

        await db.insert(schema.issueStatuses).values({
          id: otherStatusId,
          name: "Other Status",
          category: "NEW",
          organizationId: otherOrgId,
        });

        await db.insert(schema.issues).values({
          id: otherIssueId,
          title: "Other Issue",
          organizationId: otherOrgId,
          machineId: testData.machine,
          statusId: otherStatusId,
          priorityId: otherPriorityId,
          createdById: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.comments).values({
          id: otherCommentId,
          content: "Other org comment",
          organizationId: otherOrgId,
          issueId: otherIssueId,
          authorId: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await caller.getForIssue({
          issueId: testData.issue,
        });

        // Should only get comments from our organization's issue
        expect(result).toHaveLength(2);
        expect(result.find((c) => c.id === otherCommentId)).toBeUndefined();
      });
    });
  });

  describe("delete (soft delete)", () => {
    test("should soft delete a comment successfully", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Verify comment exists before deletion
        const beforeDeletion = await db.query.comments.findFirst({
          where: eq(schema.comments.id, testData.comment),
        });
        expect(beforeDeletion).toBeDefined();
        expect(beforeDeletion?.deletedAt).toBeNull();

        const result = await caller.delete({
          commentId: testData.comment,
        });

        expect(result).toEqual({ success: true });

        // Verify soft delete in database
        const afterDeletion = await db.query.comments.findFirst({
          where: eq(schema.comments.id, testData.comment),
        });
        expect(afterDeletion).toBeDefined();
        expect(afterDeletion?.deletedAt).toBeInstanceOf(Date);
        expect(afterDeletion?.deletedBy).toBe(testData.user);

        // Verify comment is filtered out of normal queries
        const comments = await caller.getForIssue({
          issueId: testData.issue,
        });
        expect(comments.find((c) => c.id === testData.comment)).toBeUndefined();

        // Verify issue activity was recorded
        const activities = await db.query.issueHistory.findMany({
          where: eq(schema.issueHistory.issueId, testData.issue),
        });
        expect(
          activities.some(
            (a) =>
              a.type === "COMMENT_DELETED" && a.oldValue === testData.comment,
          ),
        ).toBe(true);
      });
    });

    test("should throw NOT_FOUND for non-existent comment", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller } = await createTestContext(db, organizationId);

        await expect(
          caller.delete({ commentId: "nonexistent" }),
        ).rejects.toThrow("Comment not found");
      });
    });

    test("should throw FORBIDDEN for comment not in user's organization", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Generate unique IDs for this test to avoid conflicts

        // Create comment in different organization (reuse setup from previous test)
        const otherOrgId = generateTestId("other-org-forbidden");
        const otherPriorityId = generateTestId("other-priority-forbidden");
        const otherStatusId = generateTestId("other-status-forbidden");
        const otherIssueId = generateTestId("other-issue-forbidden");
        const otherCommentId = generateTestId("other-comment-forbidden");

        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Organization",
          subdomain: generateTestId("other-org-forbidden"),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.priorities).values({
          id: otherPriorityId,
          name: "Other Priority",
          organizationId: otherOrgId,
          order: 1,
        });

        await db.insert(schema.issueStatuses).values({
          id: otherStatusId,
          name: "Other Status",
          category: "NEW",
          organizationId: otherOrgId,
        });

        await db.insert(schema.issues).values({
          id: otherIssueId,
          title: "Other Issue",
          organizationId: otherOrgId,
          machineId: testData.machine,
          statusId: otherStatusId,
          priorityId: otherPriorityId,
          createdById: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.comments).values({
          id: otherCommentId,
          content: "Other org comment",
          organizationId: otherOrgId,
          issueId: otherIssueId,
          authorId: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await expect(
          caller.delete({ commentId: otherCommentId }),
        ).rejects.toThrow("Comment not in organization");
      });
    });
  });

  describe("getDeleted (admin)", () => {
    test("should get deleted comments for organization managers", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Generate unique IDs for this test to avoid conflicts
        const deletedComment1Id = generateTestId("deleted-comment-1");
        const deletedComment2Id = generateTestId("deleted-comment-2");

        // Create deleted comments for testing
        await db.insert(schema.comments).values([
          {
            id: deletedComment1Id,
            content: "First deleted comment",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            deletedAt: new Date("2024-01-01"),
            deletedBy: testData.user,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
          {
            id: deletedComment2Id,
            content: "Second deleted comment",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            deletedAt: new Date("2024-01-02"),
            deletedBy: testData.user,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
          },
        ]);

        const result = await caller.getDeleted();

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          id: deletedComment2Id, // Ordered by deletedAt desc
          content: "Second deleted comment",
          deletedAt: expect.any(Date),
          deletedBy: testData.user,
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

    test("should maintain organizational scoping", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Generate unique IDs for this test to avoid conflicts
        const deletedComment1Id = generateTestId("deleted-comment-1");
        const deletedComment2Id = generateTestId("deleted-comment-2");

        // Create deleted comments for testing
        await db.insert(schema.comments).values([
          {
            id: deletedComment1Id,
            content: "First deleted comment",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            deletedAt: new Date("2024-01-01"),
            deletedBy: testData.user,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
          {
            id: deletedComment2Id,
            content: "Second deleted comment",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            deletedAt: new Date("2024-01-02"),
            deletedBy: testData.user,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
          },
        ]);

        // Create deleted comment in different organization
        const otherOrgId = generateTestId("other-org-deleted");
        const otherPriorityId = generateTestId("other-priority-deleted");
        const otherStatusId = generateTestId("other-status-deleted");
        const otherIssueId = generateTestId("other-issue-deleted");
        const otherDeletedCommentId = generateTestId("other-deleted-comment");

        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Organization",
          subdomain: generateTestId("other-org-deleted"),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.priorities).values({
          id: otherPriorityId,
          name: "Other Priority",
          organizationId: otherOrgId,
          order: 1,
        });

        await db.insert(schema.issueStatuses).values({
          id: otherStatusId,
          name: "Other Status",
          category: "NEW",
          organizationId: otherOrgId,
        });

        await db.insert(schema.issues).values({
          id: otherIssueId,
          title: "Other Issue",
          organizationId: otherOrgId,
          machineId: testData.machine,
          statusId: otherStatusId,
          priorityId: otherPriorityId,
          createdById: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.comments).values({
          id: otherDeletedCommentId,
          content: "Other org deleted comment",
          organizationId: otherOrgId,
          issueId: otherIssueId,
          authorId: testData.user,
          deletedAt: new Date(),
          deletedBy: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await caller.getDeleted();

        // Should only see deleted comments from our organization
        expect(result).toHaveLength(2);
        expect(
          result.find((c) => c.id === otherDeletedCommentId),
        ).toBeUndefined();
      });
    });
  });

  describe("restore (admin)", () => {
    test("should restore a deleted comment", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Generate unique IDs for this test to avoid conflicts
        const restoreCommentId = generateTestId("restore-comment");

        // Create deleted comment for restoration testing
        await db.insert(schema.comments).values({
          id: restoreCommentId,
          content: "Comment to restore",
          organizationId,
          issueId: testData.issue,
          authorId: testData.user,
          deletedAt: new Date(),
          deletedBy: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Verify comment is deleted before restoration
        const beforeRestore = await db.query.comments.findFirst({
          where: eq(schema.comments.id, restoreCommentId),
        });
        expect(beforeRestore).toBeDefined();
        expect(beforeRestore?.deletedAt).toBeInstanceOf(Date);

        const result = await caller.restore({ commentId: restoreCommentId });

        expect(result).toEqual({ success: true });

        // Verify restoration in database
        const afterRestore = await db.query.comments.findFirst({
          where: eq(schema.comments.id, restoreCommentId),
        });
        expect(afterRestore).toBeDefined();
        expect(afterRestore?.deletedAt).toBeNull();
        expect(afterRestore?.deletedBy).toBeNull();

        // Verify comment appears in normal queries again
        const comments = await caller.getForIssue({
          issueId: testData.issue,
        });
        expect(comments.find((c) => c.id === restoreCommentId)).toBeDefined();
      });
    });
  });

  describe("getCleanupStats (admin)", () => {
    test("should get cleanup statistics", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

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
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            deletedAt: oldDate,
            deletedBy: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: oldDeleted2Id,
            content: "Old deleted comment 2",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            deletedAt: oldDate,
            deletedBy: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: recentDeletedId,
            content: "Recent deleted comment",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            deletedAt: recentDate,
            deletedBy: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.getCleanupStats();

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
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Generate unique IDs for this test to avoid conflicts
        const concurrent1Id = generateTestId("concurrent-1");
        const concurrent2Id = generateTestId("concurrent-2");

        // Create multiple comments for concurrent deletion
        await db.insert(schema.comments).values([
          {
            id: concurrent1Id,
            content: "Concurrent comment 1",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: concurrent2Id,
            content: "Concurrent comment 2",
            organizationId,
            issueId: testData.issue,
            authorId: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Delete both comments concurrently
        const [result1, result2] = await Promise.all([
          caller.delete({ commentId: concurrent1Id }),
          caller.delete({ commentId: concurrent2Id }),
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
          where: eq(schema.issueHistory.issueId, testData.issue),
        });
        expect(
          activities.filter((a) => a.type === "COMMENT_DELETED"),
        ).toHaveLength(2);
      });
    });

    test("should maintain referential integrity across service operations", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(
          db,
          organizationId,
        );

        // Test complete comment lifecycle: create -> soft delete -> restore -> cleanup

        // 1. Soft delete the comment
        await caller.delete({ commentId: testData.comment });

        // 2. Verify it appears in deleted comments
        const deletedComments = await caller.getDeleted();
        expect(
          deletedComments.find((c) => c.id === testData.comment),
        ).toBeDefined();

        // 3. Restore the comment
        await caller.restore({ commentId: testData.comment });

        // 4. Verify it no longer appears in deleted comments
        const deletedAfterRestore = await caller.getDeleted();
        expect(
          deletedAfterRestore.find((c) => c.id === testData.comment),
        ).toBeUndefined();

        // 5. Verify it appears in normal queries
        const normalComments = await caller.getForIssue({
          issueId: testData.issue,
        });
        expect(
          normalComments.find((c) => c.id === testData.comment),
        ).toBeDefined();
      });
    });
  });
});
