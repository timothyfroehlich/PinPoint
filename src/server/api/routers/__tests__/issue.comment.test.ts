import { describe, test, expect, beforeEach, vi } from "vitest";
import { appRouter } from "~/server/api/root";
import { createMockTRPCContext } from "~/test/vitestMockContext";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createMockMembership } from "~/test/factories/mockDataFactory";

// Mock the permission system to avoid complexities in this router test
vi.mock("~/server/auth/permissions", () => ({
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
  hasPermission: vi.fn().mockResolvedValue(true),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue(["issue:view", "comment:create"]),
  supabaseUserToSession: vi
    .fn()
    .mockReturnValue({ user: { id: "mock-user-id" } }),
}));

describe("Issue Comment Router", () => {
  let mockContext: ReturnType<typeof createMockTRPCContext>;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    mockContext = createMockTRPCContext();
    caller = appRouter.createCaller(mockContext);
  });

  describe("addComment procedure", () => {
    test("should add a comment to an issue successfully", async () => {
      // Arrange
      const issueId = SEED_TEST_IDS.ISSUES.KAIJU_FIGURES;
      const commentContent = "This is a test comment.";
      const mockIssue = { id: issueId };
      const mockMembership = createMockMembership();
      const mockCommentWithAuthor = {
        id: "new-comment-id",
        content: commentContent,
        issueId,
        authorId: SEED_TEST_IDS.USERS.ADMIN,
        author: { id: SEED_TEST_IDS.USERS.ADMIN, name: "Test User" },
      };

      // Mock the db.query API for the organizationProcedure
      vi.mocked(mockContext.db.query.memberships.findFirst).mockResolvedValue(
        mockMembership,
      );

      // Mock the db.select chain for createCommentWithAuthor
      const mockIssueSelect = {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([mockIssue]) }),
        }),
      };
      const mockMembershipSelect = {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([mockMembership]) }),
        }),
      };
      const mockCommentSelect = {
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([mockCommentWithAuthor]),
            }),
          }),
        }),
      };

      vi.mocked(mockContext.db.select)
        .mockReturnValueOnce(mockIssueSelect as any)
        .mockReturnValueOnce(mockMembershipSelect as any)
        .mockReturnValueOnce(mockCommentSelect as any);

      // Act
      const result = await caller.issue.comment.addComment({
        issueId,
        content: commentContent,
      });

      // Assert
      expect(result.content).toBe(commentContent);
      expect(result.issueId).toBe(issueId);
      expect(result.authorId).toBe(SEED_TEST_IDS.USERS.ADMIN);
    });

    test("should throw an error if the issue is not found", async () => {
      // Arrange
      vi.mocked(mockContext.db.query.memberships.findFirst).mockResolvedValue(
        createMockMembership(),
      );
      const mockIssueSelect = {
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      };
      vi.mocked(mockContext.db.select).mockReturnValue(mockIssueSelect as any);

      // Act & Assert
      await expect(
        caller.issue.comment.addComment({
          issueId: "non-existent-issue",
          content: "This should fail",
        }),
      ).rejects.toThrow("Issue not found");
    });

    test("should throw an error for empty comment content", async () => {
      // Arrange
      vi.mocked(mockContext.db.query.memberships.findFirst).mockResolvedValue(
        createMockMembership(),
      );

      // Act & Assert
      await expect(
        caller.issue.comment.addComment({
          issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
          content: "",
        }),
      ).rejects.toThrow();
    });
  });
});
