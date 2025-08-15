/**
 * Issue Comment Router Tests (Unit)
 *
 * Unit tests for the issue.comment router using Vitest mock context.
 * Tests router logic with mocked dependencies for faster execution.
 *
 * Key Features:
 * - Fast unit tests with mocked dependencies
 * - Mock Drizzle ORM operations
 * - Permission-based access control validation
 * - Input validation testing
 * - Error condition testing
 *
 * Covers all procedures:
 * - addComment: Members/admins can add comments to issues
 * - create: Alias for addComment (backward compatibility)
 * - editComment: Authors can edit their own comments
 * - deleteComment: Authors can delete own, admins can delete any
 * - restoreComment: Admins can restore deleted comments
 * - getDeletedComments: Admins can view all deleted comments
 *
 * Uses modern August 2025 patterns with Vitest and mock context.
 */

 

import { beforeEach, describe, expect, it, vi } from "vitest";

// Import test setup and utilities
import { appRouter } from "~/server/api/root";
import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";

// Mock NextAuth first to avoid import issues
vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock external dependencies
vi.mock("~/lib/utils/id-generation", () => ({
  generatePrefixedId: vi.fn((prefix: string) => `${prefix}-test-${Date.now()}`),
}));

// Mock permissions to avoid complex permission middleware
vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "issue:view",
      "issue:create",
      "issue:edit",
      "issue:delete",
      "organization:manage",
    ]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue([
      "issue:view",
      "issue:create",
      "issue:edit",
      "issue:delete",
      "organization:manage",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
  hasPermission: vi.fn().mockResolvedValue(true),
}));

// Mock services
vi.mock("~/server/services/types", () => ({
  ActivityType: {
    COMMENT_DELETED: "COMMENT_DELETED",
  },
}));

describe("Issue Comment Router", () => {
  let ctx: VitestMockContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createVitestMockContext();

    // Set up authenticated user with organization
    ctx.user = {
      id: "user-1",
      email: "test@example.com",
      user_metadata: { name: "Test User" },
      app_metadata: { organization_id: "org-1" },
    } as any;

    ctx.organization = {
      id: "org-1",
      name: "Test Organization",
      subdomain: "test",
    };

    // Mock membership with role and permissions for organizationProcedure
    const mockMembership = {
      id: "membership-1",
      userId: "user-1",
      organizationId: "org-1",
      roleId: "role-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: {
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      },
    };

    ctx.membership = mockMembership;

    // Mock the database membership lookup that organizationProcedure expects
    // Mock membership lookup for organizationProcedure
    const membershipSelectQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMembership]),
    };
    vi.mocked(ctx.db.select).mockReturnValue(membershipSelectQuery);

    // Set up user permissions for different test scenarios
    ctx.userPermissions = [
      "issue:view",
      "issue:create",
      "issue:edit",
      "issue:delete",
      "organization:manage",
    ];
  });

  describe("addComment", () => {
    it("should add a comment with proper validation", async () => {
      // Mock the Drizzle query chain for issue verification
      const issueSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "issue-1",
            organizationId: "org-1",
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueSelectQuery);

      // Mock the membership query chain
      const membershipSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "membership-1",
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(membershipSelectQuery);

      // Mock the comment insert
      const insertQuery = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "comment-test-123",
            content: "Test comment",
            createdAt: new Date(),
            updatedAt: null,
            issueId: "issue-1",
            authorId: "user-1",
          },
        ]),
      };
      vi.mocked(ctx.db.insert).mockReturnValueOnce(insertQuery);

      // Mock the comment with author query
      const commentWithAuthorQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "comment-test-123",
            content: "Test comment",
            createdAt: new Date(),
            updatedAt: null,
            issueId: "issue-1",
            authorId: "user-1",
            author: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              image: null,
            },
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(commentWithAuthorQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.comment.addComment({
        issueId: "issue-1",
        content: "Test comment",
      });

      expect(result).toMatchObject({
        id: "comment-test-123",
        content: "Test comment",
        issueId: "issue-1",
        authorId: "user-1",
        author: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
        },
      });

      // Verify the issue query was called with proper organization scoping
      expect(issueSelectQuery.where).toHaveBeenCalled();
      expect(insertQuery.values).toHaveBeenCalledWith({
        id: expect.stringMatching(/^comment-test-/),
        content: "Test comment",
        issueId: "issue-1",
        authorId: "user-1",
      });
    });

    it("should validate content length", async () => {
      const caller = appRouter.createCaller(ctx as any);

      // Test empty content
      await expect(
        caller.issue.comment.addComment({
          issueId: "issue-1",
          content: "",
        }),
      ).rejects.toThrow();

      // Test content too long
      const longContent = "a".repeat(1001);
      await expect(
        caller.issue.comment.addComment({
          issueId: "issue-1",
          content: longContent,
        }),
      ).rejects.toThrow();
    });

    it("should reject comment on non-existent issue", async () => {
      // Mock empty issue query result
      const issueSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No issue found
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueSelectQuery);

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.issue.comment.addComment({
          issueId: "non-existent-issue",
          content: "This should fail",
        }),
      ).rejects.toThrow("Issue not found");
    });

    it("should reject comment from non-member", async () => {
      // Mock the issue query to succeed
      const issueSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "issue-1",
            organizationId: "org-1",
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueSelectQuery);

      // Mock the membership query to fail (no membership found)
      const membershipSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No membership found
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(membershipSelectQuery);

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.issue.comment.addComment({
          issueId: "issue-1",
          content: "This should fail",
        }),
      ).rejects.toThrow("User is not a member of this organization");
    });
  });

  describe("create (alias)", () => {
    it("should work identically to addComment", async () => {
      // Set up the same mocks as addComment test
      const issueSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "issue-1",
            organizationId: "org-1",
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueSelectQuery);

      const membershipSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "membership-1",
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(membershipSelectQuery);

      const insertQuery = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "comment-test-123",
            content: "Test comment via create",
            createdAt: new Date(),
            updatedAt: null,
            issueId: "issue-1",
            authorId: "user-1",
          },
        ]),
      };
      vi.mocked(ctx.db.insert).mockReturnValueOnce(insertQuery);

      const commentWithAuthorQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "comment-test-123",
            content: "Test comment via create",
            createdAt: new Date(),
            updatedAt: null,
            issueId: "issue-1",
            authorId: "user-1",
            author: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              image: null,
            },
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(commentWithAuthorQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.comment.create({
        issueId: "issue-1",
        content: "Test comment via create",
      });

      expect(result).toMatchObject({
        id: "comment-test-123",
        content: "Test comment via create",
        issueId: "issue-1",
        authorId: "user-1",
      });
    });
  });

  describe("editComment", () => {
    it("should allow author to edit their own comment", async () => {
      // Mock the comment lookup query
      const commentSelectQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            authorId: "user-1",
            deletedAt: null,
            issue: {
              id: "issue-1",
              organizationId: "org-1",
            },
            author: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              image: null,
            },
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(commentSelectQuery);

      // Mock the update query
      const updateQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            content: "Updated content",
            createdAt: new Date(),
            updatedAt: new Date(),
            issueId: "issue-1",
            authorId: "user-1",
          },
        ]),
      };
      vi.mocked(ctx.db.update).mockReturnValueOnce(updateQuery);

      // Mock the final comment with author query
      const finalCommentQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            content: "Updated content",
            createdAt: new Date(),
            updatedAt: new Date(),
            issueId: "issue-1",
            authorId: "user-1",
            author: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              image: null,
            },
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(finalCommentQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.comment.editComment({
        commentId: "comment-1",
        content: "Updated content",
      });

      expect(result).toMatchObject({
        id: "comment-1",
        content: "Updated content",
        authorId: "user-1",
        author: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
        },
      });

      expect(updateQuery.set).toHaveBeenCalledWith({
        content: "Updated content",
      });
    });

    it("should reject edit by non-author", async () => {
      // Mock comment owned by different user
      const commentSelectQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            authorId: "other-user", // Different from "user-1"
            deletedAt: null,
            issue: {
              id: "issue-1",
              organizationId: "org-1",
            },
            author: {
              id: "other-user",
              name: "Other User",
              email: "other@example.com",
              image: null,
            },
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(commentSelectQuery);

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.issue.comment.editComment({
          commentId: "comment-1",
          content: "Should fail",
        }),
      ).rejects.toThrow("You can only edit your own comments");
    });

    it("should reject edit of deleted comment", async () => {
      // Mock deleted comment
      const commentSelectQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            authorId: "user-1",
            deletedAt: new Date(), // Comment is deleted
            issue: {
              id: "issue-1",
              organizationId: "org-1",
            },
            author: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              image: null,
            },
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(commentSelectQuery);

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.issue.comment.editComment({
          commentId: "comment-1",
          content: "Should fail",
        }),
      ).rejects.toThrow("Cannot edit deleted comment");
    });
  });

  describe("deleteComment", () => {
    it("should allow user to delete their own comment", async () => {
      // Mock comment lookup
      const commentSelectQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            authorId: "user-1",
            deletedAt: null,
            issue: {
              id: "issue-1",
              organizationId: "org-1",
            },
            author: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              image: null,
            },
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(commentSelectQuery);

      // Mock membership lookup
      const membershipSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "membership-1",
            userId: "user-1",
            organizationId: "org-1",
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(membershipSelectQuery);

      // Mock the update for soft delete
      const updateQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            content: "Test comment",
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: new Date(),
            deletedBy: "user-1",
            issueId: "issue-1",
            authorId: "user-1",
          },
        ]),
      };
      vi.mocked(ctx.db.update).mockReturnValueOnce(updateQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.comment.deleteComment({
        commentId: "comment-1",
      });

      expect(result).toMatchObject({
        id: "comment-1",
        deletedAt: expect.any(Date),
        deletedBy: "user-1",
      });

      // Verify service was called to create activity
      expect(ctx.services.createIssueActivityService).toHaveBeenCalled();
    });

    it("should reject deletion of non-existent comment", async () => {
      // Mock empty comment query result
      const commentSelectQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No comment found
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(commentSelectQuery);

      // Also need to mock the membership query even though it won't be used
      const membershipSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(membershipSelectQuery);

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.issue.comment.deleteComment({
          commentId: "non-existent",
        }),
      ).rejects.toThrow("Comment not found");
    });
  });

  describe("restoreComment", () => {
    it("should allow admin to restore deleted comment", async () => {
      // Mock comment lookup (deleted comment)
      const commentSelectQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            authorId: "user-1",
            deletedAt: new Date(),
            issue: {
              id: "issue-1",
              organizationId: "org-1",
            },
            author: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              image: null,
            },
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(commentSelectQuery);

      // Mock the update for restore
      const updateQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            content: "Test comment",
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            deletedBy: null,
            issueId: "issue-1",
            authorId: "user-1",
          },
        ]),
      };
      vi.mocked(ctx.db.update).mockReturnValueOnce(updateQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.comment.restoreComment({
        commentId: "comment-1",
      });

      expect(result).toMatchObject({
        id: "comment-1",
        deletedAt: null,
        deletedBy: null,
      });
    });

    it("should reject restore of non-deleted comment", async () => {
      // Mock non-deleted comment
      const commentSelectQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "comment-1",
            authorId: "user-1",
            deletedAt: null, // Not deleted
            issue: {
              id: "issue-1",
              organizationId: "org-1",
            },
            author: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              image: null,
            },
          },
        ]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(commentSelectQuery);

      const caller = appRouter.createCaller(ctx as any);

      await expect(
        caller.issue.comment.restoreComment({
          commentId: "comment-1",
        }),
      ).rejects.toThrow("Comment is not deleted");
    });
  });

  describe("getDeletedComments", () => {
    it("should return deleted comments for organization", async () => {
      const mockDeletedComments = [
        {
          id: "comment-1",
          content: "First deleted comment",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: new Date(),
          deletedBy: "user-1",
          issueId: "issue-1",
          authorId: "user-1",
          author: {
            id: "user-1",
            name: "Test User",
            email: "test@example.com",
            image: null,
          },
          deleter: {
            id: "user-1",
            name: "Test User",
            email: "test@example.com",
            image: null,
          },
          issue: {
            id: "issue-1",
            title: "Test Issue",
          },
        },
      ];

      // Mock the DrizzleCommentService by mocking the Drizzle operations it uses
      // The getDeletedComments procedure creates the service directly, so we mock the underlying DB calls
      const selectQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(
          mockDeletedComments.map((comment) => ({
            ...comment,
            deleter: null, // Will be populated in the service
          })),
        ),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(selectQuery);

      // Mock the individual deleter queries
      mockDeletedComments.forEach((comment) => {
        if (comment.deletedBy) {
          const deleterQuery = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([comment.deleter]),
          };
          vi.mocked(ctx.db.select).mockReturnValueOnce(deleterQuery);
        }
      });

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.comment.getDeletedComments();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "comment-1",
        content: "First deleted comment",
        deletedBy: "user-1",
      });
    });

    it("should reject member access to deleted comments", async () => {
      // Create a new context with limited permissions
      const memberCtx = createVitestMockContext();
      memberCtx.user = {
        id: "user-1",
        email: "test@example.com",
        user_metadata: { name: "Test User" },
        app_metadata: { organization_id: "org-1" },
      } as any;
      memberCtx.organization = {
        id: "org-1",
        name: "Test Organization",
        subdomain: "test",
      };
      memberCtx.userPermissions = ["issue:view", "issue:create", "issue:edit"]; // No organization:manage

      // Mock the membership for the organization procedure
      const mockMembership = {
        id: "membership-1",
        userId: "user-1",
        organizationId: "org-1",
        roleId: "role-1",
        role: {
          id: "role-1",
          name: "Member Role",
          permissions: [],
        },
      };
      // Mock the membership for the organization procedure
      const memberCtxMembershipQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockMembership]),
      };
      vi.mocked(memberCtx.db.select).mockReturnValue(memberCtxMembershipQuery);

      const caller = appRouter.createCaller(memberCtx as any);

      await expect(caller.issue.comment.getDeletedComments()).rejects.toThrow(); // Just check that access is denied
    });
  });

  describe("Authentication and Authorization", () => {
    it("should require authentication for all procedures", async () => {
      const caller = appRouter.createCaller({ ...ctx, user: null } as any);

      await expect(
        caller.issue.comment.addComment({
          issueId: "issue-1",
          content: "Should fail",
        }),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        caller.issue.comment.editComment({
          commentId: "comment-1",
          content: "Should fail",
        }),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        caller.issue.comment.deleteComment({
          commentId: "comment-1",
        }),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        caller.issue.comment.restoreComment({
          commentId: "comment-1",
        }),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(caller.issue.comment.getDeletedComments()).rejects.toThrow(
        "UNAUTHORIZED",
      );
    });

    it("should require organization context for all procedures", async () => {
      const caller = appRouter.createCaller({
        ...ctx,
        organization: null,
      } as any);

      await expect(
        caller.issue.comment.addComment({
          issueId: "issue-1",
          content: "Should fail",
        }),
      ).rejects.toThrow();

      await expect(caller.issue.comment.getDeletedComments()).rejects.toThrow();
    });
  });
});
