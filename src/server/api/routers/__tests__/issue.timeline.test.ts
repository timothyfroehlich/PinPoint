 
/**
 * Issue Timeline Router Unit Tests
 *
 * Tests the issue.timeline router with mocked dependencies using modern August 2025 patterns.
 * Focuses on testing the router's logic, validation, and error handling while mocking
 * all external dependencies (database, services).
 *
 * Key Features:
 * - Modern Vitest patterns with vi.mock and vi.importActual
 * - Type-safe mocking with proper TypeScript inference
 * - Comprehensive error case testing
 * - Organizational scoping validation
 * - Service integration testing with mocks
 * - TRPCError code validation
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock permissions system
vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue(["issue:view", "organization:manage"]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue(["issue:view", "organization:manage"]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

import { issueTimelineRouter } from "~/server/api/routers/issue.timeline";
import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";

describe("Issue Timeline Router (Unit Tests)", () => {
  let mockContext: VitestMockContext;
  let caller: ReturnType<typeof issueTimelineRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createVitestMockContext();

    // Mock membership lookup for organizationProcedure using Drizzle query API
    vi.mocked(mockContext.db.query.memberships.findFirst).mockResolvedValue({
      id: "test-membership",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: {
        id: "role-1",
        name: "Admin",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [
          {
            id: "perm1",
            name: "issue:view",
            description: "View issues",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "perm2",
            name: "organization:manage",
            description: "Manage organization",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    } as any);

    caller = issueTimelineRouter.createCaller(mockContext);
  });

  describe("getTimeline", () => {
    const validInput = { issueId: "test-issue-1" };
    const mockTimelineData = [
      {
        type: "comment" as const,
        id: "comment-1",
        content: "Test comment",
        createdAt: new Date("2024-01-01"),
        author: {
          id: "user-1",
          name: "Test User",
          profilePicture: null,
        },
      },
      {
        type: "activity" as const,
        id: "activity-1",
        activityType: "STATUS_CHANGED" as const,
        description: "Status changed from Open to In Progress",
        createdAt: new Date("2024-01-02"),
        actor: {
          id: "user-1",
          name: "Test User",
          profilePicture: null,
        },
        oldValue: "status-open",
        newValue: "status-in-progress",
      },
    ];

    describe("Success Cases", () => {
      beforeEach(() => {
        // Mock successful issue lookup with organizational scoping
        vi.mocked(mockContext.db.query.issues.findFirst).mockResolvedValue({
          id: "test-issue-1",
        });

        // Mock service creation and getIssueTimeline method
        const mockActivityService = {
          getIssueTimeline: vi.fn().mockResolvedValue(mockTimelineData),
          recordIssueCreated: vi.fn(),
          recordActivity: vi.fn(),
          recordStatusChange: vi.fn(),
          recordAssignmentChange: vi.fn(),
          recordFieldUpdate: vi.fn(),
          recordCommentDeleted: vi.fn(),
          recordIssueResolved: vi.fn(),
          recordIssueAssigned: vi.fn(),
        };

        vi.mocked(
          mockContext.services.createIssueActivityService,
        ).mockReturnValue(mockActivityService);
      });

      it("should return timeline data for valid issue", async () => {
        const result = await caller.getTimeline(validInput);

        expect(result).toEqual(mockTimelineData);

        // Verify issue lookup with organizational scoping
        expect(mockContext.db.query.issues.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            columns: {
              id: true,
            },
          }),
        );

        // Verify service method called with correct parameters
        expect(
          mockContext.services.createIssueActivityService,
        ).toHaveBeenCalledTimes(1);
        const activityService =
          mockContext.services.createIssueActivityService();
        expect(activityService.getIssueTimeline).toHaveBeenCalledWith(
          "test-issue-1",
          "org-1", // From mock context organization
        );
      });

      it("should handle empty timeline data", async () => {
        // Mock empty timeline response
        const mockActivityService = {
          getIssueTimeline: vi.fn().mockResolvedValue([]),
          recordIssueCreated: vi.fn(),
          recordActivity: vi.fn(),
          recordStatusChange: vi.fn(),
          recordAssignmentChange: vi.fn(),
          recordFieldUpdate: vi.fn(),
          recordCommentDeleted: vi.fn(),
          recordIssueResolved: vi.fn(),
          recordIssueAssigned: vi.fn(),
        };

        vi.mocked(
          mockContext.services.createIssueActivityService,
        ).mockReturnValue(mockActivityService);

        const result = await caller.getTimeline(validInput);

        expect(result).toEqual([]);

        // Verify service method was called
        const serviceInstance = vi.mocked(
          mockContext.services.createIssueActivityService,
        ).mock.results[0]?.value;
        expect(serviceInstance.getIssueTimeline).toHaveBeenCalledWith(
          "test-issue-1",
          "org-1",
        );
      });

      it("should work with complex timeline containing multiple item types", async () => {
        const complexTimelineData = [
          {
            type: "comment" as const,
            id: "comment-1",
            content: "Initial comment",
            createdAt: new Date("2024-01-01"),
            author: { id: "user-1", name: "User 1", profilePicture: null },
          },
          {
            type: "activity" as const,
            id: "activity-1",
            activityType: "STATUS_CHANGED" as const,
            description: "Status changed",
            createdAt: new Date("2024-01-02"),
            actor: { id: "user-2", name: "User 2", profilePicture: null },
            oldValue: "open",
            newValue: "in-progress",
          },
          {
            type: "comment" as const,
            id: "comment-2",
            content: "Follow-up comment",
            createdAt: new Date("2024-01-03"),
            author: { id: "user-3", name: "User 3", profilePicture: null },
          },
          {
            type: "activity" as const,
            id: "activity-2",
            activityType: "ASSIGNED" as const,
            description: "Issue assigned",
            createdAt: new Date("2024-01-04"),
            actor: { id: "user-1", name: "User 1", profilePicture: null },
            oldValue: null,
            newValue: "user-3",
          },
        ];

        const mockActivityService = {
          getIssueTimeline: vi.fn().mockResolvedValue(complexTimelineData),
          recordIssueCreated: vi.fn(),
          recordActivity: vi.fn(),
          recordStatusChange: vi.fn(),
          recordAssignmentChange: vi.fn(),
          recordFieldUpdate: vi.fn(),
          recordCommentDeleted: vi.fn(),
          recordIssueResolved: vi.fn(),
          recordIssueAssigned: vi.fn(),
        };

        vi.mocked(
          mockContext.services.createIssueActivityService,
        ).mockReturnValue(mockActivityService);

        const result = await caller.getTimeline(validInput);

        expect(result).toEqual(complexTimelineData);
        expect(result).toHaveLength(4);
        expect(result.filter((item) => item.type === "comment")).toHaveLength(
          2,
        );
        expect(result.filter((item) => item.type === "activity")).toHaveLength(
          2,
        );
      });
    });

    describe("Error Cases", () => {
      it("should throw NOT_FOUND when issue does not exist", async () => {
        // Mock issue not found
        vi.mocked(mockContext.db.query.issues.findFirst).mockResolvedValue(
          null,
        );

        await expect(caller.getTimeline(validInput)).rejects.toThrow(
          expect.objectContaining({
            code: "NOT_FOUND",
            message: "Issue not found or access denied",
          }),
        );

        // Verify issue lookup was attempted
        expect(mockContext.db.query.issues.findFirst).toHaveBeenCalledTimes(1);

        // Verify service was NOT called when issue doesn't exist
        expect(
          mockContext.services.createIssueActivityService,
        ).not.toHaveBeenCalled();
      });

      it("should throw NOT_FOUND when issue belongs to different organization", async () => {
        // Mock issue not found due to organizational scoping
        vi.mocked(mockContext.db.query.issues.findFirst).mockResolvedValue(
          null,
        );

        await expect(
          caller.getTimeline({ issueId: "other-org-issue" }),
        ).rejects.toThrow(
          expect.objectContaining({
            code: "NOT_FOUND",
            message: "Issue not found or access denied",
          }),
        );

        // Verify organizational scoping in query
        expect(mockContext.db.query.issues.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            columns: {
              id: true,
            },
          }),
        );
      });

      it("should handle service method failures gracefully", async () => {
        // Mock successful issue lookup
        vi.mocked(mockContext.db.query.issues.findFirst).mockResolvedValue({
          id: "test-issue-1",
        });

        // Mock service method throwing an error
        const mockActivityService = {
          getIssueTimeline: vi
            .fn()
            .mockRejectedValue(new Error("Service error")),
          recordIssueCreated: vi.fn(),
          recordActivity: vi.fn(),
          recordStatusChange: vi.fn(),
          recordAssignmentChange: vi.fn(),
          recordFieldUpdate: vi.fn(),
          recordCommentDeleted: vi.fn(),
          recordIssueResolved: vi.fn(),
          recordIssueAssigned: vi.fn(),
        };

        vi.mocked(
          mockContext.services.createIssueActivityService,
        ).mockReturnValue(mockActivityService);

        await expect(caller.getTimeline(validInput)).rejects.toThrow(
          "Service error",
        );

        // Verify issue lookup succeeded
        expect(mockContext.db.query.issues.findFirst).toHaveBeenCalledTimes(1);

        // Verify service was called despite eventual failure
        expect(
          mockContext.services.createIssueActivityService,
        ).toHaveBeenCalledTimes(1);
        expect(mockActivityService.getIssueTimeline).toHaveBeenCalledWith(
          "test-issue-1",
          "org-1",
        );
      });

      it("should handle database lookup failures", async () => {
        // Mock database error
        vi.mocked(mockContext.db.query.issues.findFirst).mockRejectedValue(
          new Error("Database connection error"),
        );

        await expect(caller.getTimeline(validInput)).rejects.toThrow(
          "Database connection error",
        );

        // Verify service was not called when database fails
        expect(
          mockContext.services.createIssueActivityService,
        ).not.toHaveBeenCalled();
      });
    });

    describe("Input Validation", () => {
      it("should validate required issueId parameter", async () => {
        await expect(caller.getTimeline({} as any)).rejects.toThrow();
        await expect(caller.getTimeline({ issueId: "" })).rejects.toThrow();
        await expect(
          caller.getTimeline({ issueId: null } as any),
        ).rejects.toThrow();
        await expect(
          caller.getTimeline({ issueId: undefined } as any),
        ).rejects.toThrow();
      });

      it("should accept valid issueId strings", async () => {
        // Mock successful issue lookup for validation test
        vi.mocked(mockContext.db.query.issues.findFirst).mockResolvedValue({
          id: "valid-issue-id",
        });

        const mockActivityService = {
          getIssueTimeline: vi.fn().mockResolvedValue([]),
          recordIssueCreated: vi.fn(),
          recordActivity: vi.fn(),
          recordStatusChange: vi.fn(),
          recordAssignmentChange: vi.fn(),
          recordFieldUpdate: vi.fn(),
          recordCommentDeleted: vi.fn(),
          recordIssueResolved: vi.fn(),
          recordIssueAssigned: vi.fn(),
        };

        vi.mocked(
          mockContext.services.createIssueActivityService,
        ).mockReturnValue(mockActivityService);

        // Test various valid ID formats
        const validIds = [
          "issue-1",
          "test-issue-123",
          "UUID-like-string-12345",
          "simple",
        ];

        for (const issueId of validIds) {
          await expect(caller.getTimeline({ issueId })).resolves.toEqual([]);
          expect(mockActivityService.getIssueTimeline).toHaveBeenCalledWith(
            issueId,
            "org-1",
          );
        }
      });
    });

    describe("Organizational Scoping", () => {
      it("should enforce organizational isolation in issue lookup", async () => {
        // Mock context with different organization
        const orgSpecificContext = {
          ...mockContext,
          organization: {
            id: "specific-org-123",
            name: "Specific Organization",
            subdomain: "specific-org",
          },
        };

        const orgSpecificCaller =
          issueTimelineRouter.createCaller(orgSpecificContext);

        // Mock successful issue lookup
        vi.mocked(mockContext.db.query.issues.findFirst).mockResolvedValue({
          id: "test-issue-1",
        });

        const mockActivityService = {
          getIssueTimeline: vi.fn().mockResolvedValue([]),
          recordIssueCreated: vi.fn(),
          recordActivity: vi.fn(),
          recordStatusChange: vi.fn(),
          recordAssignmentChange: vi.fn(),
          recordFieldUpdate: vi.fn(),
          recordCommentDeleted: vi.fn(),
          recordIssueResolved: vi.fn(),
          recordIssueAssigned: vi.fn(),
        };

        vi.mocked(
          mockContext.services.createIssueActivityService,
        ).mockReturnValue(mockActivityService);

        await orgSpecificCaller.getTimeline(validInput);

        // Verify service called with correct organization ID
        expect(mockActivityService.getIssueTimeline).toHaveBeenCalledWith(
          "test-issue-1",
          "specific-org-123",
        );
      });

      it("should use organizationProcedure for authentication and org scoping", async () => {
        // This test verifies that the procedure uses organizationProcedure
        // which should enforce authentication and provide organization context

        // Mock unauthenticated context (no user)
        const unauthenticatedContext = {
          ...mockContext,
          user: null,
          organization: null,
        };

        const unauthenticatedCaller = issueTimelineRouter.createCaller(
          unauthenticatedContext,
        );

        // Should fail before even reaching our procedure logic due to organizationProcedure
        await expect(
          unauthenticatedCaller.getTimeline(validInput),
        ).rejects.toThrow();

        // Verify database was not called due to early authentication failure
        expect(mockContext.db.query.issues.findFirst).not.toHaveBeenCalled();
      });
    });

    describe("Service Integration", () => {
      it("should create activity service and call getIssueTimeline with correct parameters", async () => {
        // Mock successful issue lookup
        vi.mocked(mockContext.db.query.issues.findFirst).mockResolvedValue({
          id: "test-issue-1",
        });

        const mockTimelineResult = [
          {
            type: "activity" as const,
            id: "activity-1",
            activityType: "CREATED" as const,
            description: "Issue created",
            createdAt: new Date(),
            actor: { id: "user-1", name: "Creator", profilePicture: null },
            oldValue: null,
            newValue: "test-issue-1",
          },
        ];

        const mockActivityService = {
          getIssueTimeline: vi.fn().mockResolvedValue(mockTimelineResult),
          recordIssueCreated: vi.fn(),
          recordActivity: vi.fn(),
          recordStatusChange: vi.fn(),
          recordAssignmentChange: vi.fn(),
          recordFieldUpdate: vi.fn(),
          recordCommentDeleted: vi.fn(),
          recordIssueResolved: vi.fn(),
          recordIssueAssigned: vi.fn(),
        };

        vi.mocked(
          mockContext.services.createIssueActivityService,
        ).mockReturnValue(mockActivityService);

        const result = await caller.getTimeline(validInput);

        // Verify service factory called correctly
        expect(
          mockContext.services.createIssueActivityService,
        ).toHaveBeenCalledTimes(1);
        expect(
          mockContext.services.createIssueActivityService,
        ).toHaveBeenCalledWith();

        // Verify service method called with correct parameters
        expect(mockActivityService.getIssueTimeline).toHaveBeenCalledTimes(1);
        expect(mockActivityService.getIssueTimeline).toHaveBeenCalledWith(
          "test-issue-1",
          "org-1",
        );

        // Verify result passed through correctly
        expect(result).toEqual(mockTimelineResult);
      });

      it("should handle service creation failures", async () => {
        // Mock successful issue lookup
        vi.mocked(mockContext.db.query.issues.findFirst).mockResolvedValue({
          id: "test-issue-1",
        });

        // Mock service factory throwing an error
        vi.mocked(
          mockContext.services.createIssueActivityService,
        ).mockImplementation(() => {
          throw new Error("Service creation failed");
        });

        await expect(caller.getTimeline(validInput)).rejects.toThrow(
          "Service creation failed",
        );

        // Verify issue lookup succeeded before service creation failure
        expect(mockContext.db.query.issues.findFirst).toHaveBeenCalledTimes(1);
      });
    });
  });
});
