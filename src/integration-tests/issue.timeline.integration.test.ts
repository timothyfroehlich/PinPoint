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

// No drizzle-orm imports needed
import { describe, expect, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";

import { issueTimelineRouter } from "~/server/api/routers/issue.timeline";
import * as schema from "~/server/db/schema";
import { IssueActivityService } from "~/server/services/issueActivityService";
import { generateTestId } from "~/test/helpers/test-id-generator";
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
  // Helper function to create test context and caller
  async function createTestContext(db: TestDatabase) {
    // Create seed data for this test run
    const organizationId = generateTestId("test-org");

    // Create test organization
    await db.insert(schema.organizations).values({
      id: organizationId,
      name: "Test Organization",
      subdomain: generateTestId("test-org"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test user
    const userId = generateTestId("test-user");
    await db.insert(schema.users).values({
      id: userId,
      email: "test@example.com",
      name: "Test User",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test location
    const locationId = generateTestId("test-location");
    await db.insert(schema.locations).values({
      id: locationId,
      name: "Test Location",
      organizationId,
    });

    // Create test model
    const modelId = generateTestId("test-model");
    await db.insert(schema.models).values({
      id: modelId,
      name: "Test Model",
      manufacturer: "Test Manufacturer",
      organizationId,
    });

    // Create test machine
    const machineId = generateTestId("test-machine");
    await db.insert(schema.machines).values({
      id: machineId,
      name: "Test Machine",
      qrCodeId: generateTestId("qr"),
      organizationId,
      locationId,
      modelId,
      serialNumber: `SN-${generateTestId("sn")}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test priority
    const priorityId = generateTestId("test-priority");
    await db.insert(schema.priorities).values({
      id: priorityId,
      name: "Test Priority",
      organizationId,
      order: 1,
    });

    // Create test status
    const statusId = generateTestId("test-status");
    await db.insert(schema.issueStatuses).values({
      id: statusId,
      name: "Test Status",
      category: "NEW",
      organizationId,
    });

    // Create test issue
    const issueId = generateTestId("test-issue");
    await db.insert(schema.issues).values({
      id: issueId,
      title: "Test Issue",
      organizationId,
      machineId,
      statusId,
      priorityId,
      createdById: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const testData = {
      organization: organizationId,
      location: locationId,
      machine: machineId,
      model: modelId,
      status: statusId,
      priority: priorityId,
      issue: issueId,
      user: userId,
    };

    // Create services with direct Drizzle access
    const issueActivityService = new IssueActivityService(db);

    // Create test context with real database and services
    const context: TRPCContext = {
      user: {
        id: testData.user,
        email: "test@example.com",
        user_metadata: { name: "Test User" },
        app_metadata: { organization_id: testData.organization, role: "Admin" },
      },
      organization: {
        id: testData.organization,
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
        createIssueActivityService: vi.fn(() => issueActivityService),
        createNotificationService: vi.fn(),
        createCommentCleanupService: vi.fn(),
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
      userPermissions: ["issue:view", "organization:manage"],
    } as any;

    const caller = issueTimelineRouter.createCaller(context);

    return { context, caller, testData };
  }

  describe("getTimeline", () => {
    test("should get timeline with comments and activities for valid issue", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, testData } = await createTestContext(db);

        // Create additional test data for comprehensive timeline testing
        // Add comments to the test issue
        await db.insert(schema.comments).values([
          {
            id: "test-comment-1",
            content: "First comment on the issue",
            organizationId: testData.organization,
            issueId: testData.issue,
            authorId: testData.user,
            createdAt: new Date("2024-01-01T10:00:00Z"),
            updatedAt: new Date("2024-01-01T10:00:00Z"),
          },
          {
            id: "test-comment-2",
            content: "Second comment for discussion",
            organizationId: testData.organization,
            issueId: testData.issue,
            authorId: testData.user,
            createdAt: new Date("2024-01-02T14:30:00Z"),
            updatedAt: new Date("2024-01-02T14:30:00Z"),
          },
        ]);

        // Add issue history activities
        await db.insert(schema.issueHistory).values([
          {
            id: "test-activity-1",
            issueId: testData.issue,
            organizationId: testData.organization,
            type: "STATUS_CHANGED",
            field: "status",
            oldValue: testData.status,
            newValue: "new-status",
            actorId: testData.user,
            changedAt: new Date("2024-01-01T15:00:00Z"),
          },
          {
            id: "test-activity-2",
            issueId: testData.issue,
            organizationId: testData.organization,
            type: "ASSIGNED",
            field: "assignedTo",
            oldValue: null,
            newValue: testData.user,
            actorId: testData.user,
            changedAt: new Date("2024-01-03T09:15:00Z"),
          },
        ]);

        const result = await caller.getTimeline({
          issueId: testData.issue,
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
        const { caller, testData } = await createTestContext(db);

        // Create an issue without comments or activities
        const emptyIssue = await db
          .insert(schema.issues)
          .values({
            id: "empty-issue",
            title: "Empty Issue",
            organizationId: testData.organization,
            machineId: testData.machine,
            statusId: testData.status,
            priorityId: testData.priority,
            createdById: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
          .then((result) => result[0]);

        const result = await caller.getTimeline({ issueId: emptyIssue.id });

        expect(result).toEqual([]);
      });
    });

    test("should throw NOT_FOUND for non-existent issue", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller } = await createTestContext(db);

        await expect(
          caller.getTimeline({ issueId: "non-existent-issue" }),
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
        const { caller, testData } = await createTestContext(db);

        // Create issue in different organization
        const otherOrgId = "other-org-timeline";
        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Organization",
          subdomain: "other-org-timeline",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.priorities).values({
          id: "other-priority-timeline",
          name: "Other Priority",
          organizationId: otherOrgId,
          order: 1,
        });

        await db.insert(schema.issueStatuses).values({
          id: "other-status-timeline",
          name: "Other Status",
          category: "NEW",
          organizationId: otherOrgId,
        });

        const otherOrgIssue = await db
          .insert(schema.issues)
          .values({
            id: "other-org-issue",
            title: "Other Org Issue",
            organizationId: otherOrgId,
            machineId: testData.machine,
            statusId: "other-status-timeline",
            priorityId: "other-priority-timeline",
            createdById: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
          .then((result) => result[0]);

        // Add timeline data to other org issue
        await db.insert(schema.comments).values({
          id: "other-org-comment",
          content: "Comment in other org",
          organizationId: otherOrgId,
          issueId: otherOrgIssue.id,
          authorId: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Should not be able to access issue from different organization
        await expect(
          caller.getTimeline({ issueId: otherOrgIssue.id }),
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
        const { caller, testData } = await createTestContext(db);
        // Create issue with only comments, no activities
        const commentsOnlyIssue = await db
          .insert(schema.issues)
          .values({
            id: "comments-only-issue",
            title: "Comments Only Issue",
            organizationId: testData.organization,
            machineId: testData.machine,
            statusId: testData.status,
            priorityId: testData.priority,
            createdById: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
          .then((result) => result[0]);

        await db.insert(schema.comments).values([
          {
            id: "comment-only-1",
            content: "First comment only",
            organizationId: testData.organization,
            issueId: commentsOnlyIssue.id,
            authorId: testData.user,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
          {
            id: "comment-only-2",
            content: "Second comment only",
            organizationId: testData.organization,
            issueId: commentsOnlyIssue.id,
            authorId: testData.user,
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
          },
        ]);

        const result = await caller.getTimeline({
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
        const { caller, testData } = await createTestContext(db);

        // Create issue with only activities, no comments
        const activitiesOnlyIssue = await db
          .insert(schema.issues)
          .values({
            id: "activities-only-issue",
            title: "Activities Only Issue",
            organizationId: testData.organization,
            machineId: testData.machine,
            statusId: testData.status,
            priorityId: testData.priority,
            createdById: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
          .then((result) => result[0]);

        await db.insert(schema.issueHistory).values([
          {
            id: "activity-only-1",
            issueId: activitiesOnlyIssue.id,
            organizationId: testData.organization,
            type: "STATUS_CHANGED",
            field: "status",
            oldValue: "old-status",
            newValue: "new-status",
            actorId: testData.user,
            changedAt: new Date("2024-01-01"),
          },
          {
            id: "activity-only-2",
            issueId: activitiesOnlyIssue.id,
            organizationId: testData.organization,
            type: "PRIORITY_CHANGED",
            field: "priority",
            oldValue: "low",
            newValue: "high",
            actorId: testData.user,
            changedAt: new Date("2024-01-02"),
          },
        ]);

        const result = await caller.getTimeline({
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
        const { caller, testData } = await createTestContext(db);

        // Create issue and add timeline items with specific timestamps for testing ordering
        const mixedTimelineIssue = await db
          .insert(schema.issues)
          .values({
            id: "mixed-timeline-issue",
            title: "Mixed Timeline Issue",
            organizationId: testData.organization,
            machineId: testData.machine,
            statusId: testData.status,
            priorityId: testData.priority,
            createdById: testData.user,
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
            organizationId: testData.organization,
            issueId: mixedTimelineIssue.id,
            authorId: testData.user,
            createdAt: new Date("2024-01-01T09:00:00Z"), // First
            updatedAt: new Date("2024-01-01T09:00:00Z"),
          },
          {
            id: "mixed-comment-2",
            content: "Third item chronologically",
            organizationId: testData.organization,
            issueId: mixedTimelineIssue.id,
            authorId: testData.user,
            createdAt: new Date("2024-01-01T15:00:00Z"), // Third
            updatedAt: new Date("2024-01-01T15:00:00Z"),
          },
        ]);

        await db.insert(schema.issueHistory).values([
          {
            id: "mixed-activity-1",
            issueId: mixedTimelineIssue.id,
            organizationId: testData.organization,
            type: "STATUS_CHANGED",
            field: "status",
            oldValue: "open",
            newValue: "in-progress",
            actorId: testData.user,
            changedAt: new Date("2024-01-01T12:00:00Z"), // Second
          },
          {
            id: "mixed-activity-2",
            issueId: mixedTimelineIssue.id,
            organizationId: testData.organization,
            type: "ASSIGNED",
            field: "assignedTo",
            oldValue: null,
            newValue: testData.user,
            actorId: testData.user,
            changedAt: new Date("2024-01-01T18:00:00Z"), // Fourth
          },
        ]);

        const result = await caller.getTimeline({
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
        const { context, caller, testData } = await createTestContext(db);

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

        vi.mocked(context.services.createIssueActivityService).mockReturnValue(
          mockService,
        );

        // Test with non-existent issue
        await expect(
          caller.getTimeline({ issueId: "definitely-does-not-exist" }),
        ).rejects.toThrow("Issue not found or access denied");

        // Verify service method was never called
        expect(serviceMethodSpy).not.toHaveBeenCalled();

        // Now test with valid issue
        await caller.getTimeline({ issueId: testData.issue });

        // Verify service method was called for valid issue
        expect(serviceMethodSpy).toHaveBeenCalledWith(
          testData.issue,
          testData.organization,
        );
      });
    });
  });

  describe("Service Integration", () => {
    test("should properly integrate with IssueActivityService", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { context, caller, testData } = await createTestContext(db);

        // Create real service instance for testing integration
        const realService = new IssueActivityService(context.db);

        // Mock the service factory to return real service
        vi.mocked(context.services.createIssueActivityService).mockReturnValue(
          realService,
        );

        const result = await caller.getTimeline({
          issueId: testData.issue,
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
        const { context, caller, testData } = await createTestContext(db);

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

        vi.mocked(context.services.createIssueActivityService).mockReturnValue(
          failingService,
        );

        await expect(
          caller.getTimeline({ issueId: testData.issue }),
        ).rejects.toThrow("Database connection lost");

        // Verify the service method was actually called
        expect(failingService.getIssueTimeline).toHaveBeenCalledWith(
          testData.issue,
          testData.organization,
        );
      });
    });
  });
});
