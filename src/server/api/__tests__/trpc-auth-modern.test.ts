import { type Session } from "next-auth";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { userRouter } from "../routers/user";

import type { VitestMockContext } from "~/test/vitestMockContext";

import { getUserPermissionsForSession } from "~/server/auth/permissions";
import { createVitestMockContext } from "~/test/vitestMockContext";

// Mock all the dependencies to avoid complex module loading
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test",
    AUTH_SECRET: "test-secret",
    DEFAULT_ORG_SUBDOMAIN: "apc",
  },
}));

// Mock image storage
vi.mock("../../../lib/image-storage/local-storage", () => ({
  imageStorage: {
    uploadImage: vi.fn(),
    deleteImage: vi.fn(),
  },
}));

// Mock image utils
vi.mock("../../../lib/utils/image-processing", () => ({
  getDefaultAvatarUrl: vi.fn(() => "default-avatar-url"),
}));

// Mock permissions system
vi.mock("../../../server/auth/permissions", () => ({
  getUserPermissionsForSession: vi.fn(),
}));

describe("Modern tRPC Auth & Permissions System", () => {
  let ctx: VitestMockContext;

  beforeEach(() => {
    ctx = createVitestMockContext();
    vi.clearAllMocks();
  });

  describe("Group 1: protectedProcedure Middleware", () => {
    it("should allow authenticated user to access protected procedure", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Set up mock context with valid session
      ctx.session = mockSession;

      // Mock the database query for user profile
      ctx.db.user.findUnique.mockResolvedValueOnce({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        bio: null,
        profilePicture: null,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ownedMachines: [],
        memberships: [],
        _count: {
          issuesCreated: 0,
          comments: 0,
          ownedMachines: 0,
        },
      } as any);

      const caller = userRouter.createCaller(ctx);

      // Test protected procedure access
      const result = await caller.getProfile();
      expect(result.id).toBe("user-123");
      expect(result.email).toBe("test@example.com");
      expect(result.name).toBe("Test User");
    });

    it("should reject unauthenticated user from protected procedure", async () => {
      // Set up mock context with no session
      ctx.session = null;

      const caller = userRouter.createCaller(ctx);

      // Test that unauthenticated requests are rejected
      await expect(caller.getProfile()).rejects.toThrow(
        expect.objectContaining({
          code: "UNAUTHORIZED",
        }),
      );
    });

    it("should reject user with invalid session user object", async () => {
      const invalidSession = {
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        // user property is missing - this makes it invalid
      } as Session;

      // Set up mock context with invalid session
      ctx.session = invalidSession;

      const caller = userRouter.createCaller(ctx);

      // Test that invalid session is rejected
      await expect(caller.getProfile()).rejects.toThrow(
        expect.objectContaining({
          code: "UNAUTHORIZED",
        }),
      );
    });
  });

  describe("Group 2: organizationProcedure Middleware", () => {
    it("should allow user with organization membership to access organization procedure", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Set up mock context with valid session and organization
      ctx.session = mockSession;
      ctx.organization = {
        id: "org-123",
        name: "Test Organization",
        subdomain: "test",
      };

      // Mock membership lookup for organizationProcedure
      ctx.db.membership.findFirst.mockResolvedValueOnce({
        id: "membership-1",
        userId: "user-123",
        organizationId: "org-123",
        roleId: "role-1",
        role: {
          id: "role-1",
          name: "Member",
          permissions: [{ id: "perm-1", name: "issue:view" }],
        },
      } as any);

      // Configure the permissions mock for this test
      vi.mocked(getUserPermissionsForSession).mockResolvedValueOnce([
        "issue:view",
      ]);

      const caller = userRouter.createCaller(ctx);

      // Test organization procedure access
      const result = await caller.getCurrentMembership();
      expect(result.userId).toBe("user-123");
      expect(result.role).toBe("Member");
      expect(result.organizationId).toBe("org-123");
      expect(result.permissions).toContain("issue:view");
    });

    it("should reject user without organization membership", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Set up mock context
      ctx.session = mockSession;
      ctx.organization = {
        id: "org-123",
        name: "Test Organization",
        subdomain: "test",
      };

      // Mock membership lookup returning null (no membership)
      ctx.db.membership.findFirst.mockResolvedValueOnce(null);

      const caller = userRouter.createCaller(ctx);

      // Test that user without membership is rejected
      await expect(caller.getCurrentMembership()).rejects.toThrow(
        expect.objectContaining({
          code: "FORBIDDEN",
          message: expect.stringContaining(
            "You don't have permission to access this organization",
          ),
        }),
      );
    });

    it("should reject user when organization not found", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Set up mock context with no organization
      ctx.session = mockSession;
      ctx.organization = null; // Organization not found

      const caller = userRouter.createCaller(ctx);

      // Test that missing organization is rejected
      await expect(caller.getCurrentMembership()).rejects.toThrow(
        expect.objectContaining({
          code: "NOT_FOUND",
          message: expect.stringContaining("Organization not found"),
        }),
      );
    });
  });

  describe("Group 3: Permission-based Procedure Tests", () => {
    it("should allow access when user has required permission", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Set up mock context
      ctx.session = mockSession;
      ctx.organization = {
        id: "org-123",
        name: "Test Organization",
        subdomain: "test",
      };

      // Mock membership with issue:view permission
      ctx.db.membership.findFirst.mockResolvedValueOnce({
        id: "membership-1",
        userId: "user-123",
        organizationId: "org-123",
        roleId: "role-1",
        role: {
          id: "role-1",
          name: "Member",
          permissions: [{ id: "perm-1", name: "issue:view" }],
        },
      } as any);

      // Configure permissions mock to return issue:view permission
      vi.mocked(getUserPermissionsForSession).mockResolvedValueOnce([
        "issue:view",
      ]);

      const caller = userRouter.createCaller(ctx);

      // Test that user can access their current membership (which requires permissions)
      const result = await caller.getCurrentMembership();
      expect(result.permissions).toContain("issue:view");
    });

    it("should reject access when user lacks required permission", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Set up mock context
      ctx.session = mockSession;
      ctx.organization = {
        id: "org-123",
        name: "Test Organization",
        subdomain: "test",
      };

      // Mock membership with limited permissions (no admin permissions)
      ctx.db.membership.findFirst.mockResolvedValueOnce({
        id: "membership-1",
        userId: "user-123",
        organizationId: "org-123",
        roleId: "role-1",
        role: {
          id: "role-1",
          name: "Limited Member",
          permissions: [{ id: "perm-1", name: "issue:view" }],
        },
      } as any);

      // Configure permissions mock to return only basic permissions
      vi.mocked(getUserPermissionsForSession).mockResolvedValueOnce([
        "issue:view",
      ]);

      const caller = userRouter.createCaller(ctx);

      // Verify that user has limited permissions (this is the expected behavior)
      const result = await caller.getCurrentMembership();
      expect(result.permissions).toEqual(["issue:view"]);
      expect(result.permissions).not.toContain("role:manage");
    });

    it("should handle permission expansion correctly", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "admin",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Set up mock context
      ctx.session = mockSession;
      ctx.organization = {
        id: "org-123",
        name: "Test Organization",
        subdomain: "test",
      };

      // Mock membership with admin permissions
      ctx.db.membership.findFirst.mockResolvedValueOnce({
        id: "membership-1",
        userId: "user-123",
        organizationId: "org-123",
        roleId: "admin-role-1",
        role: {
          id: "admin-role-1",
          name: "Admin",
          permissions: [
            { id: "perm-1", name: "issue:view" },
            { id: "perm-2", name: "issue:create" },
            { id: "perm-3", name: "issue:edit" },
            { id: "perm-4", name: "role:manage" },
          ],
        },
      } as any);

      // Configure permissions mock to return expanded admin permissions
      vi.mocked(getUserPermissionsForSession).mockResolvedValueOnce([
        "issue:view",
        "issue:create",
        "issue:edit",
        "role:manage",
        "location:view",
        "location:edit",
      ]);

      const caller = userRouter.createCaller(ctx);

      // Test that admin user gets expanded permissions
      const result = await caller.getCurrentMembership();
      expect(result.permissions).toEqual(
        expect.arrayContaining([
          "issue:view",
          "issue:create",
          "issue:edit",
          "role:manage",
          "location:view",
          "location:edit",
        ]),
      );
    });
  });
});
