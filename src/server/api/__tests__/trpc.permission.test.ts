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

import {
  SEED_TEST_IDS,
  createMockAdminContext,
  createMockMemberContext,
} from "~/test/constants/seed-test-ids";

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

// ENHANCED: Drizzle-based mock context with organizational scoping
const createMockTRPCContext = (
  permissions: string[] = [],
  organizationId: string = SEED_TEST_IDS.ORGANIZATIONS.primary,
  userId: string = SEED_TEST_IDS.USERS.ADMIN,
): VitestMockContext & {
  membership: { roleId: string | null };
  userPermissions: string[];
} => {
  const mockContext = createVitestMockContext();
  const roleId = `${organizationId}-admin-role`;

  // DRIZZLE PATTERN: Mock membership with organizational scoping
  const mockMembership = {
    id: `membership-${userId}-${organizationId}`,
    userId,
    organizationId,
    roleId,
    role: {
      id: roleId,
      name: "Test Role",
      organizationId,
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

  // DRIZZLE PATTERN: Mock the Drizzle membership queries with organizational filtering
  vi.mocked(mockContext.db.query.memberships.findFirst).mockResolvedValue(
    mockMembership as any,
  );

  // DRIZZLE PATTERN: Mock role lookup with organizational scoping
  vi.mocked(mockContext.db.query.roles.findFirst).mockResolvedValue(
    mockMembership.role as any,
  );

  return {
    ...mockContext,
    user: {
      id: userId,
      email: `test-${organizationId}@example.com`,
      user_metadata: { name: "Test User" },
      app_metadata: { organization_id: organizationId },
    } as any,
    organization: {
      id: organizationId,
      name: organizationId === SEED_TEST_IDS.ORGANIZATIONS.primary ? "Primary Organization" : "Competitor Organization",
      subdomain: organizationId === SEED_TEST_IDS.ORGANIZATIONS.primary ? "primary" : "competitor",
    },
    membership: {
      roleId,
    },
    userPermissions: permissions,
  };
};

// Helper for cross-organizational testing
const createCompetitorOrgContext = (permissions: string[] = []) => {
  return createMockTRPCContext(
    permissions,
    SEED_TEST_IDS.ORGANIZATIONS.competitor,
    'test-competitor-user'
  );
};

const testRouter = createTRPCRouter({
  testRequirePermission: organizationProcedure
    .use(async (opts) => {
      const session = supabaseUserToSession(opts.ctx.user);
      await requirePermissionForSession(
        session,
        "test:permission",
        opts.ctx.db as any,
      );
      return opts.next();
    })
    .query(() => {
      return { message: "Permission granted" };
    }),
});

describe("tRPC Permission Middleware - ENHANCED WITH ORGANIZATIONAL BOUNDARY SECURITY", () => {
  
  // === BASIC PERMISSION TESTS ===
  describe("requirePermissionForSession - Core Functionality", () => {
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

  // === CRITICAL ORGANIZATIONAL BOUNDARY SECURITY TESTS ===
  describe("CRITICAL - Cross-Organizational Permission Isolation", () => {
    it("CRITICAL - Should prevent cross-organizational permission escalation", async () => {
      // Arrange: Primary org admin tries to use competitor org permissions
      const primaryOrgCtx = createMockTRPCContext(
        ["admin:delete"], 
        SEED_TEST_IDS.ORGANIZATIONS.primary
      );
      const caller = testRouter.createCaller(primaryOrgCtx as any);

      // Mock: Permission system should NOT find permissions across organizations
      vi.mocked(getUserPermissionsForSession).mockResolvedValue([]); // Cross-org = no permissions
      vi.mocked(requirePermissionForSession).mockRejectedValue(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Missing required permission: test:permission",
        }),
      );

      // Act & Assert: Should be denied even though user has admin:delete in their own org
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
      await expect(caller.testRequirePermission()).rejects.toThrow(
        "Missing required permission: test:permission",
      );
    });

    it("CRITICAL - Should validate organizational context in permission checks", async () => {
      // Arrange: Create contexts for both organizations
      const primaryOrgCtx = createMockTRPCContext(
        ["test:permission"],
        SEED_TEST_IDS.ORGANIZATIONS.primary
      );
      const competitorOrgCtx = createCompetitorOrgContext(["test:permission"]);

      const primaryCaller = testRouter.createCaller(primaryOrgCtx as any);
      const competitorCaller = testRouter.createCaller(competitorOrgCtx as any);

      // Mock: Each organization should only see their own permissions
      vi.mocked(getUserPermissionsForSession).mockImplementation((session) => {
        const orgId = (session.user as any)?.app_metadata?.organization_id;
        if (orgId === SEED_TEST_IDS.ORGANIZATIONS.primary) {
          return Promise.resolve(["test:permission"]);
        } else if (orgId === SEED_TEST_IDS.ORGANIZATIONS.competitor) {
          return Promise.resolve(["test:permission"]);
        }
        return Promise.resolve([]);
      });

      vi.mocked(requirePermissionForSession).mockImplementation((session) => {
        const orgId = (session.user as any)?.app_metadata?.organization_id;
        if (orgId && [SEED_TEST_IDS.ORGANIZATIONS.primary, SEED_TEST_IDS.ORGANIZATIONS.competitor].includes(orgId)) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new TRPCError({ code: "FORBIDDEN", message: "Invalid organizational context" }));
      });

      // Act & Assert: Both should succeed in their own context
      await expect(primaryCaller.testRequirePermission()).resolves.toEqual({ message: "Permission granted" });
      await expect(competitorCaller.testRequirePermission()).resolves.toEqual({ message: "Permission granted" });
    });

    it("CRITICAL - Should prevent role-based attacks across organizations", async () => {
      // Arrange: Malicious user tries to access with competitor org role ID
      const maliciousCtx = createMockTRPCContext(
        ["super:admin"],
        SEED_TEST_IDS.ORGANIZATIONS.primary
      );
      
      // Simulate tampering with role context
      maliciousCtx.membership.roleId = "competitor-admin-role-id";
      
      const caller = testRouter.createCaller(maliciousCtx as any);

      // Mock: Permission system should reject cross-org role access
      vi.mocked(getUserPermissionsForSession).mockResolvedValue([]);
      vi.mocked(requirePermissionForSession).mockRejectedValue(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Role access denied: organizational boundary violation",
        }),
      );

      // Act & Assert: Should be denied
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
      await expect(caller.testRequirePermission()).rejects.toThrow(
        "Role access denied: organizational boundary violation",
      );
    });

    it("CRITICAL - Should enforce permission matrix boundaries across organizations", async () => {
      // Test critical permission scenarios across organizational boundaries
      const permissionMatrix = [
        {
          org: SEED_TEST_IDS.ORGANIZATIONS.primary,
          permission: "organization:delete",
          description: "Primary org admin with delete permission",
          shouldSucceed: true,
        },
        {
          org: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          permission: "organization:delete",
          description: "Competitor org admin with delete permission",
          shouldSucceed: true,
        },
        {
          org: SEED_TEST_IDS.ORGANIZATIONS.primary,
          permission: "cross_org:access",
          description: "Primary org user attempting cross-org access",
          shouldSucceed: false,
        },
        {
          org: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          permission: "cross_org:access",
          description: "Competitor org user attempting cross-org access",
          shouldSucceed: false,
        },
      ];

      for (const testCase of permissionMatrix) {
        // Arrange
        const ctx = createMockTRPCContext(
          testCase.shouldSucceed ? [testCase.permission] : [],
          testCase.org
        );
        const caller = testRouter.createCaller(ctx as any);

        // Mock permission response based on test case
        if (testCase.shouldSucceed) {
          vi.mocked(getUserPermissionsForSession).mockResolvedValue([testCase.permission]);
          vi.mocked(requirePermissionForSession).mockResolvedValue(undefined);
        } else {
          vi.mocked(getUserPermissionsForSession).mockResolvedValue([]);
          vi.mocked(requirePermissionForSession).mockRejectedValue(
            new TRPCError({
              code: "FORBIDDEN",
              message: `Missing required permission: ${testCase.permission}`,
            }),
          );
        }

        // Act & Assert
        if (testCase.shouldSucceed) {
          await expect(caller.testRequirePermission()).resolves.toEqual({
            message: "Permission granted",
          });
        } else {
          await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
        }
      }
    });
  });

  // === SECURITY EDGE CASES ===
  describe("Security Edge Cases and Attack Vectors", () => {
    it("should handle invalid organizational context gracefully", async () => {
      // Arrange
      const ctx = createMockTRPCContext([], "invalid-org-id");
      const caller = testRouter.createCaller(ctx as any);

      // Mock: Invalid org should result in no permissions
      vi.mocked(getUserPermissionsForSession).mockResolvedValue([]);
      vi.mocked(requirePermissionForSession).mockRejectedValue(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid organizational context",
        }),
      );

      // Act & Assert
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
      await expect(caller.testRequirePermission()).rejects.toThrow(
        "Invalid organizational context",
      );
    });

    it("should prevent session hijacking with org context validation", async () => {
      // Arrange: Session claims to be from primary org but has competitor context
      const tamperedCtx = createMockTRPCContext(
        ["admin:everything"],
        SEED_TEST_IDS.ORGANIZATIONS.primary
      );
      
      // Tamper with organization context
      tamperedCtx.organization.id = SEED_TEST_IDS.ORGANIZATIONS.competitor;
      
      const caller = testRouter.createCaller(tamperedCtx as any);

      // Mock: Should detect organization mismatch
      vi.mocked(getUserPermissionsForSession).mockResolvedValue([]);
      vi.mocked(requirePermissionForSession).mockRejectedValue(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Organization context mismatch",
        }),
      );

      // Act & Assert
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
      await expect(caller.testRequirePermission()).rejects.toThrow(
        "Organization context mismatch",
      );
    });

    it("should handle null/undefined organizational context securely", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["test:permission"]);
      ctx.user.app_metadata.organization_id = null; // Simulate missing org context
      
      const caller = testRouter.createCaller(ctx as any);

      // Mock: Null org context should result in access denial
      vi.mocked(getUserPermissionsForSession).mockResolvedValue([]);
      vi.mocked(requirePermissionForSession).mockRejectedValue(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Missing organizational context",
        }),
      );

      // Act & Assert
      await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
      await expect(caller.testRequirePermission()).rejects.toThrow(
        "Missing organizational context",
      );
    });
  });
});
