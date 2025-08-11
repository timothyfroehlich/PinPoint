import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock NextAuth first to avoid import issues
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
    getUserPermissionsForSession: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});

import { appRouter } from "~/server/api/root";
import {
  getUserPermissionsForSession,
  requirePermissionForSession,
} from "~/server/auth/permissions";
import { createVitestMockContext } from "~/test/vitestMockContext";

// Mock data for tests
const mockUser = { id: "user-1", email: "test@example.com", name: "Test User" };
const mockIssue = {
  id: "issue-1",
  title: "Test Issue",
  machineId: "machine-1",
  organizationId: "org-1",
};
const mockMachine = {
  id: "machine-1",
  name: "Test Machine",
  organizationId: "org-1",
  locationId: "location-1",
};
const mockStatus = {
  id: "status-1",
  name: "Open",
  category: "NEW",
  organizationId: "org-1",
};
const mockPriority = {
  id: "priority-1",
  name: "Medium",
  organizationId: "org-1",
};
const mockMembership = {
  id: "membership-1",
  userId: "user-1",
  organizationId: "org-1",
  roleId: "role-1",
};

// Helper to create authenticated context with permissions
const createAuthenticatedContext = (permissions: string[] = []) => {
  const mockContext = createVitestMockContext();

  // Override the user with proper test data
  (mockContext as any).user = {
    id: "user-1",
    email: "test@example.com",
    user_metadata: {
      name: "Test User",
      avatar_url: null,
    },
    app_metadata: {
      organization_id: "org-1",
      role: "Member",
    },
  };

  (mockContext as any).organization = {
    id: "org-1",
    name: "Test Organization",
    subdomain: "test",
  };

  const membershipData = {
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
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: permissions.map((name, index) => ({
        id: `perm-${(index + 1).toString()}`,
        name,
        description: `${name} permission`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    },
  };

  // Mock the database query for membership lookup
  vi.mocked(mockContext.db.membership.findFirst).mockResolvedValue(
    membershipData as any,
  );

  // Mock the permissions system
  vi.mocked(getUserPermissionsForSession).mockResolvedValue(permissions);

  // Mock requirePermissionForSession - it should throw when permission is missing
  vi.mocked(requirePermissionForSession).mockImplementation(
    (_session, permission, _db, _orgId) => {
      if (!permissions.includes(permission)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Missing required permission: ${permission}`,
        });
      }
      return Promise.resolve();
    },
  );

  return {
    ...mockContext,
    // Add the user property that tRPC middleware expects
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      image: null,
    },
    membership: membershipData,
    userPermissions: permissions,
  } as any;
};

describe("issueRouter - Issue Detail Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authenticated Issue Detail Access", () => {
    it("should allow authenticated users to view all issue details", async () => {
      const authCtx = createAuthenticatedContext(["issue:view"]);
      const authCaller = appRouter.createCaller(authCtx);

      authCtx.db.membership.findFirst.mockResolvedValue(mockMembership as any);

      const issueWithDetails = {
        ...mockIssue,
        machine: mockMachine,
        status: mockStatus,
        priority: mockPriority,
        createdBy: mockUser,
        assignedTo: mockUser,
        comments: [
          {
            id: "comment-1",
            content: "Internal note",
            isInternal: true,
            createdBy: mockUser,
            author: {
              // Add author field for null safety
              id: mockUser.id,
              name: mockUser.name,
              profilePicture: null,
            },
            createdAt: new Date(),
          },
          {
            id: "comment-2",
            content: "Public comment",
            isInternal: false,
            createdBy: mockUser,
            author: {
              // Add author field for null safety
              id: mockUser.id,
              name: mockUser.name,
              profilePicture: null,
            },
            createdAt: new Date(),
          },
        ],
      };

      // Mock Drizzle query API instead of Prisma
      vi.mocked(authCtx.drizzle.query.issues.findFirst).mockResolvedValue(
        issueWithDetails as any,
      );

      const result = await authCaller.issue.core.getById({ id: mockIssue.id });

      // Should see all comments
      expect(result.comments).toHaveLength(2);
      expect(result.assignedTo).toBeTruthy();
    });

    it("should enforce organization isolation", async () => {
      const authCtx = createAuthenticatedContext(["issue:view"]);
      const authCaller = appRouter.createCaller(authCtx);

      const otherOrgIssue = {
        ...mockIssue,
        organizationId: "other-org",
        machine: { ...mockMachine, organizationId: "other-org" },
      };

      // Mock Drizzle to return null (simulating organization isolation)
      vi.mocked(authCtx.drizzle.query.issues.findFirst).mockResolvedValue(null);

      await expect(
        authCaller.issue.core.getById({ id: mockIssue.id }),
      ).rejects.toThrow("Issue not found");
    });
  });

  describe("Permission-based Issue Operations", () => {
    it("should allow users with edit permissions to update issues", async () => {
      const editCtx = createAuthenticatedContext(["issue:edit"]);
      const editCaller = appRouter.createCaller(editCtx);

      // Mock activity and notification services
      const mockActivityService = {
        recordFieldUpdate: vi.fn().mockResolvedValue(undefined),
      };
      const mockNotificationService = {
        notifyMachineOwnerOfStatusChange: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(editCtx.services.createIssueActivityService).mockReturnValue(
        mockActivityService as any,
      );
      vi.mocked(editCtx.services.createNotificationService).mockReturnValue(
        mockNotificationService as any,
      );

      // Mock Drizzle update operation chain
      vi.mocked(editCtx.drizzle.update).mockReturnValue(editCtx.drizzle);
      vi.mocked(editCtx.drizzle.set).mockReturnValue(editCtx.drizzle);
      vi.mocked(editCtx.drizzle.where).mockReturnValue(editCtx.drizzle);
      vi.mocked(editCtx.drizzle.returning).mockResolvedValue([
        {
          ...mockIssue,
          title: "Updated Title",
        },
      ] as any);

      // Mock Drizzle query API - first call for validation, second call for final response
      vi.mocked(editCtx.drizzle.query.issues.findFirst)
        .mockResolvedValueOnce({
          ...mockIssue,
          status: mockStatus,
          assignedTo: null,
        } as any) // First call: validation check
        .mockResolvedValueOnce({
          ...mockIssue,
          title: "Updated Title",
          status: mockStatus,
          assignedTo: null,
        } as any); // Second call: final response with updated data

      const result = await editCaller.issue.core.update({
        id: mockIssue.id,
        title: "Updated Title",
      });

      expect(result.title).toBe("Updated Title");
      // Verify Drizzle update operations were called
      expect(editCtx.drizzle.update).toHaveBeenCalled();
      expect(editCtx.drizzle.set).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated Title",
        }),
      );
    });

    it("should deny users without edit permissions from updating issues", async () => {
      const readOnlyCtx = createAuthenticatedContext(["issue:view"]);
      const readOnlyCaller = appRouter.createCaller(readOnlyCtx);

      await expect(
        readOnlyCaller.issue.core.update({
          id: mockIssue.id,
          title: "Updated Title",
        }),
      ).rejects.toThrow("Missing required permission: issue:edit");
    });

    it("should allow users with close permissions to close issues", async () => {
      const closeCtx = createAuthenticatedContext(["issue:edit"]);
      const closeCaller = appRouter.createCaller(closeCtx);

      const resolvedStatus = {
        id: "status-resolved",
        name: "Resolved",
        category: "RESOLVED",
      };
      vi.mocked(
        closeCtx.drizzle.query.issueStatuses.findFirst,
      ).mockResolvedValue(resolvedStatus as any);

      // Mock Drizzle update chain for close operation
      vi.mocked(closeCtx.drizzle.update).mockReturnValue(closeCtx.drizzle);
      vi.mocked(closeCtx.drizzle.set).mockReturnValue(closeCtx.drizzle);
      vi.mocked(closeCtx.drizzle.where).mockReturnValue(closeCtx.drizzle);
      vi.mocked(closeCtx.drizzle.returning).mockResolvedValue([
        {
          ...mockIssue,
          resolvedAt: new Date(),
        },
      ] as any);

      // Mock Drizzle query API - there's only one call to get the final issue with relations
      const resolvedDate = new Date();
      vi.mocked(closeCtx.drizzle.query.issues.findFirst).mockResolvedValue({
        ...mockIssue,
        resolvedAt: resolvedDate,
        status: resolvedStatus,
      } as any); // Final response with resolvedAt and new status

      const result = await closeCaller.issue.core.close({
        id: mockIssue.id,
      });

      expect(result.resolvedAt).toBeTruthy();
      // Verify Drizzle update operations were called
      expect(closeCtx.drizzle.update).toHaveBeenCalled();
      expect(closeCtx.drizzle.set).toHaveBeenCalledWith(
        expect.objectContaining({
          resolvedAt: expect.any(Date),
        }),
      );
    });

    it("should allow users with assign permissions to assign issues", async () => {
      const assignCtx = createAuthenticatedContext(["issue:assign"]);
      const assignCaller = appRouter.createCaller(assignCtx);

      // Mock activity service
      const mockActivityService = {
        recordIssueAssigned: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(assignCtx.services.createIssueActivityService).mockReturnValue(
        mockActivityService as any,
      );

      // Mock Drizzle queries for assign operation
      vi.mocked(assignCtx.drizzle.query.issues.findFirst).mockResolvedValue(
        mockIssue as any,
      );
      vi.mocked(
        assignCtx.drizzle.query.memberships.findFirst,
      ).mockResolvedValue({
        ...mockMembership,
        user: mockUser,
      } as any);

      // Mock Drizzle update chain for assign operation
      vi.mocked(assignCtx.drizzle.update).mockReturnValue(assignCtx.drizzle);
      vi.mocked(assignCtx.drizzle.set).mockReturnValue(assignCtx.drizzle);
      vi.mocked(assignCtx.drizzle.where).mockReturnValue(assignCtx.drizzle);
      vi.mocked(assignCtx.drizzle.returning).mockResolvedValue([
        {
          ...mockIssue,
          assignedToId: mockUser.id,
        },
      ] as any);

      // Mock second query for getting updated issue with relations
      vi.mocked(assignCtx.drizzle.query.issues.findFirst)
        .mockResolvedValueOnce(mockIssue as any) // First call for validation
        .mockResolvedValueOnce({
          ...mockIssue,
          assignedToId: mockUser.id,
          assignedTo: mockUser,
        } as any); // Second call for response

      const result = await assignCaller.issue.core.assign({
        issueId: mockIssue.id,
        userId: mockUser.id,
      });

      expect(result.issue.assignedToId).toBe(mockUser.id);
      // Verify Drizzle update operations were called
      expect(assignCtx.drizzle.update).toHaveBeenCalled();
      expect(assignCtx.drizzle.set).toHaveBeenCalledWith({
        assignedToId: mockUser.id,
      });
    });
  });

  describe("Issue Status Changes", () => {
    it("should allow status changes with proper validation", async () => {
      // Use standard authenticated context instead of custom minimal context
      const statusCtx = createAuthenticatedContext(["issue:edit"]);
      const statusCaller = appRouter.createCaller(statusCtx);

      const newStatus = {
        ...mockStatus,
        id: "status-in-progress",
        name: "In Progress",
        category: "IN_PROGRESS" as const,
      };

      // Mock Drizzle update chain for status change
      vi.mocked(statusCtx.drizzle.update).mockReturnValue(statusCtx.drizzle);
      vi.mocked(statusCtx.drizzle.set).mockReturnValue(statusCtx.drizzle);
      vi.mocked(statusCtx.drizzle.where).mockReturnValue(statusCtx.drizzle);
      vi.mocked(statusCtx.drizzle.returning).mockResolvedValue([
        {
          ...mockIssue,
          statusId: newStatus.id,
        },
      ] as any);

      // Mock Drizzle query API calls
      vi.mocked(statusCtx.drizzle.query.issues.findFirst)
        .mockResolvedValueOnce({
          ...mockIssue,
          status: mockStatus,
        } as any) // First call: validation check
        .mockResolvedValueOnce({
          ...mockIssue,
          statusId: newStatus.id,
          status: newStatus,
        } as any); // Second call: final response with new status

      vi.mocked(
        statusCtx.drizzle.query.issueStatuses.findFirst,
      ).mockResolvedValue(newStatus as any);

      const result = await statusCaller.issue.core.updateStatus({
        id: mockIssue.id,
        statusId: newStatus.id,
      });

      expect(result.statusId).toBe(newStatus.id);
    });

    it("should validate status belongs to same organization", async () => {
      const statusCtx = createAuthenticatedContext(["issue:edit"]);
      const statusCaller = appRouter.createCaller(statusCtx);

      // Mock Drizzle queries for status validation test
      vi.mocked(statusCtx.drizzle.query.issues.findFirst).mockResolvedValue({
        ...mockIssue,
        status: mockStatus,
      } as any);
      vi.mocked(
        statusCtx.drizzle.query.issueStatuses.findFirst,
      ).mockResolvedValue(null); // Status not found

      await expect(
        statusCaller.issue.core.updateStatus({
          id: mockIssue.id,
          statusId: "other-org-status",
        }),
      ).rejects.toThrow("Invalid status");
    });
  });

  describe("Issue Comment Operations", () => {
    it("should allow adding comments to issues", async () => {
      const commentCtx = createAuthenticatedContext([
        "issue:create",
        "issue:comment",
      ]);
      const commentCaller = appRouter.createCaller(commentCtx);

      const newComment = {
        id: "comment-new",
        content: "New comment",
        isInternal: false,
        issueId: mockIssue.id,
        createdById: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      commentCtx.db.issue.findFirst.mockResolvedValue(mockIssue as any);
      commentCtx.db.membership.findUnique.mockResolvedValue(
        mockMembership as any,
      );
      commentCtx.db.comment.create.mockResolvedValue(newComment as any);

      const result = await commentCaller.issue.comment.create({
        issueId: mockIssue.id,
        content: "New comment",
      });

      expect(result.content).toBe("New comment");
    });

    it("should allow internal comments for authorized users", async () => {
      const internalCtx = createAuthenticatedContext([
        "issue:create",
        "issue:internal_comment",
      ]);
      const internalCaller = appRouter.createCaller(internalCtx);

      const internalComment = {
        id: "comment-internal",
        content: "Internal note",
        isInternal: true,
        issueId: mockIssue.id,
        createdById: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      internalCtx.db.issue.findFirst.mockResolvedValue(mockIssue as any);
      internalCtx.db.membership.findUnique.mockResolvedValue(
        mockMembership as any,
      );
      internalCtx.db.comment.create.mockResolvedValue(internalComment as any);

      const result = await internalCaller.issue.comment.create({
        issueId: mockIssue.id,
        content: "Internal note",
      });

      expect(result.content).toBe("Internal note");
    });

    it("should deny internal comments for unauthorized users", async () => {
      const publicCommentCtx = createAuthenticatedContext([
        "issue:create",
        "issue:comment",
      ]);
      const publicCommentCaller = appRouter.createCaller(publicCommentCtx);

      // Mock Prisma queries for comment creation test (issue.comment.ts still uses Prisma)
      vi.mocked(publicCommentCtx.db.issue.findFirst).mockResolvedValue(
        mockIssue as any,
      );
      vi.mocked(publicCommentCtx.db.membership.findUnique).mockResolvedValue(
        mockMembership as any,
      );

      // Try the call and see what happens
      try {
        const result = await publicCommentCaller.issue.comment.create({
          issueId: mockIssue.id,
          content: "Test comment",
        });
        // If we get here, the call succeeded when it should have failed
        expect(result).toBeUndefined(); // Force a failure to see what we actually got
      } catch (error) {
        // This is expected - should throw a permission error
        expect((error as Error).message).toMatch(
          /Missing required permission|internal_comment/,
        );
      }
    });
  });

  describe("Loading States and Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      const errorCtx = createAuthenticatedContext(["issue:view"]);
      const errorCaller = appRouter.createCaller(errorCtx);

      errorCtx.db.issue.findFirst.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        errorCaller.issue.core.getById({ id: mockIssue.id }),
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle concurrent access scenarios", async () => {
      const concurrentCtx = createAuthenticatedContext(["issue:edit"]);
      const concurrentCaller = appRouter.createCaller(concurrentCtx);

      // Mock Drizzle update chain to reject with concurrent modification error
      vi.mocked(concurrentCtx.drizzle.update).mockReturnValue(
        concurrentCtx.drizzle,
      );
      vi.mocked(concurrentCtx.drizzle.set).mockReturnValue(
        concurrentCtx.drizzle,
      );
      vi.mocked(concurrentCtx.drizzle.where).mockReturnValue(
        concurrentCtx.drizzle,
      );
      vi.mocked(concurrentCtx.drizzle.returning).mockRejectedValue(
        new Error("Concurrent modification"),
      );

      // Mock Drizzle query API - first call should succeed (validation), update should fail
      vi.mocked(concurrentCtx.drizzle.query.issues.findFirst).mockResolvedValue(
        {
          ...mockIssue,
          status: mockStatus,
        } as any,
      );

      await expect(
        concurrentCaller.issue.core.update({
          id: mockIssue.id,
          title: "Updated Title",
        }),
      ).rejects.toThrow("Concurrent modification");
    });
  });
});
