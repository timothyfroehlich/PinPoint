/**
 * Permission Testing Utilities
 *
 * Consolidated utilities for testing authentication and authorization patterns
 * across router tests. Reduces duplication and standardizes permission testing.
 *
 * Features:
 * - Authentication requirement testing
 * - Permission validation testing
 * - Role-based access control testing
 * - Organization scoping validation
 * - Standard permission mock configurations
 */

import { TRPCError } from "@trpc/server";
import { vi } from "vitest";

import {
  createVitestMockContext,
  type VitestMockContext,
} from "./vitestMockContext";

import type { AppRouter } from "~/server/api/root";

import {
  getUserPermissionsForSession,
  requirePermissionForSession,
} from "~/server/auth/permissions";

// Mock permissions system if not already mocked
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    getUserPermissionsForSession: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});

/**
 * Standard user roles with common permission sets
 */
export const PERMISSION_SCENARIOS = {
  ADMIN: {
    name: "Admin",
    permissions: [
      "organization:manage",
      "user:manage",
      "role:manage",
      "permission:manage",
      "issue:create",
      "issue:edit",
      "issue:view",
      "issue:delete",
      "issue:assign",
      "machine:create",
      "machine:edit",
      "machine:view",
      "machine:delete",
      "collection:create",
      "collection:edit",
      "collection:view",
      "location:create",
      "location:edit",
      "location:view",
    ] as const,
  },
  MEMBER: {
    name: "Member",
    permissions: [
      "issue:create",
      "issue:edit",
      "issue:view",
      "machine:view",
      "collection:view",
      "location:view",
    ] as const,
  },
  VIEWER: {
    name: "Viewer",
    permissions: [
      "issue:view",
      "machine:view",
      "collection:view",
      "location:view",
    ] as const,
  },
  READ_ONLY: {
    name: "Read Only",
    permissions: ["issue:view"] as const,
  },
  NO_PERMISSIONS: {
    name: "No Permissions",
    permissions: [] as const,
  },
} as const;

/**
 * Create authenticated context with specific permissions
 */
export function createAuthenticatedContext(
  permissions: readonly string[] = PERMISSION_SCENARIOS.MEMBER.permissions,
): VitestMockContext & {
  user: NonNullable<VitestMockContext["user"]>;
  organization: NonNullable<VitestMockContext["organization"]>;
  membership: any;
  userPermissions: string[];
} {
  const mockContext = createVitestMockContext();

  // Override with authenticated user
  const authenticatedUser = {
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

  const organization = {
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

  // Mock database query for membership lookup
  vi.mocked(mockContext.db.membership.findFirst).mockResolvedValue(
    membershipData as any,
  );

  // Mock the permissions system
  vi.mocked(getUserPermissionsForSession).mockResolvedValue([...permissions]);

  // Mock requirePermissionForSession - throws when permission is missing
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
    user: authenticatedUser as any,
    organization,
    membership: membershipData,
    userPermissions: [...permissions],
  };
}

/**
 * Create unauthenticated (public) context
 */
export function createPublicContext(): VitestMockContext & {
  user: null;
  organization: NonNullable<VitestMockContext["organization"]> | null;
} {
  const mockContext = createVitestMockContext();

  return {
    ...mockContext,
    user: null,
    organization: {
      id: "org-1",
      name: "Test Organization",
      subdomain: "test",
    },
  };
}

/**
 * Create context with specific organization (useful for cross-org testing)
 */
export function createCrossOrgContext(
  organizationId = "other-org",
  permissions: readonly string[] = PERMISSION_SCENARIOS.MEMBER.permissions,
): VitestMockContext & {
  user: NonNullable<VitestMockContext["user"]>;
  organization: NonNullable<VitestMockContext["organization"]>;
} {
  const authCtx = createAuthenticatedContext(permissions);

  // Override organization to different org
  authCtx.user.app_metadata = {
    ...authCtx.user.app_metadata,
    organization_id: organizationId,
  };

  authCtx.organization = {
    id: organizationId,
    name: "Other Organization",
    subdomain: "other",
  };

  return authCtx;
}

/**
 * Permission test case builder - creates standard test scenarios
 */
export interface PermissionTestCase {
  name: string;
  permissions: readonly string[];
  shouldSucceed: boolean;
  expectedError?: string;
}

export function createPermissionTestCases(
  requiredPermission: string,
  additionalCases: PermissionTestCase[] = [],
): PermissionTestCase[] {
  const standardCases: PermissionTestCase[] = [
    {
      name: "admin with all permissions",
      permissions: PERMISSION_SCENARIOS.ADMIN.permissions,
      shouldSucceed: true,
    },
    {
      name: "user with required permission",
      permissions: [requiredPermission, "issue:view"],
      shouldSucceed: true,
    },
    {
      name: "user without required permission",
      permissions: PERMISSION_SCENARIOS.VIEWER.permissions.filter(
        (p) => p !== requiredPermission,
      ),
      shouldSucceed: false,
      expectedError: `Missing required permission: ${requiredPermission}`,
    },
    {
      name: "user with no permissions",
      permissions: PERMISSION_SCENARIOS.NO_PERMISSIONS.permissions,
      shouldSucceed: false,
      expectedError: `Missing required permission: ${requiredPermission}`,
    },
  ];

  return [...standardCases, ...additionalCases];
}

/**
 * Standard authentication requirement test
 * Tests that a procedure requires authentication
 */
export async function expectAuthenticationRequired<TRouter extends AppRouter>(
  routerCall: (caller: TRouter) => Promise<any>,
  router: TRouter,
): Promise<void> {
  const publicContext = createPublicContext();
  const caller = router.createCaller({ ...publicContext, user: null } as any);

  await expect(routerCall(caller)).rejects.toThrow("UNAUTHORIZED");
}

/**
 * Standard organization requirement test
 * Tests that a procedure requires organization context
 */
export async function expectOrganizationRequired<TRouter extends AppRouter>(
  routerCall: (caller: TRouter) => Promise<any>,
  router: TRouter,
): Promise<void> {
  const authContext = createAuthenticatedContext();
  const caller = router.createCaller({
    ...authContext,
    organization: null,
  } as any);

  await expect(routerCall(caller)).rejects.toThrow();
}

/**
 * Standard permission requirement test
 * Tests that a procedure requires specific permissions
 */
export async function expectPermissionRequired<TRouter extends AppRouter>(
  routerCall: (caller: TRouter) => Promise<any>,
  router: TRouter,
  requiredPermission: string,
): Promise<void> {
  const contextWithoutPermission = createAuthenticatedContext(
    PERMISSION_SCENARIOS.VIEWER.permissions.filter(
      (p) => p !== requiredPermission,
    ),
  );
  const caller = router.createCaller(contextWithoutPermission as any);

  await expect(routerCall(caller)).rejects.toThrow(
    `Missing required permission: ${requiredPermission}`,
  );
}

/**
 * Standard organization isolation test
 * Tests that resources are scoped to the user's organization
 */
export async function expectOrganizationIsolation<TRouter extends AppRouter>(
  routerCall: (caller: TRouter) => Promise<any>,
  router: TRouter,
  permissions: readonly string[] = PERMISSION_SCENARIOS.MEMBER.permissions,
): Promise<void> {
  const crossOrgContext = createCrossOrgContext("other-org", permissions);
  const caller = router.createCaller(crossOrgContext as any);

  // Should either throw or return empty results
  await expect(routerCall(caller)).rejects.toThrow();
}

/**
 * Comprehensive permission test suite
 * Runs standard auth/authz tests for a procedure
 */
export interface PermissionTestSuiteOptions<TRouter extends AppRouter> {
  routerCall: (caller: TRouter) => Promise<any>;
  router: TRouter;
  requiredPermission?: string;
  requiresOrganization?: boolean;
  testOrganizationIsolation?: boolean;
  customPermissionCases?: PermissionTestCase[];
}

export function createPermissionTestSuite<TRouter extends AppRouter>(
  name: string,
  options: PermissionTestSuiteOptions<TRouter>,
) {
  const {
    routerCall,
    router,
    requiredPermission,
    requiresOrganization = true,
    testOrganizationIsolation = false,
    customPermissionCases = [],
  } = options;

  return () => {
    describe(`${name} - Permission Tests`, () => {
      test("requires authentication", async () => {
        await expectAuthenticationRequired(routerCall, router);
      });

      if (requiresOrganization) {
        test("requires organization context", async () => {
          await expectOrganizationRequired(routerCall, router);
        });
      }

      if (requiredPermission) {
        test(`requires ${requiredPermission} permission`, async () => {
          await expectPermissionRequired(
            routerCall,
            router,
            requiredPermission,
          );
        });

        // Test permission scenarios
        const permissionCases = createPermissionTestCases(
          requiredPermission,
          customPermissionCases,
        );

        permissionCases.forEach(
          ({ name, permissions, shouldSucceed, expectedError }) => {
            test(`${shouldSucceed ? "allows" : "denies"} ${name}`, async () => {
              const context = createAuthenticatedContext(permissions);
              const caller = router.createCaller(context as any);

              if (shouldSucceed) {
                // Should not throw
                await expect(routerCall(caller)).resolves.toBeDefined();
              } else {
                await expect(routerCall(caller)).rejects.toThrow(
                  expectedError ?? "FORBIDDEN",
                );
              }
            });
          },
        );
      }

      if (testOrganizationIsolation) {
        test("enforces organization isolation", async () => {
          await expectOrganizationIsolation(
            routerCall,
            router,
            requiredPermission
              ? [requiredPermission]
              : PERMISSION_SCENARIOS.MEMBER.permissions,
          );
        });
      }
    });
  };
}

/**
 * Quick permission test helpers for common scenarios
 */
export const PermissionTests = {
  /**
   * Test that procedure requires authentication
   */
  requiresAuth:
    <TRouter extends AppRouter>(
      routerCall: (caller: TRouter) => Promise<any>,
      router: TRouter,
    ) =>
    async () => {
      await expectAuthenticationRequired(routerCall, router);
    },

  /**
   * Test that procedure requires specific permission
   */
  requiresPermission:
    <TRouter extends AppRouter>(
      routerCall: (caller: TRouter) => Promise<any>,
      router: TRouter,
      permission: string,
    ) =>
    async () => {
      await expectPermissionRequired(routerCall, router, permission);
    },

  /**
   * Test that procedure enforces organization boundaries
   */
  enforcesOrgIsolation:
    <TRouter extends AppRouter>(
      routerCall: (caller: TRouter) => Promise<any>,
      router: TRouter,
    ) =>
    async () => {
      await expectOrganizationIsolation(routerCall, router);
    },

  /**
   * Full permission test suite
   */
  fullSuite: <TRouter extends AppRouter>(
    name: string,
    options: PermissionTestSuiteOptions<TRouter>,
  ) => createPermissionTestSuite(name, options),
};

/**
 * Helper to create mock database setup for permission tests
 */
export function setupPermissionMocks(
  context: VitestMockContext,
  mockData: {
    issue?: any;
    machine?: any;
    location?: any;
    membership?: any;
    [key: string]: any;
  },
) {
  Object.entries(mockData).forEach(([key, data]) => {
    if (key === "issue") {
      context.db.issue.findFirst.mockResolvedValue(data);
      context.db.issue.findUnique.mockResolvedValue(data);
    } else if (key === "machine") {
      context.db.machine.findFirst.mockResolvedValue(data);
      context.db.machine.findUnique.mockResolvedValue(data);
    } else if (key === "location") {
      context.db.location.findFirst.mockResolvedValue(data);
      context.db.location.findUnique.mockResolvedValue(data);
    } else if (key === "membership") {
      context.db.membership.findFirst.mockResolvedValue(data);
    }
    // Add more entity types as needed
  });
}
