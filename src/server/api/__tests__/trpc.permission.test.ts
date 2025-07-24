import { describe, it, expect } from "@jest/globals";
import { TRPCError } from "@trpc/server";

import { createMockContext, type MockContext } from "../../../test/mockContext";
import { requirePermissionForSession } from "../../auth/permissions";
import { createTRPCRouter, organizationProcedure } from "../trpc";

// Mock tRPC context with a simplified membership structure
const createMockTRPCContext = (
  permissions: string[] = [],
): MockContext & {
  membership: { roleId: string | null };
  userPermissions: string[];
} => {
  const mockContext = createMockContext();

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
  mockContext.db.membership.findUnique.mockResolvedValue(
    mockMembership as never,
  );

  // Mock the membership lookup for organizationProcedure (uses findFirst)
  mockContext.db.membership.findFirst.mockResolvedValue(
    mockMembership as never,
  );

  return {
    ...mockContext,
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
      await requirePermissionForSession(
        opts.ctx.session,
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

      // Act
      const result = await caller.testRequirePermission();

      // Assert
      expect(result).toEqual({ message: "Permission granted" });
    });

    it("should deny access when user lacks required permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["other:permission"]);
      const caller = testRouter.createCaller(ctx as any);

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
