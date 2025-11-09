/**
 * Authenticated User Test Helpers - tRPC Router Testing Infrastructure
 *
 * Provides utilities for testing authenticated user scenarios with:
 * - Organization context from user membership
 * - Permission-based access control
 * - RLS policy testing for authenticated users
 * - Service factory mocking
 */

import { vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mockDeep } from "vitest-mock-extended";
import type { RLSOrganizationTRPCContext } from "~/server/api/trpc.base";
import type { DrizzleClient } from "~/server/db/drizzle";
import type { SupabaseServerClient } from "~/lib/supabase/server";
import type { PinPointSupabaseUser } from "~/lib/types";
import { SEED_TEST_IDS } from "../constants/seed-test-ids";
import { createMockDatabase } from "./service-test-helpers";
import {
  SUBDOMAIN_VERIFIED_HEADER,
  SUBDOMAIN_HEADER,
} from "~/lib/subdomain-verification";

/**
 * Authenticated test context with all tRPC middleware properties
 */
export interface AuthenticatedTestContext {
  mockContext: RLSOrganizationTRPCContext;
  mockDb: MockProxy<DrizzleClient>;
  mockSupabase: MockProxy<SupabaseServerClient>;
  user: PinPointSupabaseUser;
  organization: {
    id: string;
    name: string;
    subdomain: string;
  };
  membership: {
    id: string;
    organizationId: string;
    userId: string;
    role: {
      id: string;
      name: string;
    };
  };
  headers: Headers;
}

/**
 * Creates a mock tRPC context for authenticated user testing
 *
 * @param options - Configuration options
 * @returns AuthenticatedTestContext - Ready-to-use authenticated test context
 */
export function createAuthenticatedTestContext(
  options: {
    /** User ID to use for testing (defaults to admin) */
    userId?: string;
    /** Organization to use for testing (defaults to primary) */
    organizationId?: string;
    /** Subdomain to simulate (auto-generated if not provided) */
    subdomain?: string;
    /** User permissions (defaults to issue:create and issue:assign) */
    userPermissions?: string[];
    /** Additional headers to include */
    additionalHeaders?: Record<string, string>;
    /** User email (defaults to admin email) */
    userEmail?: string;
    /** User name (defaults to admin name) */
    userName?: string;
    /** Membership ID (defaults to admin membership) */
    membershipId?: string;
    /** Role ID (defaults to admin role) */
    roleId?: string;
    /** Role name (defaults to "Admin") */
    roleName?: string;
  } = {},
): AuthenticatedTestContext {
  const userId = options.userId ?? SEED_TEST_IDS.USERS.ADMIN;
  const orgId = options.organizationId ?? SEED_TEST_IDS.ORGANIZATIONS.primary;
  const subdomain = options.subdomain ?? "test-primary";
  const userPermissions = options.userPermissions ?? [
    "issue:create_full",
    "issue:assign",
  ];
  const userEmail = options.userEmail ?? SEED_TEST_IDS.EMAILS.ADMIN;
  const userName = options.userName ?? SEED_TEST_IDS.NAMES.ADMIN;
  const membershipId =
    options.membershipId ?? SEED_TEST_IDS.MEMBERSHIPS.ADMIN_PRIMARY;
  const roleId = options.roleId ?? SEED_TEST_IDS.ROLES.ADMIN_PRIMARY;
  const roleName = options.roleName ?? "Admin";

  // Create mock user
  const user: PinPointSupabaseUser = {
    id: userId,
    email: userEmail,
    app_metadata: {
      organizationId: orgId,
    },
    user_metadata: {
      name: userName,
    },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as unknown as PinPointSupabaseUser;

  // Create organization
  const organization = {
    id: orgId,
    name:
      orgId === SEED_TEST_IDS.ORGANIZATIONS.primary
        ? "Austin Pinball Collective"
        : "Competitor Arcade",
    subdomain,
  };

  // Create membership
  const membership = {
    id: membershipId,
    organizationId: orgId,
    userId: userId,
    role: {
      id: roleId,
      name: roleName,
    },
  };

  // Create request headers with subdomain
  const headers = new Headers({
    [SUBDOMAIN_HEADER]: subdomain,
    [SUBDOMAIN_VERIFIED_HEADER]: "1",
    ...options.additionalHeaders,
  });

  // Create mocked dependencies
  const mockDb = createMockDatabase();
  const mockSupabase = mockDeep<SupabaseServerClient>();

  // Mock organization lookup
  mockDb.query.organizations.findFirst.mockResolvedValue({
    id: orgId,
    name: organization.name,
    subdomain: organization.subdomain,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Mock membership lookup
  mockDb.query.memberships.findFirst.mockResolvedValue({
    id: membershipId,
    organization_id: orgId,
    user_id: userId,
    role_id: roleId,
    created_at: new Date(),
    updated_at: new Date(),
    role: {
      id: roleId,
      name: roleName,
      is_system: false,
      is_default: false,
      organization_id: orgId,
      created_at: new Date(),
      updated_at: new Date(),
      rolePermissions: [],
    },
  });

  // Create service factory stub
  const services = {
    createIssueActivityService: vi.fn().mockReturnValue({
      recordIssueCreated: vi.fn().mockResolvedValue(undefined),
      recordStatusChange: vi.fn().mockResolvedValue(undefined),
    }),
    createNotificationService: vi.fn().mockReturnValue({
      notifyMachineOwnerOfIssue: vi.fn().mockResolvedValue(undefined),
      notifyAssigneeOfIssue: vi.fn().mockResolvedValue(undefined),
    }),
    withOrganization: vi.fn().mockReturnThis(),
  };

  // Create authenticated tRPC context
  const mockContext: RLSOrganizationTRPCContext = {
    db: mockDb,
    user,
    supabase: mockSupabase,
    organizationId: orgId,
    organization,
    membership,
    userPermissions,
    services: services as never,
    headers,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown,
  } as unknown as RLSOrganizationTRPCContext;

  return {
    mockContext,
    mockDb,
    mockSupabase,
    user,
    organization,
    membership,
    headers,
  };
}

/**
 * Creates an authenticated test context with specific permissions
 *
 * @param permissions - Array of permission strings
 * @param options - Additional configuration options
 * @returns AuthenticatedTestContext
 */
export function createAuthenticatedTestContextWithPermissions(
  permissions: string[],
  options: Omit<
    Parameters<typeof createAuthenticatedTestContext>[0],
    "userPermissions"
  > = {},
): AuthenticatedTestContext {
  return createAuthenticatedTestContext({
    ...options,
    userPermissions: permissions,
  });
}

/**
 * Creates a basic permission test context (issue:create_basic only)
 *
 * @param options - Additional configuration options
 * @returns AuthenticatedTestContext
 */
export function createBasicPermissionTestContext(
  options: Omit<
    Parameters<typeof createAuthenticatedTestContext>[0],
    "userPermissions"
  > = {},
): AuthenticatedTestContext {
  return createAuthenticatedTestContext({
    ...options,
    userPermissions: ["issue:create_basic"],
    roleName: "Basic Member",
  });
}

/**
 * Creates a full permission test context (issue:create_full)
 *
 * @param options - Additional configuration options
 * @returns AuthenticatedTestContext
 */
export function createFullPermissionTestContext(
  options: Omit<
    Parameters<typeof createAuthenticatedTestContext>[0],
    "userPermissions"
  > = {},
): AuthenticatedTestContext {
  return createAuthenticatedTestContext({
    ...options,
    userPermissions: [
      "issue:create_full",
      "issue:create_basic",
      "issue:assign",
    ],
  });
}

/**
 * Authenticated user testing utilities
 */
export const authenticatedTestUtils = {
  /** Create authenticated user context */
  createContext: createAuthenticatedTestContext,

  /** Create context with specific permissions */
  withPermissions: createAuthenticatedTestContextWithPermissions,

  /** Create context with basic permissions */
  basicPermissions: createBasicPermissionTestContext,

  /** Create context with full permissions */
  fullPermissions: createFullPermissionTestContext,

  /** Test data constants */
  testIds: SEED_TEST_IDS,
};
