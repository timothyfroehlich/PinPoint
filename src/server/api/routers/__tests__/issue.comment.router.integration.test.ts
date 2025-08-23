/**
 * Issue Comment Router Integration Tests (PGlite)
 * Tests comment router procedures with real database operations using seeded data
 * Memory-safe worker-scoped pattern with transaction isolation
 */

import { eq, sql } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

import { generateId } from "~/lib/utils/id-generation";
import { appRouter } from "~/server/api/root";
import { comments, issues } from "~/server/db/schema";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createSeededIssueTestContext } from "~/test/helpers/createSeededIssueTestContext";

// Note: Replaced local createTestContext with shared createSeededIssueTestContext helper

// Mock NextAuth for integration tests
vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock permissions system
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    getUserPermissionsForSession: vi
      .fn()
      .mockResolvedValue([
        "comment:create",
        "comment:edit",
        "comment:delete",
        "admin:view",
      ]),
    getUserPermissionsForSupabaseUser: vi
      .fn()
      .mockResolvedValue([
        "comment:create",
        "comment:edit",
        "comment:delete",
        "admin:view",
      ]),
    requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
  };
});

// Note: Service mocks now handled by createSeededIssueTestContext helper

describe("Issue Comment Router Integration Tests (PGlite)", () => {
  describe("Comment Creation", () => {
    test("should create comment with proper organizational scoping", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for primary org
        await db.execute(
          sql.raw(
            `SET app.current_organization_id = '${SEED_TEST_IDS.ORGANIZATIONS.primary}'`,
          ),
        );

        // Create an issue first using static seed data
        const issueId = generateId();
        await db.insert(issues).values({
          id: issueId,
          title: "Test Issue for Comment",
          description: "Test description",
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          statusId: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
          priorityId: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
          createdById: SEED_TEST_IDS.USERS.ADMIN,
        });

        // Create test context with real database using shared helper
        const testContext = await createSeededIssueTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        const caller = appRouter.createCaller(testContext);

        // Create comment using the router
        const result = await caller.issue.comment.addComment({
          issueId: issueId,
          content: "This is a test comment",
        });

        // Verify comment was created with correct organization scoping
        expect(result.id).toBeDefined();
        expect(result.content).toBe("This is a test comment");
        expect(result.issueId).toBe(issueId);
        expect(result.authorId).toBe(SEED_TEST_IDS.USERS.ADMIN);
        expect(result.author).toBeDefined();
        expect(result.author.id).toBe(seededData.user);

        // Verify comment exists in database
        const dbComment = await db.query.comments.findFirst({
          where: eq(comments.id, result.id),
        });

        expect(dbComment).toBeDefined();
        expect(dbComment?.organizationId).toBe(
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        );
        expect(dbComment?.issueId).toBe(issueId);
        expect(dbComment?.authorId).toBe(seededData.user);
      });
    });

    test("should enforce issue accessibility for comment creation", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for primary org
        await db.execute(
          sql.raw(
            `SET app.current_organization_id = '${SEED_TEST_IDS.ORGANIZATIONS.primary}'`,
          ),
        );

        // Use seeded data for real relationships
        const seededData = await getSeededTestData(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        );

        // Skip if no seeded data available
        if (!seededData.user) {
          console.log("Skipping test - no seeded user available");
          return;
        }

        // Create test context with seeded user data
        const testContext = await createSeededIssueTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          seededData.user,
        );

        const caller = appRouter.createCaller(testContext);

        // Try to create comment for non-existent issue - should fail
        await expect(
          caller.issue.comment.addComment({
            issueId: "non-existent-issue-id",
            content: "This should fail",
          }),
        ).rejects.toThrow("Issue not found");
      });
    });
  });

  describe("Comment Editing", () => {
    test("should allow users to edit their own comments", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for primary org
        await db.execute(
          sql.raw(
            `SET app.current_organization_id = '${SEED_TEST_IDS.ORGANIZATIONS.primary}'`,
          ),
        );

        // Use seeded data for real relationships
        const seededData = await getSeededTestData(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        );

        // Skip if no seeded data available
        if (!seededData.user) {
          console.log("Skipping test - no seeded user available");
          return;
        }

        // Create an issue and comment first
        const issueId = generateId();
        const commentId = generateId();

        await db.insert(issues).values({
          id: issueId,
          title: "Test Issue for Comment Edit",
          description: "Test description",
          machineId: seededData.machine,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        });

        await db.insert(comments).values({
          id: commentId,
          content: "Original comment content",
          issueId: issueId,
          authorId: seededData.user,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        });

        const testContext = await createSeededIssueTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          seededData.user,
        );

        const caller = appRouter.createCaller(testContext);

        // Edit the comment
        const result = await caller.issue.comment.editComment({
          commentId: commentId,
          content: "Updated comment content",
        });

        expect(result.id).toBe(commentId);
        expect(result.content).toBe("Updated comment content");
        expect(result.updatedAt).toBeDefined();

        // Verify update in database
        const dbComment = await db.query.comments.findFirst({
          where: eq(comments.id, commentId),
        });

        expect(dbComment?.content).toBe("Updated comment content");
        expect(dbComment?.updatedAt).toBeDefined();
      });
    });

    test("should prevent users from editing others' comments", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for primary org
        await db.execute(
          sql.raw(
            `SET app.current_organization_id = '${SEED_TEST_IDS.ORGANIZATIONS.primary}'`,
          ),
        );

        // Use seeded data for real relationships
        const seededData = await getSeededTestData(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        );

        // Skip if no seeded data available (need two users)
        if (!seededData.user || !seededData.user2) {
          console.log("Skipping test - need two seeded users");
          return;
        }

        // Create an issue and comment by user1
        const issueId = generateId();
        const commentId = generateId();

        await db.insert(issues).values({
          id: issueId,
          title: "Test Issue for Comment Edit Block",
          description: "Test description",
          machineId: seededData.machine,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        });

        await db.insert(comments).values({
          id: commentId,
          content: "User1's comment",
          issueId: issueId,
          authorId: seededData.user, // Created by user1
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        });

        // Try to edit as user2
        const testContext = await createSeededIssueTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          seededData.user2, // Different user
        );

        const caller = appRouter.createCaller(testContext);

        // Should fail with forbidden error
        await expect(
          caller.issue.comment.editComment({
            commentId: commentId,
            content: "User2 trying to edit",
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe("Comment Deletion", () => {
    test("should allow users to delete their own comments", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for primary org
        await db.execute(
          sql.raw(
            `SET app.current_organization_id = '${SEED_TEST_IDS.ORGANIZATIONS.primary}'`,
          ),
        );

        // Use seeded data for real relationships
        const seededData = await getSeededTestData(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        );

        // Skip if no seeded data available
        if (!seededData.user) {
          console.log("Skipping test - no seeded user available");
          return;
        }

        // Create an issue and comment first
        const issueId = generateId();
        const commentId = generateId();

        await db.insert(issues).values({
          id: issueId,
          title: "Test Issue for Comment Delete",
          description: "Test description",
          machineId: seededData.machine,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        });

        await db.insert(comments).values({
          id: commentId,
          content: "Comment to delete",
          issueId: issueId,
          authorId: seededData.user,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        });

        const testContext = await createSeededIssueTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          seededData.user,
        );

        const caller = appRouter.createCaller(testContext);

        // Delete the comment
        const result = await caller.issue.comment.deleteComment({
          commentId: commentId,
        });

        expect(result).toBeDefined();

        // Verify comment is soft-deleted in database
        const dbComment = await db.query.comments.findFirst({
          where: eq(comments.id, commentId),
        });

        expect(dbComment?.deletedAt).toBeDefined();
      });
    });
  });

  describe("Comment Restoration", () => {
    test("should allow admins to restore deleted comments", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for primary org
        await db.execute(
          sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`,
        );

        // Use seeded data for real relationships
        const seededData = await getSeededTestData(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        );

        // Skip if no seeded data available
        if (!seededData.user) {
          console.log("Skipping test - no seeded user available");
          return;
        }

        // Create an issue and deleted comment first
        const issueId = generateId();
        const commentId = generateId();

        await db.insert(issues).values({
          id: issueId,
          title: "Test Issue for Comment Restore",
          description: "Test description",
          machineId: seededData.machine,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        });

        await db.insert(comments).values({
          id: commentId,
          content: "Comment to restore",
          issueId: issueId,
          authorId: seededData.user,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          deletedAt: new Date(), // Pre-deleted comment
        });

        const testContext = await createSeededIssueTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          seededData.user,
        );

        const caller = appRouter.createCaller(testContext);

        // Restore the comment
        const result = await caller.issue.comment.restoreComment({
          commentId: commentId,
        });

        expect(result).toBeDefined();

        // Verify comment is restored in database
        const dbComment = await db.query.comments.findFirst({
          where: eq(comments.id, commentId),
        });

        expect(dbComment?.deletedAt).toBeNull();
      });
    });
  });

  describe("Deleted Comments Admin View", () => {
    test("should allow admins to view deleted comments", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for primary org
        await db.execute(
          sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`,
        );

        // Use seeded data for real relationships
        const seededData = await getSeededTestData(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        );

        // Skip if no seeded data available
        if (!seededData.user) {
          console.log("Skipping test - no seeded user available");
          return;
        }

        // Create an issue and deleted comment first
        const issueId = generateId();
        const commentId = generateId();

        await db.insert(issues).values({
          id: issueId,
          title: "Test Issue for Deleted View",
          description: "Test description",
          machineId: seededData.machine,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        });

        await db.insert(comments).values({
          id: commentId,
          content: "Deleted comment",
          issueId: issueId,
          authorId: seededData.user,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          deletedAt: new Date(), // Pre-deleted comment
        });

        const testContext = await createSeededIssueTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          seededData.user,
        );

        const caller = appRouter.createCaller(testContext);

        // Get deleted comments
        const result = await caller.issue.comment.getDeletedComments();

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        // Should contain our deleted comment (among any others)
        const foundComment = result.find((c) => c.id === commentId);
        expect(foundComment).toBeDefined();
        expect(foundComment?.deletedAt).toBeDefined();
      });
    });
  });

  describe("Organizational Boundaries", () => {
    test("should enforce cross-organizational comment access", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for competitor org first to create data there
        await db.execute(
          sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`,
        );

        // Get seeded data for competitor org
        const competitorSeededData = await getSeededTestData(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.competitor,
        );

        // Skip if no seeded data available
        if (!competitorSeededData.user) {
          console.log(
            "Skipping test - no competitor org seeded user available",
          );
          return;
        }

        // Create an issue in competitor organization
        const issueId = generateId();
        const commentId = generateId();

        await db.insert(issues).values({
          id: issueId,
          title: "Cross-org Issue",
          description: "Test description",
          machineId: competitorSeededData.machine,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          statusId: competitorSeededData.status,
          priorityId: competitorSeededData.priority,
          createdById: competitorSeededData.user,
        });

        await db.insert(comments).values({
          id: commentId,
          content: "Cross-org comment",
          issueId: issueId,
          authorId: competitorSeededData.user,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
        });

        // Now switch to primary org and try to access competitor org data
        await db.execute(
          sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`,
        );
        const primarySeededData = await getSeededTestData(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        );

        if (!primarySeededData.user) {
          console.log("Skipping test - no primary org seeded user available");
          return;
        }

        const testContext = await createSeededIssueTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary, // User's org
          primarySeededData.user,
        );

        const caller = appRouter.createCaller(testContext);

        // Try to edit comment from different org - should fail
        await expect(
          caller.issue.comment.editComment({
            commentId: commentId,
            content: "Should not work",
          }),
        ).rejects.toThrow();

        // Try to delete comment from different org - should fail
        await expect(
          caller.issue.comment.deleteComment({
            commentId: commentId,
          }),
        ).rejects.toThrow();
      });
    });
  });
});
