/**
 * Router Test Patterns
 *
 * Higher-level test patterns specifically for tRPC router testing.
 * Builds on permission test helpers to provide router-specific utilities.
 *
 * Features:
 * - Router procedure testing patterns
 * - Service integration testing patterns
 * - Input validation testing
 * - Error propagation testing
 * - Organization scoping validation
 */

import { vi, expect } from "vitest";

import {
  createAuthenticatedContext,
  createPublicContext,
  PERMISSION_SCENARIOS,
  type VitestMockContext,
} from "./permissionTestHelpers";

import type { AppRouter } from "~/server/api/root";

/**
 * Router procedure test context with common setup
 */
export interface RouterTestContext {
  authenticatedCaller: ReturnType<AppRouter["createCaller"]>;
  publicCaller: ReturnType<AppRouter["createCaller"]>;
  adminCaller: ReturnType<AppRouter["createCaller"]>;
  readOnlyCaller: ReturnType<AppRouter["createCaller"]>;
  authContext: ReturnType<typeof createAuthenticatedContext>;
  publicContext: ReturnType<typeof createPublicContext>;
}

/**
 * Create comprehensive router test context
 */
export function createRouterTestContext(router: AppRouter): RouterTestContext {
  const authContext = createAuthenticatedContext(
    PERMISSION_SCENARIOS.MEMBER.permissions,
  );
  const publicContext = createPublicContext();
  const adminContext = createAuthenticatedContext(
    PERMISSION_SCENARIOS.ADMIN.permissions,
  );
  const readOnlyContext = createAuthenticatedContext(
    PERMISSION_SCENARIOS.READ_ONLY.permissions,
  );

  return {
    authenticatedCaller: router.createCaller(authContext as any),
    publicCaller: router.createCaller(publicContext as any),
    adminCaller: router.createCaller(adminContext as any),
    readOnlyCaller: router.createCaller(readOnlyContext as any),
    authContext,
    publicContext,
  };
}

/**
 * Test pattern for router procedures that require authentication
 */
export function testAuthenticatedProcedure<T>(
  testName: string,
  procedureCall: (context: RouterTestContext) => Promise<T>,
  options: {
    requiredPermissions?: string[];
    expectedResult?: (result: T) => void;
    mockSetup?: (context: VitestMockContext) => void;
  } = {},
) {
  return async () => {
    const router = await import("~/server/api/root").then((m) => m.appRouter);
    const context = createRouterTestContext(router);

    // Apply mock setup if provided
    if (options.mockSetup) {
      options.mockSetup(context.authContext);
    }

    // Test unauthenticated access is denied
    await expect(
      procedureCall({
        ...context,
        authenticatedCaller: context.publicCaller, // Use public caller for auth test
      }),
    ).rejects.toThrow("UNAUTHORIZED");

    // Test authenticated access succeeds
    const result = await procedureCall(context);

    if (options.expectedResult) {
      options.expectedResult(result);
    }

    return result;
  };
}

/**
 * Test pattern for public procedures
 */
export function testPublicProcedure<T>(
  testName: string,
  procedureCall: (context: RouterTestContext) => Promise<T>,
  options: {
    expectedResult?: (result: T) => void;
    mockSetup?: (context: VitestMockContext) => void;
  } = {},
) {
  return async () => {
    const router = await import("~/server/api/root").then((m) => m.appRouter);
    const context = createRouterTestContext(router);

    if (options.mockSetup) {
      options.mockSetup(context.publicContext);
    }

    const result = await procedureCall(context);

    if (options.expectedResult) {
      options.expectedResult(result);
    }

    return result;
  };
}

/**
 * Test pattern for admin-only procedures
 */
export function testAdminOnlyProcedure<T>(
  testName: string,
  procedureCall: (context: RouterTestContext) => Promise<T>,
  options: {
    requiredPermission?: string;
    expectedResult?: (result: T) => void;
    mockSetup?: (context: VitestMockContext) => void;
  } = {},
) {
  return async () => {
    const router = await import("~/server/api/root").then((m) => m.appRouter);
    const context = createRouterTestContext(router);

    if (options.mockSetup) {
      options.mockSetup(context.authContext);
    }

    // Test non-admin access is denied
    await expect(
      procedureCall({
        ...context,
        adminCaller: context.authenticatedCaller, // Use regular user for permission test
      }),
    ).rejects.toThrow("FORBIDDEN");

    // Test admin access succeeds
    const result = await procedureCall(context);

    if (options.expectedResult) {
      options.expectedResult(result);
    }

    return result;
  };
}

/**
 * Test pattern for service integration
 */
export function testServiceIntegration(
  serviceName: keyof VitestMockContext["services"],
  methodName: string,
  options: {
    mockReturnValue?: any;
    expectedCallArgs?: any[];
    mockSetup?: (mockService: any) => void;
  } = {},
) {
  return (context: VitestMockContext) => {
    const mockService = {
      [methodName]: vi.fn().mockResolvedValue(options.mockReturnValue),
    };

    if (options.mockSetup) {
      options.mockSetup(mockService);
    }

    vi.mocked(context.services[serviceName] as any).mockReturnValue(
      mockService,
    );

    return {
      mockService,
      expectServiceCalled: (expectedArgs?: any[]) => {
        expect(context.services[serviceName]).toHaveBeenCalled();
        if (expectedArgs) {
          expect(mockService[methodName]).toHaveBeenCalledWith(...expectedArgs);
        } else {
          expect(mockService[methodName]).toHaveBeenCalled();
        }
      },
    };
  };
}

/**
 * Test pattern for input validation
 */
export interface InputValidationCase {
  name: string;
  input: any;
  expectedError?: string;
  shouldSucceed?: boolean;
}

export function testInputValidation<T>(
  procedureCall: (input: any, context: RouterTestContext) => Promise<T>,
  validationCases: InputValidationCase[],
) {
  return async () => {
    const router = await import("~/server/api/root").then((m) => m.appRouter);
    const context = createRouterTestContext(router);

    for (const testCase of validationCases) {
      const { name, input, expectedError, shouldSucceed = false } = testCase;

      if (shouldSucceed) {
        // Should not throw
        await expect(procedureCall(input, context)).resolves.toBeDefined();
      } else {
        // Should throw with expected error
        const promise = procedureCall(input, context);
        if (expectedError) {
          await expect(promise).rejects.toThrow(expectedError);
        } else {
          await expect(promise).rejects.toThrow();
        }
      }
    }
  };
}

/**
 * Test pattern for organization scoping
 */
export function testOrganizationScoping<T>(
  procedureCall: (context: RouterTestContext) => Promise<T>,
  options: {
    setupSameOrg?: (context: VitestMockContext) => void;
    setupDifferentOrg?: (context: VitestMockContext) => void;
    expectedSameOrgResult?: (result: T) => void;
  } = {},
) {
  return async () => {
    const router = await import("~/server/api/root").then((m) => m.appRouter);
    const context = createRouterTestContext(router);

    // Test same organization access
    if (options.setupSameOrg) {
      options.setupSameOrg(context.authContext);
    }

    const sameOrgResult = await procedureCall(context);
    if (options.expectedSameOrgResult) {
      options.expectedSameOrgResult(sameOrgResult);
    }

    // Test different organization access is blocked
    const crossOrgContext = createAuthenticatedContext(
      PERMISSION_SCENARIOS.MEMBER.permissions,
    );
    crossOrgContext.user.app_metadata.organization_id = "other-org";
    crossOrgContext.organization = {
      id: "other-org",
      name: "Other Organization",
      subdomain: "other",
    };

    if (options.setupDifferentOrg) {
      options.setupDifferentOrg(crossOrgContext);
    }

    const crossOrgCaller = router.createCaller(crossOrgContext as any);

    // Should either throw or return empty/filtered results
    await expect(
      procedureCall({
        ...context,
        authenticatedCaller: crossOrgCaller,
      }),
    ).rejects.toThrow();
  };
}

/**
 * Common mock data factory for router tests
 */
export const RouterTestMocks = {
  issue: (overrides: any = {}) => ({
    id: "issue-1",
    title: "Test Issue",
    description: "Test Description",
    organizationId: "org-1",
    machineId: "machine-1",
    statusId: "status-1",
    priorityId: "priority-1",
    createdById: "user-1",
    assignedToId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  machine: (overrides: any = {}) => ({
    id: "machine-1",
    name: "Test Machine",
    organizationId: "org-1",
    locationId: "location-1",
    modelId: "model-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  location: (overrides: any = {}) => ({
    id: "location-1",
    name: "Test Location",
    organizationId: "org-1",
    address: "123 Test St",
    city: "Test City",
    state: "TS",
    zipCode: "12345",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  user: (overrides: any = {}) => ({
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  membership: (overrides: any = {}) => ({
    id: "membership-1",
    userId: "user-1",
    organizationId: "org-1",
    roleId: "role-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    role: {
      id: "role-1",
      name: "Member Role",
      organizationId: "org-1",
      permissions: [],
    },
    ...overrides,
  }),

  organization: (overrides: any = {}) => ({
    id: "org-1",
    name: "Test Organization",
    subdomain: "test",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};

/**
 * Comprehensive router test suite builder
 */
export interface RouterTestSuiteOptions<TInput, TOutput> {
  procedureName: string;
  procedureCall: (
    input: TInput,
    context: RouterTestContext,
  ) => Promise<TOutput>;
  validInput: TInput;
  invalidInputs?: InputValidationCase[];
  requiredPermission?: string;
  isPublic?: boolean;
  isAdminOnly?: boolean;
  testOrganizationScoping?: boolean;
  mockSetup?: (context: VitestMockContext) => void;
  expectedResult?: (result: TOutput) => void;
}

export function createRouterTestSuite<TInput, TOutput>(
  options: RouterTestSuiteOptions<TInput, TOutput>,
) {
  const {
    procedureName,
    procedureCall,
    validInput,
    invalidInputs = [],
    requiredPermission,
    isPublic = false,
    isAdminOnly = false,
    testOrganizationScoping = false,
    mockSetup,
    expectedResult,
  } = options;

  return () => {
    describe(procedureName, () => {
      if (!isPublic) {
        test(
          "requires authentication",
          testAuthenticatedProcedure(
            "authenticated access",
            (context) => procedureCall(validInput, context),
            { mockSetup, expectedResult },
          ),
        );
      } else {
        test(
          "allows public access",
          testPublicProcedure(
            "public access",
            (context) => procedureCall(validInput, context),
            { mockSetup, expectedResult },
          ),
        );
      }

      if (isAdminOnly) {
        test(
          "requires admin permissions",
          testAdminOnlyProcedure(
            "admin access",
            (context) => procedureCall(validInput, context),
            { requiredPermission, mockSetup, expectedResult },
          ),
        );
      }

      if (invalidInputs.length > 0) {
        test(
          "validates input",
          testInputValidation(procedureCall, invalidInputs),
        );
      }

      if (testOrganizationScoping) {
        test(
          "enforces organization scoping",
          testOrganizationScoping(
            (context) => procedureCall(validInput, context),
            { setupSameOrg: mockSetup },
          ),
        );
      }
    });
  };
}
