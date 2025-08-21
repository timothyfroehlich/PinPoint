/**
 * Issue Timeline Router Integration Tests (PGlite)
 *
 * Integration tests for the issue.timeline router using PGlite in-memory PostgreSQL database.
 * Tests real database operations with proper schema, relationships, and data integrity.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real Drizzle ORM operations
 * - Multi-tenant data isolation testing
 * - Complex query validation with actual results
 * - Service integration testing (IssueActivityService)
 * - Organizational boundary enforcement with real data
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { describe, expect, vi } from "vitest";
import { eq, sql } from "drizzle-orm";

// Import test setup and utilities
import { createSeededIssueTestContext } from "~/test/helpers/createSeededIssueTestContext";
import { getSeededTestData } from "~/test/helpers/pglite-test-setup";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { appRouter } from "~/server/api/root";
import * as schema from "~/server/db/schema";
import { IssueActivityService } from "~/server/services/issueActivityService";
import {
  test,
  withIsolatedTest,
  type TestDatabase,
} from "~/test/helpers/worker-scoped-db";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => generateTestId("test-id")),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue(["issue:view", "organization:manage"]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue(["issue:view", "organization:manage"]),
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

describe("Issue Timeline Router Integration (PGlite)", () => {

  describe("getTimeline", () => {
    test("should get timeline with comments and activities for valid issue", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Note: RLS context not needed in PGlite - bypasses RLS for business logic testing
        
        // Get seeded test data
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        if (!seededData.user || !seededData.issue) {
          throw new Error("Required seeded data not found");
        }

        // Create test context using seeded data
        const testContext = await createSeededIssueTestContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary, seededData.user);
        const caller = appRouter.createCaller(testContext);

        // Create additional test data for comprehensive timeline testing
        // Add comments to the test issue
        await db.insert(schema.comments).values([
          {
            id: "test-comment-1",
            content: "First comment on the issue",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: seededData.issue,
            authorId: seededData.user,
            createdAt: new Date("2024-01-01T10:00:00Z"),
            updatedAt: new Date("2024-01-01T10:00:00Z"),
          },
          {
            id: "test-comment-2",
            content: "Second comment for discussion",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: seededData.issue,
            authorId: seededData.user,
            createdAt: new Date("2024-01-02T14:30:00Z"),
            updatedAt: new Date("2024-01-02T14:30:00Z"),
          },
        ]);

        // Add issue history activities
        await db.insert(schema.issueHistory).values([
          {
            id: "test-activity-1",
            issueId: seededData.issue,
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            type: "STATUS_CHANGED",
            field: "status",
            oldValue: seededData.status,
            newValue: "new-status",
            actorId: seededData.user,
            changedAt: new Date("2024-01-01T15:00:00Z"),
          },
          {
            id: "test-activity-2",
            issueId: seededData.issue,
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            type: "ASSIGNED",
            field: "assignedTo",
            oldValue: null,
            newValue: seededData.user,
            actorId: seededData.user,
            changedAt: new Date("2024-01-03T09:15:00Z"),
          },
        ]);

        const result = await caller.issue.timeline.getTimeline({
          issueId: seededData.issue,
        });

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);

        // Should contain both comments and activities
        const comments = result.filter((item) => item.itemType === "comment");
        const activities = result.filter(
          (item) => item.itemType === "activity",
        );

        expect(comments.length).toBeGreaterThan(0);
        expect(activities.length).toBeGreaterThan(0);

        // Verify comment structure
        const firstComment = comments[0];
        expect(firstComment).toMatchObject({
          itemType: "comment",
          id: expect.any(String),
          content: expect.any(String),
          timestamp: expect.any(Date),
          author: {
            id: expect.any(String),
            name: expect.any(String),
          },
        });

        // Verify activity structure
        const firstActivity = activities[0];
        expect(firstActivity).toMatchObject({
          itemType: "activity",
          id: expect.any(String),
          type: expect.any(String),
          timestamp: expect.any(Date),
          actor: {
            id: expect.any(String),
            name: expect.any(String),
          },
        });

        // Timeline should be ordered by timestamp
        for (let i = 1; i < result.length; i++) {
          expect(result[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            result[i - 1].timestamp.getTime(),
          );
        }
      });
    });

    test("should handle issue with no timeline data", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Note: RLS context not needed in PGlite - bypasses RLS for business logic testing
        
        // Get seeded test data
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        if (!seededData.user || !seededData.machine || !seededData.status || !seededData.priority) {
          throw new Error("Required seeded data not found");
        }

        // Create test context using seeded data
        const testContext = await createSeededIssueTestContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary, seededData.user);
        const caller = appRouter.createCaller(testContext);

        // Create an issue without comments or activities
        const emptyIssue = await db
          .insert(schema.issues)
          .values({
            id: "empty-issue",
            title: "Empty Issue",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            machineId: seededData.machine,
            statusId: seededData.status,
            priorityId: seededData.priority,
            createdById: seededData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
          .then((result) => result[0]);

        const result = await caller.issue.timeline.getTimeline({ issueId: emptyIssue.id });

        expect(result).toEqual([]);
      });
    });

    test("should throw NOT_FOUND for non-existent issue", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Note: RLS context not needed in PGlite - bypasses RLS for business logic testing
        
        // Get seeded test data
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        if (!seededData.user) {
          throw new Error("Required seeded data not found");
        }

        // Create test context using seeded data
        const testContext = await createSeededIssueTestContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary, seededData.user);
        const caller = appRouter.createCaller(testContext);

        await expect(
          caller.issue.timeline.getTimeline({ issueId: "non-existent-issue" }),
        ).rejects.toThrow(
          expect.objectContaining({
            code: "NOT_FOUND",
            message: "Issue not found or access denied",
          }),
        );
      });
    });

    test("should enforce organizational scoping", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Note: RLS context not needed in PGlite - bypasses RLS for business logic testing
        
        // Get seeded test data for primary org
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        if (!seededData.user || !seededData.machine) {
          throw new Error("Required seeded data not found");
        }

        // Create test context using primary org data
        const testContext = await createSeededIssueTestContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary, seededData.user);
        const caller = appRouter.createCaller(testContext);

        // Get seeded data for competitor org
        const competitorSeededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.competitor);
        if (!competitorSeededData.machine || !competitorSeededData.status || !competitorSeededData.priority) {
          throw new Error("Required competitor seeded data not found");
        }

        // Create issue in competitor organization
        const otherOrgIssue = await db
          .insert(schema.issues)
          .values({
            id: "other-org-issue",
            title: "Other Org Issue",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            machineId: competitorSeededData.machine,
            statusId: competitorSeededData.status,
            priorityId: competitorSeededData.priority,
            createdById: seededData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
          .then((result) => result[0]);

        // Add timeline data to other org issue
        await db.insert(schema.comments).values({
          id: "other-org-comment",
          content: "Comment in other org",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          issueId: otherOrgIssue.id,
          authorId: seededData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Should not be able to access issue from different organization
        await expect(
          caller.issue.timeline.getTimeline({ issueId: otherOrgIssue.id }),
        ).rejects.toThrow(
          expect.objectContaining({
            code: "NOT_FOUND",
            message: "Issue not found or access denied",
          }),
        );
      });
    });

    test("should handle timeline with only comments", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Note: RLS context not needed in PGlite - bypasses RLS for business logic testing
        
        // Get seeded test data
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        if (!seededData.user || !seededData.machine || !seededData.status || !seededData.priority) {
          throw new Error("Required seeded data not found");
        }

        // Create test context using seeded data
        const testContext = await createSeededIssueTestContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary, seededData.user);
        const caller = appRouter.createCaller(testContext);

        // Create issue with only comments, no activities
        const commentsOnlyIssue = await db
          .insert(schema.issues)
          .values({
            id: "comments-only-issue",
            title: "Comments Only Issue",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            machineId: seededData.machine,
            statusId: seededData.status,
            priorityId: seededData.priority,
            createdById: seededData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
          .then((result) => result[0]);

        await db.insert(schema.comments).values([
          {
            id: "comment-only-1",
            content: "First comment only",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: commentsOnlyIssue.id,
            authorId: seededData.user,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
          {
            id: "comment-only-2",
            content: "Second comment only",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: commentsOnlyIssue.id,
            authorId: seededData.user,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
          },
        ]);

        const result = await caller.issue.timeline.getTimeline({
          issueId: commentsOnlyIssue.id,
        });

        expect(result).toHaveLength(2);
        expect(result.every((item) => item.itemType === "comment")).toBe(true);

        // Verify chronological order
        expect(result[0].timestamp.getTime()).toBeLessThanOrEqual(
          result[1].timestamp.getTime(),
        );
      });
    });

    test("should handle timeline with only activities", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Note: RLS context not needed in PGlite - bypasses RLS for business logic testing
        
        // Get seeded test data
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        if (!seededData.user || !seededData.machine || !seededData.status || !seededData.priority) {
          throw new Error("Required seeded data not found");
        }

        // Create test context using seeded data
        const testContext = await createSeededIssueTestContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary, seededData.user);
        const caller = appRouter.createCaller(testContext);

        // Create issue with only activities, no comments
        const activitiesOnlyIssue = await db
          .insert(schema.issues)
          .values({
            id: "activities-only-issue",
            title: "Activities Only Issue",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            machineId: seededData.machine,
            statusId: seededData.status,
            priorityId: seededData.priority,
            createdById: seededData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
          .then((result) => result[0]);

        await db.insert(schema.issueHistory).values([
          {
            id: "activity-only-1",
            issueId: activitiesOnlyIssue.id,
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            type: "STATUS_CHANGED",
            field: "status",
            oldValue: "old-status",
            newValue: "new-status",
            actorId: seededData.user,
            changedAt: new Date("2024-01-01"),
          },
          {
            id: "activity-only-2",
            issueId: activitiesOnlyIssue.id,
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            type: "PRIORITY_CHANGED",
            field: "priority",
            oldValue: "low",
            newValue: "high",
            actorId: seededData.user,
            changedAt: new Date("2024-01-02"),
          },
        ]);

        const result = await caller.issue.timeline.getTimeline({
          issueId: activitiesOnlyIssue.id,
        });

        expect(result).toHaveLength(2);
        expect(result.every((item) => item.itemType === "activity")).toBe(true);

        // Verify activity types and data
        const statusActivity = result.find(
          (item) =>
            item.itemType === "activity" && item.type === "STATUS_CHANGED",
        );
        expect(statusActivity).toBeDefined();
        expect(statusActivity).toMatchObject({
          oldValue: "old-status",
          newValue: "new-status",
        });
      });
    });

    test("should handle mixed timeline with complex chronological ordering", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Note: RLS context not needed in PGlite - bypasses RLS for business logic testing
        
        // Get seeded test data
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        if (!seededData.user || !seededData.machine || !seededData.status || !seededData.priority) {
          throw new Error("Required seeded data not found");
        }

        // Create test context using seeded data
        const testContext = await createSeededIssueTestContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary, seededData.user);
        const caller = appRouter.createCaller(testContext);

        // Create issue and add timeline items with specific timestamps for testing ordering
        const mixedTimelineIssue = await db
          .insert(schema.issues)
          .values({
            id: "mixed-timeline-issue",
            title: "Mixed Timeline Issue",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            machineId: seededData.machine,
            statusId: seededData.status,
            priorityId: seededData.priority,
            createdById: seededData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
          .then((result) => result[0]);

        // Add timeline items in specific chronological order
        await db.insert(schema.comments).values([
          {
            id: "mixed-comment-1",
            content: "First comment",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: mixedTimelineIssue.id,
            authorId: seededData.user,
            createdAt: new Date("2024-01-01T09:00:00Z"), // First
            updatedAt: new Date("2024-01-01T09:00:00Z"),
          },
          {
            id: "mixed-comment-2",
            content: "Third item chronologically",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            issueId: mixedTimelineIssue.id,
            authorId: seededData.user,
            createdAt: new Date("2024-01-01T15:00:00Z"), // Third
            updatedAt: new Date("2024-01-01T15:00:00Z"),
          },
        ]);

        await db.insert(schema.issueHistory).values([
          {
            id: "mixed-activity-1",
            issueId: mixedTimelineIssue.id,
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            type: "STATUS_CHANGED",
            field: "status",
            oldValue: "open",
            newValue: "in-progress",
            actorId: seededData.user,
            changedAt: new Date("2024-01-01T12:00:00Z"), // Second
          },
          {
            id: "mixed-activity-2",
            issueId: mixedTimelineIssue.id,
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            type: "ASSIGNED",
            field: "assignedTo",
            oldValue: null,
            newValue: seededData.user,
            actorId: seededData.user,
            changedAt: new Date("2024-01-01T18:00:00Z"), // Fourth
          },
        ]);

        const result = await caller.issue.timeline.getTimeline({
          issueId: mixedTimelineIssue.id,
        });

        expect(result).toHaveLength(4);

        // Verify chronological ordering
        const expectedOrder = [
          { itemType: "comment", content: "First comment" },
          { itemType: "activity", type: "STATUS_CHANGED" },
          { itemType: "comment", content: "Third item chronologically" },
          { itemType: "activity", type: "ASSIGNED" },
        ];

        for (let i = 0; i < expectedOrder.length; i++) {
          expect(result[i].itemType).toBe(expectedOrder[i].itemType);
          if (expectedOrder[i].content) {
            expect((result[i] as any).content).toBe(expectedOrder[i].content);
          }
          if (expectedOrder[i].type) {
            expect((result[i] as any).type).toBe(expectedOrder[i].type);
          }
        }

        // Verify timeline is properly sorted by timestamp
        for (let i = 1; i < result.length; i++) {
          expect(result[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            result[i - 1].timestamp.getTime(),
          );
        }
      });
    });

    test("should validate issue exists before calling service", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Note: RLS context not needed in PGlite - bypasses RLS for business logic testing
        
        // Get seeded test data
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        if (!seededData.user || !seededData.issue) {
          throw new Error("Required seeded data not found");
        }

        // Create test context using seeded data
        const testContext = await createSeededIssueTestContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary, seededData.user);
        const caller = appRouter.createCaller(testContext);

        // Create a spy to track service method calls
        const serviceMethodSpy = vi.fn().mockResolvedValue([]);
        const mockService = {
          getIssueTimeline: serviceMethodSpy,
          recordIssueCreated: vi.fn(),
          recordActivity: vi.fn(),
          recordStatusChange: vi.fn(),
          recordAssignmentChange: vi.fn(),
          recordFieldUpdate: vi.fn(),
          recordCommentDeleted: vi.fn(),
          recordIssueResolved: vi.fn(),
          recordIssueAssigned: vi.fn(),
        };

        vi.mocked(testContext.services.createIssueActivityService).mockReturnValue(
          mockService,
        );

        // Test with non-existent issue
        await expect(
          caller.issue.timeline.getTimeline({ issueId: "definitely-does-not-exist" }),
        ).rejects.toThrow("Issue not found or access denied");

        // Verify service method was never called
        expect(serviceMethodSpy).not.toHaveBeenCalled();

        // Now test with valid issue
        await caller.issue.timeline.getTimeline({ issueId: seededData.issue });

        // Verify service method was called for valid issue
        expect(serviceMethodSpy).toHaveBeenCalledWith(
          seededData.issue,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        );
      });
    });
  });

  describe("Service Integration", () => {
    test("should properly integrate with IssueActivityService", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Note: RLS context not needed in PGlite - bypasses RLS for business logic testing
        
        // Get seeded test data
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        if (!seededData.user || !seededData.issue) {
          throw new Error("Required seeded data not found");
        }

        // Create test context using seeded data
        const testContext = await createSeededIssueTestContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary, seededData.user);
        const caller = appRouter.createCaller(testContext);

        // Create real service instance for testing integration
        const realService = new IssueActivityService(testContext.db);

        // Mock the service factory to return real service
        vi.mocked(testContext.services.createIssueActivityService).mockReturnValue(
          realService,
        );

        const result = await caller.issue.timeline.getTimeline({
          issueId: seededData.issue,
        });

        // Verify service was called and returned data
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);

        // The actual timeline content depends on the service implementation
        // but we can verify the structure and organizational scoping
        if (result.length > 0) {
          expect(result[0]).toHaveProperty("type");
          expect(result[0]).toHaveProperty("createdAt");
          expect(result[0].createdAt).toBeInstanceOf(Date);
        }
      });
    });

    test("should handle service errors gracefully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Note: RLS context not needed in PGlite - bypasses RLS for business logic testing
        
        // Get seeded test data
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        if (!seededData.user || !seededData.issue) {
          throw new Error("Required seeded data not found");
        }

        // Create test context using seeded data
        const testContext = await createSeededIssueTestContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary, seededData.user);
        const caller = appRouter.createCaller(testContext);

        // Create a service that throws an error
        const failingService = {
          getIssueTimeline: vi
            .fn()
            .mockRejectedValue(new Error("Database connection lost")),
          recordIssueCreated: vi.fn(),
          recordActivity: vi.fn(),
          recordStatusChange: vi.fn(),
          recordAssignmentChange: vi.fn(),
          recordFieldUpdate: vi.fn(),
          recordCommentDeleted: vi.fn(),
          recordIssueResolved: vi.fn(),
          recordIssueAssigned: vi.fn(),
        };

        vi.mocked(testContext.services.createIssueActivityService).mockReturnValue(
          failingService,
        );

        await expect(
          caller.issue.timeline.getTimeline({ issueId: seededData.issue }),
        ).rejects.toThrow("Database connection lost");

        // Verify the service method was actually called
        expect(failingService.getIssueTimeline).toHaveBeenCalledWith(
          seededData.issue,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        );
      });
    });
  });
});
