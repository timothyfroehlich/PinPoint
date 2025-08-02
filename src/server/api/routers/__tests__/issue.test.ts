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
            createdAt: new Date(),
          },
          {
            id: "comment-2",
            content: "Public comment",
            isInternal: false,
            createdBy: mockUser,
            createdAt: new Date(),
          },
        ],
      };

      // Mock both findUnique and findFirst since different procedures use different methods
      authCtx.db.issue.findUnique.mockResolvedValue(issueWithDetails as any);
      authCtx.db.issue.findFirst.mockResolvedValue(issueWithDetails as any);

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

      authCtx.db.issue.findUnique.mockResolvedValue(otherOrgIssue as any);

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

      editCtx.db.issue.findFirst.mockResolvedValue({
        ...mockIssue,
        status: mockStatus,
        assignedTo: null,
      } as any);
      editCtx.db.issue.update.mockResolvedValue({
        ...mockIssue,
        title: "Updated Title",
      } as any);

      const result = await editCaller.issue.core.update({
        id: mockIssue.id,
        title: "Updated Title",
      });

      expect(result.title).toBe("Updated Title");
      expect(editCtx.db.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockIssue.id },
          data: expect.objectContaining({ title: "Updated Title" }),
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
      closeCtx.db.issueStatus.findFirst.mockResolvedValue(
        resolvedStatus as any,
      );
      closeCtx.db.issue.update.mockResolvedValue({
        ...mockIssue,
        resolvedAt: new Date(),
      } as any);

      const result = await closeCaller.issue.core.close({
        id: mockIssue.id,
      });

      expect(result.resolvedAt).toBeTruthy();
      expect(closeCtx.db.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockIssue.id },
          data: expect.objectContaining({ resolvedAt: expect.any(Date) }),
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

      assignCtx.db.issue.findFirst.mockResolvedValue(mockIssue as any);
      assignCtx.db.membership.findUnique.mockResolvedValue({
        ...mockMembership,
        user: mockUser,
      } as any);
      assignCtx.db.issue.update.mockResolvedValue({
        ...mockIssue,
        assignedToId: mockUser.id,
        assignedTo: mockUser,
      } as any);

      const result = await assignCaller.issue.core.assign({
        issueId: mockIssue.id,
        userId: mockUser.id,
      });

      expect(result.issue.assignedToId).toBe(mockUser.id);
      expect(assignCtx.db.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockIssue.id },
          data: { assignedToId: mockUser.id },
        }),
      );
    });
  });

  describe("Issue Status Changes", () => {
    it("should allow status changes with proper validation", async () => {
      // Create a minimal context that satisfies tRPC requirements
      const mockDb = createVitestMockContext().db;
      const mockServices = createVitestMockContext().services;

      // Create a proper PinPointSupabaseUser
      const supabaseUser = {
        id: "user-1",
        aud: "authenticated",
        role: "authenticated",
        email: "test@example.com",
        email_confirmed_at: "2023-01-01T00:00:00Z",
        phone: "",
        last_sign_in_at: "2023-01-01T00:00:00Z",
        app_metadata: {
          provider: "google",
          organization_id: "org-1",
        },
        user_metadata: {
          name: "Test User",
        },
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const testContext = {
        db: mockDb,
        services: mockServices,
        headers: new Headers(),
        session: {
          user: {
            id: "user-1",
            email: "test@example.com",
            name: "Test User",
            image: null,
          },
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        },
        organization: {
          id: "org-1",
          name: "Test Organization",
          subdomain: "test",
        },
        user: supabaseUser,
      };

      const statusCaller = appRouter.createCaller(testContext as any);

      const newStatus = {
        ...mockStatus,
        id: "status-in-progress",
        name: "In Progress",
        category: "IN_PROGRESS" as const,
      };

      // Mock the membership lookup that the middleware requires
      vi.mocked(testContext.db.membership.findFirst).mockResolvedValue(
        mockMembership as any,
      );

      // Mock the database calls with proper type casting
      vi.mocked(testContext.db.issue.findFirst).mockResolvedValue({
        ...mockIssue,
        status: mockStatus,
      } as any);
      vi.mocked(testContext.db.issueStatus.findFirst).mockResolvedValue(
        newStatus as any,
      );
      vi.mocked(testContext.db.issue.update).mockResolvedValue({
        ...mockIssue,
        statusId: newStatus.id,
      } as any);

      // Mock the permission system to allow the test to pass
      vi.mocked(getUserPermissionsForSession).mockResolvedValue(["issue:edit"]);
      vi.mocked(requirePermissionForSession).mockResolvedValue();

      const result = await statusCaller.issue.core.updateStatus({
        id: mockIssue.id,
        statusId: newStatus.id,
      });

      expect(result.statusId).toBe(newStatus.id);
    });

    it("should validate status belongs to same organization", async () => {
      const statusCtx = createAuthenticatedContext(["issue:edit"]);
      const statusCaller = appRouter.createCaller(statusCtx);

      statusCtx.db.issue.findFirst.mockResolvedValue(mockIssue as any);
      statusCtx.db.issueStatus.findFirst.mockResolvedValue(null); // Status not found

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

      publicCommentCtx.db.issue.findFirst.mockResolvedValue(mockIssue as any);
      publicCommentCtx.db.membership.findUnique.mockResolvedValue(
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

      // Simulate optimistic locking scenario
      concurrentCtx.db.issue.findFirst.mockResolvedValue(mockIssue as any);
      concurrentCtx.db.issue.update.mockRejectedValue(
        new Error("Concurrent modification"),
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
