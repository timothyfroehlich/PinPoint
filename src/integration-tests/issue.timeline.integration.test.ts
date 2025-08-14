/* eslint-disable @typescript-eslint/unbound-method */
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

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";
import type { ExtendedPrismaClient } from "~/server/db";

import { issueTimelineRouter } from "~/server/api/routers/issue.timeline";
import * as schema from "~/server/db/schema";
import { IssueActivityService } from "~/server/services/issueActivityService";
import {
  createSeededTestDatabase,
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => `test-id-${Date.now()}`),
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
  let db: TestDatabase;
  let context: TRPCContext;
  let caller: ReturnType<typeof issueTimelineRouter.createCaller>;

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

    // Query actual seeded IDs instead of using hardcoded ones
    testData = await getSeededTestData(db, setup.organizationId);

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
              { id: "perm2", name: "organization:manage" },
            ],
          },
        }),
      },
      // Add required methods for IssueActivityService compatibility
      issueHistory: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          // Create issue history in real database
          const historyEntry = {
            id: `history-${Date.now()}`,
            ...data,
            changedAt: new Date(),
          };

          return await db
            .insert(schema.issueHistory)
            .values(historyEntry)
            .returning()
            .then((result) => result[0]);
        }),
        findMany: vi.fn().mockImplementation(async ({ where, include }) => {
          // Get issue history for timeline from real database
          if (where?.issueId && where?.organizationId) {
            const activities = await db.query.issueHistory.findMany({
              where: (history, { eq, and }) =>
                and(
                  eq(history.issueId, where.issueId),
                  eq(history.organizationId, where.organizationId),
                ),
              with: include?.actor
                ? {
                    actor: {
                      columns: {
                        id: true,
                        name: true,
                        profilePicture: true,
                      },
                    },
                  }
                : {},
              orderBy: (history, { asc }) => [asc(history.changedAt)],
            });

            return activities.map((activity) => ({
              id: activity.id,
              field: activity.field,
              oldValue: activity.oldValue,
              newValue: activity.newValue,
              changedAt: activity.changedAt,
              actorId: activity.actorId,
              issueId: activity.issueId,
              organizationId: activity.organizationId,
              type: activity.type,
              actor: activity.actor
                ? {
                    id: activity.actor.id,
                    name: activity.actor.name,
                    profilePicture: activity.actor.profilePicture,
                  }
                : null,
            }));
          }
          return [];
        }),
      },
      comment: {
        findMany: vi.fn().mockImplementation(async ({ where }) => {
          // Get comments for timeline from real database
          if (where?.issueId) {
            const comments = await db.query.comments.findMany({
              where: eq(schema.comments.issueId, where.issueId),
              with: {
                author: {
                  columns: {
                    id: true,
                    name: true,
                    profilePicture: true,
                  },
                },
              },
              orderBy: (comments, { asc }) => [asc(comments.createdAt)],
            });

            return comments.map((comment) => ({
              id: comment.id,
              content: comment.content,
              createdAt: comment.createdAt,
              updatedAt: comment.updatedAt,
              issueId: comment.issueId,
              authorId: comment.authorId,
              author: comment.author
                ? {
                    id: comment.author.id,
                    name: comment.author.name,
                    profilePicture: comment.author.profilePicture,
                  }
                : null,
            }));
          }
          return [];
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
        createIssueActivityService: vi.fn(
          () => new IssueActivityService(mockPrismaClient),
        ),
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

    caller = issueTimelineRouter.createCaller(context);
  });

  describe("getTimeline", () => {
    beforeEach(async () => {
      // Create additional test data for comprehensive timeline testing
      // Add comments to the test issue
      await db.insert(schema.comments).values([
        {
          id: "test-comment-1",
          content: "First comment on the issue",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date("2024-01-01T10:00:00Z"),
          updatedAt: new Date("2024-01-01T10:00:00Z"),
        },
        {
          id: "test-comment-2",
          content: "Second comment for discussion",
          issueId: testData.issue || "test-issue-1",
          authorId: testData.user || "test-user-1",
          createdAt: new Date("2024-01-02T14:30:00Z"),
          updatedAt: new Date("2024-01-02T14:30:00Z"),
        },
      ]);

      // Add issue history activities
      await db.insert(schema.issueHistory).values([
        {
          id: "test-activity-1",
          issueId: testData.issue || "test-issue-1",
          organizationId: testData.organization,
          type: "STATUS_CHANGED",
          field: "status",
          oldValue: testData.status || "initial-status",
          newValue: "new-status",
          actorId: testData.user || "test-user-1",
          changedAt: new Date("2024-01-01T15:00:00Z"),
        },
        {
          id: "test-activity-2",
          issueId: testData.issue || "test-issue-1",
          organizationId: testData.organization,
          type: "ASSIGNED",
          field: "assignedTo",
          oldValue: null,
          newValue: testData.user || "test-user-1",
          actorId: testData.user || "test-user-1",
          changedAt: new Date("2024-01-03T09:15:00Z"),
        },
      ]);
    });

    it("should get timeline with comments and activities for valid issue", async () => {
      const result = await caller.getTimeline({
        issueId: testData.issue || "test-issue-1",
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Should contain both comments and activities
      const comments = result.filter((item) => item.itemType === "comment");
      const activities = result.filter((item) => item.itemType === "activity");

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

    it("should handle issue with no timeline data", async () => {
      // Create an issue without comments or activities
      const emptyIssue = await db
        .insert(schema.issues)
        .values({
          id: "empty-issue",
          title: "Empty Issue",
          organizationId: testData.organization,
          machineId: testData.machine || "test-machine-1",
          statusId: testData.status || "test-status-1",
          priorityId: testData.priority || "test-priority-1",
          createdById: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .then((result) => result[0]);

      const result = await caller.getTimeline({ issueId: emptyIssue.id });

      expect(result).toEqual([]);
    });

    it("should throw NOT_FOUND for non-existent issue", async () => {
      await expect(
        caller.getTimeline({ issueId: "non-existent-issue" }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "NOT_FOUND",
          message: "Issue not found or access denied",
        }),
      );
    });

    it("should enforce organizational scoping", async () => {
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
          machineId: testData.machine || "test-machine-1",
          statusId: "other-status-timeline",
          priorityId: "other-priority-timeline",
          createdById: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .then((result) => result[0]);

      // Add timeline data to other org issue
      await db.insert(schema.comments).values({
        id: "other-org-comment",
        content: "Comment in other org",
        issueId: otherOrgIssue.id,
        authorId: testData.user || "test-user-1",
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

    it("should handle timeline with only comments", async () => {
      // Create issue with only comments, no activities
      const commentsOnlyIssue = await db
        .insert(schema.issues)
        .values({
          id: "comments-only-issue",
          title: "Comments Only Issue",
          organizationId: testData.organization,
          machineId: testData.machine || "test-machine-1",
          statusId: testData.status || "test-status-1",
          priorityId: testData.priority || "test-priority-1",
          createdById: testData.user || "test-user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .then((result) => result[0]);

      await db.insert(schema.comments).values([
        {
          id: "comment-only-1",
          content: "First comment only",
          issueId: commentsOnlyIssue.id,
          authorId: testData.user || "test-user-1",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
        {
          id: "comment-only-2",
          content: "Second comment only",
          issueId: commentsOnlyIssue.id,
          authorId: testData.user || "test-user-1",
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

    it("should handle timeline with only activities", async () => {
      // Create issue with only activities, no comments
      const activitiesOnlyIssue = await db
        .insert(schema.issues)
        .values({
          id: "activities-only-issue",
          title: "Activities Only Issue",
          organizationId: testData.organization,
          machineId: testData.machine || "test-machine-1",
          statusId: testData.status || "test-status-1",
          priorityId: testData.priority || "test-priority-1",
          createdById: testData.user || "test-user-1",
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
          actorId: testData.user || "test-user-1",
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
          actorId: testData.user || "test-user-1",
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

    it("should handle mixed timeline with complex chronological ordering", async () => {
      // Create issue and add timeline items with specific timestamps for testing ordering
      const mixedTimelineIssue = await db
        .insert(schema.issues)
        .values({
          id: "mixed-timeline-issue",
          title: "Mixed Timeline Issue",
          organizationId: testData.organization,
          machineId: testData.machine || "test-machine-1",
          statusId: testData.status || "test-status-1",
          priorityId: testData.priority || "test-priority-1",
          createdById: testData.user || "test-user-1",
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
          issueId: mixedTimelineIssue.id,
          authorId: testData.user || "test-user-1",
          createdAt: new Date("2024-01-01T09:00:00Z"), // First
          updatedAt: new Date("2024-01-01T09:00:00Z"),
        },
        {
          id: "mixed-comment-2",
          content: "Third item chronologically",
          issueId: mixedTimelineIssue.id,
          authorId: testData.user || "test-user-1",
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
          actorId: testData.user || "test-user-1",
          changedAt: new Date("2024-01-01T12:00:00Z"), // Second
        },
        {
          id: "mixed-activity-2",
          issueId: mixedTimelineIssue.id,
          organizationId: testData.organization,
          type: "ASSIGNED",
          field: "assignedTo",
          oldValue: null,
          newValue: testData.user || "test-user-1",
          actorId: testData.user || "test-user-1",
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

    it("should validate issue exists before calling service", async () => {
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
      await caller.getTimeline({ issueId: testData.issue || "test-issue-1" });

      // Verify service method was called for valid issue
      expect(serviceMethodSpy).toHaveBeenCalledWith(
        testData.issue || "test-issue-1",
        testData.organization,
      );
    });
  });

  describe("Service Integration", () => {
    it("should properly integrate with IssueActivityService", async () => {
      // Create real service instance for testing integration
      const realService = new IssueActivityService(context.db);

      // Mock the service factory to return real service
      vi.mocked(context.services.createIssueActivityService).mockReturnValue(
        realService,
      );

      const result = await caller.getTimeline({
        issueId: testData.issue || "test-issue-1",
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

    it("should handle service errors gracefully", async () => {
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
        caller.getTimeline({ issueId: testData.issue || "test-issue-1" }),
      ).rejects.toThrow("Database connection lost");

      // Verify the service method was actually called
      expect(failingService.getIssueTimeline).toHaveBeenCalledWith(
        testData.issue || "test-issue-1",
        testData.organization,
      );
    });
  });
});
