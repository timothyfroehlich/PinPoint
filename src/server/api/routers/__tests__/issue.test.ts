import { TRPCError } from "@trpc/server";

// Mock NextAuth first to avoid import issues
jest.mock("next-auth", () => {
  return jest.fn().mockImplementation(() => ({
    auth: jest.fn(),
    handlers: { GET: jest.fn(), POST: jest.fn() },
    signIn: jest.fn(),
    signOut: jest.fn(),
  }));
});

import { appRouter } from "~/server/api/root";
import {
  createMockContext,
  mockUser,
  mockIssue,
  mockMachine,
  mockLocation,
  mockOrganization,
  mockStatus,
  mockPriority,
  mockMembership,
  mockRole,
  type MockContext,
} from "~/test/mockContext";

describe("issueRouter - Issue Detail Page", () => {
  let ctx: MockContext;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    ctx = createMockContext();
    ctx.session = {
      user: { id: mockUser.id },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    ctx.organization = mockOrganization;

    // Create caller with mock context directly
    caller = appRouter.createCaller(ctx);
  });

  describe("Public Issue Detail Access", () => {
    it("should allow public users to view issue details", async () => {
      const publicCaller = appRouter.createCaller({
        session: null,
        headers: ctx.headers,
        db: ctx.db,
      });

      const issueWithDetails = {
        ...mockIssue,
        machine: {
          ...mockMachine,
          model: { name: "Test Game", manufacturer: "Test Mfg" },
          location: mockLocation,
        },
        status: mockStatus,
        priority: mockPriority,
        createdBy: mockUser,
        assignedTo: null,
        comments: [],
        attachments: [],
        activities: [],
      };

      ctx.db.issue.findUnique.mockResolvedValue(issueWithDetails as any);

      const result = await publicCaller.issue.core.getById({
        id: mockIssue.id,
      });
      expect(result).toBeTruthy();
      expect(result.id).toBe(mockIssue.id);
      expect(result.title).toBe(mockIssue.title);
    });

    it("should filter sensitive data for public users", async () => {
      const publicCaller = appRouter.createCaller({
        session: null,
        headers: ctx.headers,
        db: ctx.db,
      });

      const issueWithSensitiveData = {
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

      ctx.db.issue.findUnique.mockResolvedValue(issueWithSensitiveData as any);

      const result = await publicCaller.issue.core.getById({
        id: mockIssue.id,
      });

      // Should only see public comments
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].content).toBe("Public comment");
    });

    it("should throw 404 for non-existent issues", async () => {
      const publicCaller = appRouter.createCaller({
        session: null,
        headers: ctx.headers,
        db: ctx.db,
      });

      ctx.db.issue.findUnique.mockResolvedValue(null);

      await expect(
        publicCaller.issue.core.getById({ id: "non-existent" }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("Authenticated Issue Detail Access", () => {
    it("should allow authenticated users to view all issue details", async () => {
      ctx.db.membership.findFirst.mockResolvedValue(mockMembership as any);

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

      ctx.db.issue.findUnique.mockResolvedValue(issueWithDetails as any);

      const result = await caller.issue.core.getById({ id: mockIssue.id });

      // Should see all comments
      expect(result.comments).toHaveLength(2);
      expect(result.assignedTo).toBeTruthy();
    });

    it("should enforce organization isolation", async () => {
      const otherOrgIssue = {
        ...mockIssue,
        organizationId: "other-org",
        machine: { ...mockMachine, organizationId: "other-org" },
      };

      ctx.db.issue.findUnique.mockResolvedValue(otherOrgIssue as any);

      await expect(
        caller.issue.core.getById({ id: mockIssue.id }),
      ).rejects.toThrow("Issue not found");
    });
  });

  describe("Permission-based Issue Operations", () => {
    it("should allow users with edit permissions to update issues", async () => {
      const editPermissionRole = {
        ...mockRole,
        permissions: [{ name: "issues:edit", description: "Edit issues" }],
      };

      ctx.db.membership.findFirst.mockResolvedValue({
        ...mockMembership,
        role: editPermissionRole,
      } as any);

      ctx.db.issue.findUnique.mockResolvedValue(mockIssue as any);
      ctx.db.issue.update.mockResolvedValue({
        ...mockIssue,
        title: "Updated Title",
      } as any);

      const result = await caller.issue.core.update({
        id: mockIssue.id,
        title: "Updated Title",
      });

      expect(result.title).toBe("Updated Title");
      expect(ctx.db.issue.update).toHaveBeenCalledWith({
        where: { id: mockIssue.id },
        data: { title: "Updated Title" },
      });
    });

    it("should deny users without edit permissions from updating issues", async () => {
      const readOnlyRole = {
        ...mockRole,
        permissions: [{ name: "issues:read", description: "Read issues" }],
      };

      ctx.db.membership.findFirst.mockResolvedValue({
        ...mockMembership,
        role: readOnlyRole,
      } as any);

      await expect(
        caller.issue.core.update({
          id: mockIssue.id,
          title: "Updated Title",
        }),
      ).rejects.toThrow("UNAUTHORIZED");
    });

    it("should allow users with close permissions to close issues", async () => {
      const closePermissionRole = {
        ...mockRole,
        permissions: [{ name: "issues:close", description: "Close issues" }],
      };

      ctx.db.membership.findFirst.mockResolvedValue({
        ...mockMembership,
        role: closePermissionRole,
      } as any);

      ctx.db.issue.findUnique.mockResolvedValue(mockIssue as any);
      ctx.db.issue.update.mockResolvedValue({
        ...mockIssue,
        resolvedAt: new Date(),
      } as any);

      const result = await caller.issue.core.close({
        id: mockIssue.id,
      });

      expect(result.resolvedAt).toBeTruthy();
      expect(ctx.db.issue.update).toHaveBeenCalledWith({
        where: { id: mockIssue.id },
        data: { resolvedAt: expect.any(Date) },
      });
    });

    it("should allow users with assign permissions to assign issues", async () => {
      const assignPermissionRole = {
        ...mockRole,
        permissions: [{ name: "issues:assign", description: "Assign issues" }],
      };

      ctx.db.membership.findFirst.mockResolvedValue({
        ...mockMembership,
        role: assignPermissionRole,
      } as any);

      ctx.db.issue.findUnique.mockResolvedValue(mockIssue as any);
      ctx.db.issue.update.mockResolvedValue({
        ...mockIssue,
        assignedToId: mockUser.id,
      } as any);

      const result = await caller.issue.core.assign({
        id: mockIssue.id,
        assignedToId: mockUser.id,
      });

      expect(result.assignedToId).toBe(mockUser.id);
      expect(ctx.db.issue.update).toHaveBeenCalledWith({
        where: { id: mockIssue.id },
        data: { assignedToId: mockUser.id },
      });
    });
  });

  describe("Issue Status Changes", () => {
    it("should allow status changes with proper validation", async () => {
      const statusChangeRole = {
        ...mockRole,
        permissions: [{ name: "issues:edit", description: "Edit issues" }],
      };

      ctx.db.membership.findFirst.mockResolvedValue({
        ...mockMembership,
        role: statusChangeRole,
      } as any);

      const newStatus = {
        ...mockStatus,
        id: "status-in-progress",
        name: "In Progress",
      };

      ctx.db.issue.findUnique.mockResolvedValue(mockIssue as any);
      ctx.db.issueStatus.findUnique.mockResolvedValue(newStatus as any);
      ctx.db.issue.update.mockResolvedValue({
        ...mockIssue,
        statusId: newStatus.id,
      } as any);

      const result = await caller.issue.core.updateStatus({
        id: mockIssue.id,
        statusId: newStatus.id,
      });

      expect(result.statusId).toBe(newStatus.id);
    });

    it("should validate status belongs to same organization", async () => {
      const statusChangeRole = {
        ...mockRole,
        permissions: [{ name: "issues:edit", description: "Edit issues" }],
      };

      ctx.db.membership.findFirst.mockResolvedValue({
        ...mockMembership,
        role: statusChangeRole,
      } as any);

      const otherOrgStatus = { ...mockStatus, organizationId: "other-org" };

      ctx.db.issue.findUnique.mockResolvedValue(mockIssue as any);
      ctx.db.issueStatus.findUnique.mockResolvedValue(otherOrgStatus as any);

      await expect(
        caller.issue.core.updateStatus({
          id: mockIssue.id,
          statusId: otherOrgStatus.id,
        }),
      ).rejects.toThrow("Status not found");
    });
  });

  describe("Issue Comment Operations", () => {
    it("should allow adding comments to issues", async () => {
      const newComment = {
        id: "comment-new",
        content: "New comment",
        isInternal: false,
        issueId: mockIssue.id,
        createdById: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      ctx.db.issue.findUnique.mockResolvedValue(mockIssue as any);
      ctx.db.issueComment.create.mockResolvedValue(newComment as any);

      const result = await caller.issue.comment.create({
        issueId: mockIssue.id,
        content: "New comment",
        isInternal: false,
      });

      expect(result.content).toBe("New comment");
      expect(result.isInternal).toBe(false);
    });

    it("should allow internal comments for authorized users", async () => {
      const internalCommentRole = {
        ...mockRole,
        permissions: [
          { name: "issues:internal_comment", description: "Internal comments" },
        ],
      };

      ctx.db.membership.findFirst.mockResolvedValue({
        ...mockMembership,
        role: internalCommentRole,
      } as any);

      const internalComment = {
        id: "comment-internal",
        content: "Internal note",
        isInternal: true,
        issueId: mockIssue.id,
        createdById: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      ctx.db.issue.findUnique.mockResolvedValue(mockIssue as any);
      ctx.db.issueComment.create.mockResolvedValue(internalComment as any);

      const result = await caller.issue.comment.create({
        issueId: mockIssue.id,
        content: "Internal note",
        isInternal: true,
      });

      expect(result.isInternal).toBe(true);
    });

    it("should deny internal comments for unauthorized users", async () => {
      const publicRole = {
        ...mockRole,
        permissions: [
          { name: "issues:comment", description: "Public comments" },
        ],
      };

      ctx.db.membership.findFirst.mockResolvedValue({
        ...mockMembership,
        role: publicRole,
      } as any);

      await expect(
        caller.issue.comment.create({
          issueId: mockIssue.id,
          content: "Internal note",
          isInternal: true,
        }),
      ).rejects.toThrow("UNAUTHORIZED");
    });
  });

  describe("Loading States and Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      ctx.db.issue.findUnique.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        caller.issue.core.getById({ id: mockIssue.id }),
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle concurrent access scenarios", async () => {
      // Simulate optimistic locking scenario
      ctx.db.issue.findUnique.mockResolvedValue(mockIssue as any);
      ctx.db.issue.update.mockRejectedValue(
        new Error("Concurrent modification"),
      );

      await expect(
        caller.issue.core.update({
          id: mockIssue.id,
          title: "Updated Title",
        }),
      ).rejects.toThrow("Concurrent modification");
    });
  });
});
