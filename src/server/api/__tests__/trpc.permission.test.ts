import { TRPCError } from "@trpc/server";
import { describe, it, expect, vi } from "vitest";

import { createTRPCRouter, organizationProcedure } from "../trpc";

import {
  requirePermissionForSession,
  getUserPermissionsForSession,
} from "~/server/auth/permissions";
import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";

// Import the session conversion function
function supabaseUserToSession(user: any) {
  return {
    user: {
      id: user?.id ?? "test-user-id",
      email: user?.email ?? "test@example.com",
      name: user?.user_metadata?.name ?? "Test User",
    },
  };
}

// Mock environment modules
vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test",
    AUTH_SECRET: "test-secret",
    DEFAULT_ORG_SUBDOMAIN: "apc",
  },
}));

// Mock NextAuth
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

// Mock permissions system
vi.mock("~/server/auth/permissions", () => ({
  requirePermissionForSession: vi.fn(),
  getUserPermissionsForSession: vi.fn(),
  getUserPermissionsForSupabaseUser: vi.fn(),
}));

// Mock tRPC context with a simplified membership structure
const createMockTRPCContext = (
  permissions: string[] = [],
): VitestMockContext & {
  membership: { roleId: string | null };
  userPermissions: string[];
} => {
  const mockContext = createVitestMockContext();

  // The membership object with role for PermissionService
  const mockMembership = {
    id: "membership-1",
    userId: "user-1",
    organizationId: "org-1",
    roleId: "role-1",
    role: {
      id: "role-1",
      name: "Test Role",
      organizationId: "org-1",
      permissions: permissions.map((name, index) => ({
        id: `perm-${(index + 1).toString()}`,
        name,
        description: `${name} permission`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    },
  };

  // Mock the membership lookup for PermissionService (uses findUnique with compound key)
  vi.mocked(mockContext.db.membership.findUnique).mockResolvedValue(
    mockMembership as any,
  );

  // Mock the membership lookup for organizationProcedure (uses findFirst)
  vi.mocked(mockContext.db.membership.findFirst).mockResolvedValue(
    mockMembership as any,
  );

  return {
    ...mockContext,
    user: {
      id: "user-1",
      email: "test@example.com",
      user_metadata: { name: "Test User" },
      app_metadata: { organization_id: "org-1" },
    } as any,
    organization: {
      id: "org-1",
      name: "Test Organization",
      subdomain: "test-org",
    },
    membership: {
      roleId: "role-1",
    },
    userPermissions: permissions,
  };
};

const testRouter = createTRPCRouter({
  testRequirePermission: organizationProcedure
    .use(async (opts) => {
      const session = supabaseUserToSession(opts.ctx.user);
      await requirePermissionForSession(
        session,
        "test:permission",
        opts.ctx.db as any,
        opts.ctx.organization.id,
      );
      return opts.next();
    })
    .query(() => {
      return { message: "Permission granted" };
    }),
});

describe("tRPC Permission Middleware", () => {
  describe("requirePermissionForSession", () => {
    it("should allow access when user has required permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["test:permission"]);
      const caller = testRouter.createCaller(ctx as any);

      // Mock permission functions
      vi.mocked(getUserPermissionsForSession).mockResolvedValue([
        "test:permission",
      ]);
      vi.mocked(requirePermissionForSession).mockResolvedValue(undefined);

      // Act
      const result = await caller.testRequirePermission();

      // Assert
      expect(result).toEqual({ message: "Permission granted" });
    });

    it("should deny access when user lacks required permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["other:permission"]);
      const caller = testRouter.createCaller(ctx as any);

      // Mock permission functions
      vi.mocked(getUserPermissionsForSession).mockResolvedValue([
        "other:permission",
      ]);
      vi.mocked(requirePermissionForSession).mockRejectedValue(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Missing required permission: test:permission",
        }),
      );

      // Act & Assert
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
      await expect(caller.testRequirePermission()).rejects.toThrow(
        "Missing required permission: test:permission",
      );
    });

    it("should deny access when user has no permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = testRouter.createCaller(ctx as any);

      // Mock permission functions
      vi.mocked(getUserPermissionsForSession).mockResolvedValue([]);
      vi.mocked(requirePermissionForSession).mockRejectedValue(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Missing required permission: test:permission",
        }),
      );

      // Act & Assert
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
      try {
        await caller.testRequirePermission();
        throw new Error("Should have thrown TRPCError");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });
});
