import { describe, test, expect, beforeEach, vi } from "vitest";
import { appRouter } from "~/server/api/root";
import { createMockTRPCContext } from "~/test/vitestMockContext";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createMockMembership } from "~/test/factories/mockDataFactory";

// Mock the permission system
vi.mock("~/server/auth/permissions", () => ({
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
  hasPermission: vi.fn().mockResolvedValue(true),
  getUserPermissionsForSupabaseUser: vi.fn().mockResolvedValue(["issue:view"]),
  supabaseUserToSession: vi
    .fn()
    .mockReturnValue({ user: { id: "mock-user-id" } }),
}));

describe("Issue Timeline Router", () => {
  let mockContext: ReturnType<typeof createMockTRPCContext>;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    mockContext = createMockTRPCContext();
    caller = appRouter.createCaller(mockContext);

    // Mock dependencies for the orgScopedProcedure
    vi.mocked(mockContext.db.query.memberships.findFirst).mockResolvedValue(
      createMockMembership(),
    );
  });

  describe("getTimeline procedure", () => {
    test("should return timeline data for a valid issue", async () => {
      // Arrange
      const issueId = SEED_TEST_IDS.ISSUES.KAIJU_FIGURES;
      const mockTimelineData = [
        { type: "comment", id: "comment-1", content: "A comment" },
        { type: "activity", id: "activity-1", description: "Status changed" },
      ];
      const mockIssueActivityService = {
        getIssueTimeline: vi.fn().mockResolvedValue(mockTimelineData),
      };
      vi.mocked(
        mockContext.services.createIssueActivityService,
      ).mockReturnValue(mockIssueActivityService as any);

      // Mock the db.select call
      const mockIssueSelect = {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([{ id: issueId }]) }),
        }),
      };
      vi.mocked(mockContext.db.select).mockReturnValue(mockIssueSelect as any);

      // Act
      const result = await caller.issue.timeline.getTimeline({ issueId });

      // Assert
      expect(result).toEqual(mockTimelineData);
      expect(mockContext.db.select).toHaveBeenCalledOnce();
      expect(
        mockContext.services.createIssueActivityService,
      ).toHaveBeenCalledOnce();
      expect(mockIssueActivityService.getIssueTimeline).toHaveBeenCalledWith(
        issueId,
      );
    });

    test("should throw NOT_FOUND if issue does not exist", async () => {
      // Arrange
      const mockIssueSelect = {
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      };
      vi.mocked(mockContext.db.select).mockReturnValue(mockIssueSelect as any);

      // Act & Assert
      await expect(
        caller.issue.timeline.getTimeline({
          issueId: "non-existent-issue",
        }),
      ).rejects.toThrow("Issue not found or access denied");
    });

    test("should handle empty timeline data", async () => {
      // Arrange
      const issueId = SEED_TEST_IDS.ISSUES.KAIJU_FIGURES;
      const mockIssueActivityService = {
        getIssueTimeline: vi.fn().mockResolvedValue([]), // Return empty array
      };
      vi.mocked(
        mockContext.services.createIssueActivityService,
      ).mockReturnValue(mockIssueActivityService as any);

      const mockIssueSelect = {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([{ id: issueId }]) }),
        }),
      };
      vi.mocked(mockContext.db.select).mockReturnValue(mockIssueSelect as any);

      // Act
      const result = await caller.issue.timeline.getTimeline({ issueId });

      // Assert
      expect(result).toEqual([]);
    });
  });
});
