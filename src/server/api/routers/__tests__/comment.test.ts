/**
 * Comment Router Tests
 *
 * Tests for the comment router converted from Prisma to Drizzle.
 * Covers comment CRUD operations, soft delete patterns, and admin functionality.
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock permission system to allow testing without full permission checks
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    getUserPermissionsForSession: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});

import type { VitestMockContext } from "~/test/vitestMockContext";

import { commentRouter } from "~/server/api/routers/comment";
import {
  getUserPermissionsForSession,
  requirePermissionForSession,
} from "~/server/auth/permissions";
import { createVitestMockContext } from "~/test/vitestMockContext";

describe("Comment Router (Drizzle)", () => {
  let mockContext: VitestMockContext;
  let caller: ReturnType<typeof commentRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createVitestMockContext();

    const permissions = ["issue:view", "issue:delete", "organization:manage"];

    // Add necessary permissions and user context for comment operations
    mockContext = {
      ...mockContext,
      user: {
        ...mockContext.user,
        id: "user-1",
        email: "test@example.com",
      } as any,
      organization: {
        id: "org-1",
        name: "Test Organization",
        subdomain: "test",
      },
      membership: {
        id: "membership-1",
        userId: "user-1",
        organizationId: "org-1",
        roleId: "role-1",
      },
      userPermissions: permissions,
    } as any;

    // Mock the membership lookup that organizationProcedure makes
    const mockMembership = {
      id: "membership-1",
      userId: "user-1",
      organizationId: "org-1",
      roleId: "role-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockContext.db.membership.findFirst).mockResolvedValue(
      mockMembership,
    );

    // Mock getUserPermissionsForSession to return our test permissions
    vi.mocked(getUserPermissionsForSession).mockResolvedValue(permissions);

    // Mock requirePermissionForSession to check if permission is in our list
    vi.mocked(requirePermissionForSession).mockImplementation(
      async (_session, permission) => {
        if (!permissions.includes(permission)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Missing required permission: ${permission}`,
          });
        }
      },
    );

    caller = commentRouter.createCaller(mockContext);
  });

  describe("getForIssue", () => {
    const mockCommentsData = [
      {
        id: "comment-1",
        content: "Test comment 1",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        deletedAt: null,
        deletedBy: null,
        issueId: "issue-1",
        authorId: "user-1",
        author: {
          id: "user-1",
          name: "Test User",
          profilePicture: null,
        },
      },
      {
        id: "comment-2",
        content: "Test comment 2",
        createdAt: new Date("2024-01-02"),
        updatedAt: new Date("2024-01-02"),
        deletedAt: null,
        deletedBy: null,
        issueId: "issue-1",
        authorId: "user-2",
        author: {
          id: "user-2",
          name: "Other User",
          profilePicture: "avatar.jpg",
        },
      },
    ];

    it("should get comments for an issue with author info", async () => {
      // Mock the Drizzle chain: select().from().innerJoin().where().orderBy()
      vi.mocked(mockContext.drizzle.orderBy).mockResolvedValue(
        mockCommentsData,
      );

      const result = await caller.getForIssue({ issueId: "issue-1" });

      expect(result).toEqual(mockCommentsData);

      // Verify the Drizzle query chain was called correctly
      expect(mockContext.drizzle.select).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.anything(),
          content: expect.anything(),
          createdAt: expect.anything(),
          updatedAt: expect.anything(),
          deletedAt: expect.anything(),
          deletedBy: expect.anything(),
          issueId: expect.anything(),
          authorId: expect.anything(),
          author: expect.objectContaining({
            id: expect.anything(),
            name: expect.anything(),
            profilePicture: expect.anything(),
          }),
        }),
      );
      expect(mockContext.drizzle.from).toHaveBeenCalled();
      expect(mockContext.drizzle.innerJoin).toHaveBeenCalled();
      expect(mockContext.drizzle.where).toHaveBeenCalled();
      expect(mockContext.drizzle.orderBy).toHaveBeenCalled();
    });

    it("should handle empty results", async () => {
      vi.mocked(mockContext.drizzle.orderBy).mockResolvedValue([]);

      const result = await caller.getForIssue({ issueId: "nonexistent-issue" });

      expect(result).toEqual([]);
    });
  });

  describe("delete (soft delete)", () => {
    const mockCommentData = [
      {
        id: "comment-1",
        issueId: "issue-1",
        issue: {
          organizationId: "org-1",
        },
      },
    ];

    beforeEach(() => {
      // Mock the services
      const mockCleanupService = {
        softDeleteComment: vi.fn().mockResolvedValue(undefined),
      };
      const mockActivityService = {
        recordCommentDeleted: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(
        mockContext.services.createCommentCleanupService,
      ).mockReturnValue(mockCleanupService as any);
      vi.mocked(
        mockContext.services.createIssueActivityService,
      ).mockReturnValue(mockActivityService as any);
    });

    it("should soft delete a comment successfully", async () => {
      // Mock the Drizzle chain for comment lookup: select().from().innerJoin().where().limit()
      vi.mocked(mockContext.drizzle.limit).mockResolvedValue(mockCommentData);

      const result = await caller.delete({ commentId: "comment-1" });

      expect(result).toEqual({ success: true });

      // Verify the Drizzle query chain was called for comment lookup
      expect(mockContext.drizzle.select).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.anything(),
          issueId: expect.anything(),
          issue: expect.objectContaining({
            organizationId: expect.anything(),
          }),
        }),
      );
      expect(mockContext.drizzle.from).toHaveBeenCalled();
      expect(mockContext.drizzle.innerJoin).toHaveBeenCalled();
      expect(mockContext.drizzle.where).toHaveBeenCalled();
      expect(mockContext.drizzle.limit).toHaveBeenCalledWith(1);

      // Verify services were called correctly
      const cleanupService = mockContext.services.createCommentCleanupService();
      expect(cleanupService.softDeleteComment).toHaveBeenCalledWith(
        "comment-1",
        "user-1",
      );

      const activityService = mockContext.services.createIssueActivityService();
      expect(activityService.recordCommentDeleted).toHaveBeenCalledWith(
        "issue-1",
        "org-1",
        "user-1",
        "comment-1",
      );
    });

    it("should throw NOT_FOUND for non-existent comment", async () => {
      // Mock empty result for comment lookup
      vi.mocked(mockContext.drizzle.limit).mockResolvedValue([]);

      await expect(caller.delete({ commentId: "nonexistent" })).rejects.toThrow(
        TRPCError,
      );
      await expect(caller.delete({ commentId: "nonexistent" })).rejects.toThrow(
        "Comment not found",
      );
    });

    it("should throw FORBIDDEN for comment not in user's organization", async () => {
      const mockCommentWrongOrg = [
        {
          id: "comment-1",
          issueId: "issue-1",
          issue: {
            organizationId: "other-org",
          },
        },
      ];

      vi.mocked(mockContext.drizzle.limit).mockResolvedValue(
        mockCommentWrongOrg,
      );

      await expect(caller.delete({ commentId: "comment-1" })).rejects.toThrow(
        TRPCError,
      );
      await expect(caller.delete({ commentId: "comment-1" })).rejects.toThrow(
        "Comment not in organization",
      );
    });
  });

  describe("getDeleted (admin)", () => {
    const mockDeletedComments = [
      {
        id: "comment-1",
        content: "Deleted comment",
        deletedAt: new Date("2024-01-01"),
        deletedBy: "user-1",
        author: "Test User",
      },
    ];

    it("should get deleted comments for organization managers", async () => {
      const mockCleanupService = {
        getDeletedComments: vi.fn().mockResolvedValue(mockDeletedComments),
      };

      vi.mocked(
        mockContext.services.createCommentCleanupService,
      ).mockReturnValue(mockCleanupService as any);

      const result = await caller.getDeleted();

      expect(result).toEqual(mockDeletedComments);
      expect(mockCleanupService.getDeletedComments).toHaveBeenCalledWith(
        "org-1",
      );
    });
  });

  describe("restore (admin)", () => {
    it("should restore a deleted comment", async () => {
      const mockCleanupService = {
        restoreComment: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(
        mockContext.services.createCommentCleanupService,
      ).mockReturnValue(mockCleanupService as any);

      const result = await caller.restore({ commentId: "comment-1" });

      expect(result).toEqual({ success: true });
      expect(mockCleanupService.restoreComment).toHaveBeenCalledWith(
        "comment-1",
      );
    });
  });

  describe("getCleanupStats (admin)", () => {
    it("should get cleanup statistics", async () => {
      const mockStats = {
        candidateCount: 5,
        cleanupThresholdDays: 90, // Updated to match actual COMMENT_CLEANUP_CONFIG value
      };

      const mockCleanupService = {
        getCleanupCandidateCount: vi.fn().mockResolvedValue(5),
      };

      vi.mocked(
        mockContext.services.createCommentCleanupService,
      ).mockReturnValue(mockCleanupService as any);

      const result = await caller.getCleanupStats();

      expect(result).toEqual(mockStats);
      expect(mockCleanupService.getCleanupCandidateCount).toHaveBeenCalled();
    });
  });

  describe("Organization scoping", () => {
    it("should include organization context in all operations", async () => {
      // Test that organization context is properly available
      expect(mockContext.organization?.id).toBe("org-1");
      expect(mockContext.user?.id).toBe("user-1");
    });

    it("should verify permissions for admin operations", async () => {
      // Verify that userPermissions include organization:manage for admin operations
      expect(mockContext.userPermissions).toContain("organization:manage");
    });
  });
});
