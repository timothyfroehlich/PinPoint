/**
 * RLS Test Context Helper
 *
 * Provides utilities for testing Row-Level Security (RLS) organizational isolation
 * with Supabase authentication mocking. This module creates test contexts that
 * simulate authenticated users with specific organizationId in app_metadata.
 *
 * Key Features:
 * - Mock Supabase auth to return specific user with organizationId
 * - Support for multiple organization contexts in same test
 * - Integration with existing PGlite test patterns
 * - Memory-safe using worker-scoped database patterns
 * - RLS policy enforcement validation
 *
 * Usage:
 * ```typescript
 * test("organizational isolation", async ({ workerDb }) => {
 *   await withIsolatedTest(workerDb, async (db) => {
 *     await withTestUser("user-1", "org-1", async () => {
 *       // All Drizzle queries automatically filtered to org-1 via RLS
 *       const issues = await db.query.issues.findMany();
 *       expect(issues.every(issue => issue.organizationId === "org-1")).toBe(true);
 *     });
 *   });
 * });
 * ```
 */

import { vi } from "vitest";
import type { TestDatabase } from "./pglite-test-setup";

// Types for Supabase auth mocking
interface MockSupabaseUser {
  id: string;
  email: string;
  app_metadata: {
    organizationId: string;
    role?: string;
  };
  user_metadata: {
    name?: string;
    avatar_url?: string;
  };
  aud: string;
  created_at: string;
  updated_at: string;
}

interface MockSupabaseAuthResponse {
  data: {
    user: MockSupabaseUser | null;
  };
  error: null | Error;
}

interface MockSupabaseClient {
  auth: {
    getUser: () => Promise<MockSupabaseAuthResponse>;
    getSession: () => Promise<{
      data: { session: { user: MockSupabaseUser } | null };
    }>;
  };
}

/**
 * Test user context for RLS testing
 * Contains all data needed to simulate an authenticated user in specific organization
 */
export interface RLSTestUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: string;
  supabaseUser: MockSupabaseUser;
}

/**
 * RLS context state management
 * Tracks current user context for mock Supabase client
 */
class RLSContextManager {
  private currentUser: RLSTestUser | null = null;
  private originalCreateClient: unknown = null;

  setUser(user: RLSTestUser): void {
    this.currentUser = user;
  }

  clearUser(): void {
    this.currentUser = null;
  }

  getCurrentUser(): RLSTestUser | null {
    return this.currentUser;
  }

  getMockSupabaseResponse(): MockSupabaseAuthResponse {
    if (!this.currentUser) {
      return {
        data: { user: null },
        error: null,
      };
    }

    return {
      data: { user: this.currentUser.supabaseUser },
      error: null,
    };
  }

  getMockSupabaseClient(): MockSupabaseClient {
    return {
      auth: {
        getUser: async () => this.getMockSupabaseResponse(),
        getSession: async () => ({
          data: {
            session: this.currentUser
              ? { user: this.currentUser.supabaseUser }
              : null,
          },
        }),
      },
    };
  }

  setOriginalCreateClient(original: unknown): void {
    this.originalCreateClient = original;
  }

  getOriginalCreateClient(): unknown {
    return this.originalCreateClient;
  }
}

// Global context manager instance
const rlsContextManager = new RLSContextManager();

/**
 * Create a test user with specified organization context
 *
 * @param userId - Unique user identifier
 * @param organizationId - Organization the user belongs to
 * @param options - Additional user configuration
 * @returns Complete test user context
 */
export function createTestUser(
  userId: string,
  organizationId: string,
  options: {
    email?: string;
    name?: string;
    role?: string;
  } = {},
): RLSTestUser {
  const {
    email = `${userId}@test.dev`,
    name = `Test User ${userId}`,
    role = "Member",
  } = options;

  const supabaseUser: MockSupabaseUser = {
    id: userId,
    email,
    app_metadata: {
      organizationId,
      role,
    },
    user_metadata: {
      name,
      avatar_url: null,
    },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    id: userId,
    email,
    name,
    organizationId,
    role,
    supabaseUser,
  };
}

/**
 * Execute operations in the context of a specific test user
 *
 * This function mocks the Supabase createClient to return authentication
 * data for the specified user, enabling RLS policies to filter data
 * based on the user's organizationId from app_metadata.
 *
 * @param userId - User identifier
 * @param organizationId - Organization context
 * @param operation - Async operation to execute
 * @param options - User configuration options
 * @returns Result of the operation
 */
export async function withTestUser<T>(
  userId: string,
  organizationId: string,
  operation: () => Promise<T>,
  options: {
    email?: string;
    name?: string;
    role?: string;
  } = {},
): Promise<T> {
  const testUser = createTestUser(userId, organizationId, options);

  // Set current user context
  rlsContextManager.setUser(testUser);

  try {
    // Mock the Supabase client creation
    const mockCreateClient = vi
      .fn()
      .mockResolvedValue(rlsContextManager.getMockSupabaseClient());

    // Store original and apply mock
    const { createClient } = await import("~/lib/supabase/server");
    rlsContextManager.setOriginalCreateClient(createClient);

    vi.doMock("~/lib/supabase/server", () => ({
      createClient: mockCreateClient,
      createAdminClient: vi
        .fn()
        .mockResolvedValue(rlsContextManager.getMockSupabaseClient()),
    }));

    // Execute the operation with mocked auth context
    const result = await operation();
    return result;
  } finally {
    // Clean up context
    rlsContextManager.clearUser();
    vi.doUnmock("~/lib/supabase/server");
  }
}

/**
 * Execute database operations with RLS session context
 *
 * Sets PostgreSQL session variables that RLS policies read to determine
 * user context and organizational boundaries. This simulates how Supabase
 * auth would set these variables in a real environment.
 *
 * @param db - Database instance
 * @param userId - Current user ID
 * @param organizationId - Current organization ID
 * @param operation - Database operation to execute
 * @param options - Additional session context
 * @returns Result of the operation
 */
export async function withRLSContext<T>(
  db: TestDatabase,
  userId: string,
  organizationId: string,
  operation: (db: TestDatabase) => Promise<T>,
  options: {
    role?: string;
    email?: string;
  } = {},
): Promise<T> {
  const { role = "authenticated", email = `${userId}@test.dev` } = options;

  // Set PostgreSQL session variables that RLS policies read
  await db.execute(`SET app.current_user_id = '${userId}'`);
  await db.execute(`SET app.current_organization_id = '${organizationId}'`);
  await db.execute(`SET app.current_user_role = '${role}'`);
  await db.execute(`SET app.current_user_email = '${email}'`);

  try {
    return await operation(db);
  } finally {
    // Clear session variables
    await db.execute(`RESET app.current_user_id`);
    await db.execute(`RESET app.current_organization_id`);
    await db.execute(`RESET app.current_user_role`);
    await db.execute(`RESET app.current_user_email`);
  }
}

/**
 * Combined test context for both Supabase auth and RLS session
 *
 * Provides the most complete testing environment by mocking both:
 * 1. Supabase authentication (app_metadata.organizationId)
 * 2. PostgreSQL session context (app.current_* variables)
 *
 * This ensures RLS policies work exactly as they would in production.
 *
 * @param db - Database instance
 * @param userId - User identifier
 * @param organizationId - Organization context
 * @param operation - Operation to execute with full context
 * @param options - User and session configuration
 * @returns Result of the operation
 */
export async function withFullRLSContext<T>(
  db: TestDatabase,
  userId: string,
  organizationId: string,
  operation: (db: TestDatabase) => Promise<T>,
  options: {
    email?: string;
    name?: string;
    role?: string;
  } = {},
): Promise<T> {
  return await withTestUser(
    userId,
    organizationId,
    async () => {
      return await withRLSContext(db, userId, organizationId, operation, {
        role: options.role,
        email: options.email,
      });
    },
    options,
  );
}

/**
 * Quick access to common test user scenarios
 */
export const TestUsers = {
  admin: (orgId: string) =>
    createTestUser("admin-user", orgId, {
      role: "Admin",
      name: "Test Admin",
      email: "admin@test.dev",
    }),

  member: (orgId: string) =>
    createTestUser("member-user", orgId, {
      role: "Member",
      name: "Test Member",
      email: "member@test.dev",
    }),

  technician: (orgId: string) =>
    createTestUser("tech-user", orgId, {
      role: "Technician",
      name: "Test Technician",
      email: "tech@test.dev",
    }),

  owner: (orgId: string) =>
    createTestUser("owner-user", orgId, {
      role: "Owner",
      name: "Test Owner",
      email: "owner@test.dev",
    }),
} as const;

/**
 * Organizational test contexts for common scenarios
 */
export const TestOrganizations = {
  org1: "test-org-1",
  org2: "test-org-2",
  org3: "test-org-3",
} as const;

/**
 * Verify RLS enforcement by attempting cross-organization access
 *
 * This utility function tests that RLS policies properly isolate data
 * by switching between organization contexts and verifying isolation.
 *
 * @param db - Database instance
 * @param testFunction - Function that queries organization-scoped data
 * @param org1Id - First organization ID
 * @param org2Id - Second organization ID
 * @returns Test results showing isolation is enforced
 */
export async function verifyOrganizationalIsolation<
  T extends { organizationId: string }[],
>(
  db: TestDatabase,
  testFunction: (db: TestDatabase) => Promise<T>,
  org1Id: string = TestOrganizations.org1,
  org2Id: string = TestOrganizations.org2,
): Promise<{
  org1Results: T;
  org2Results: T;
  isolationEnforced: boolean;
}> {
  // Test data access from org1 perspective
  const org1Results = await withRLSContext(
    db,
    "test-user-1",
    org1Id,
    testFunction,
  );

  // Test data access from org2 perspective
  const org2Results = await withRLSContext(
    db,
    "test-user-2",
    org2Id,
    testFunction,
  );

  // Verify isolation: each org should only see its own data
  const org1HasOnlyOwnData = org1Results.every(
    (item) => item.organizationId === org1Id,
  );
  const org2HasOnlyOwnData = org2Results.every(
    (item) => item.organizationId === org2Id,
  );
  const noDataLeakage =
    !org1Results.some((item) => item.organizationId === org2Id) &&
    !org2Results.some((item) => item.organizationId === org1Id);

  return {
    org1Results,
    org2Results,
    isolationEnforced:
      org1HasOnlyOwnData && org2HasOnlyOwnData && noDataLeakage,
  };
}

/**
 * Mock next/headers for Server Component testing
 *
 * Required when testing Server Components that use cookies() from next/headers.
 * Should be called in test setup before testing auth-dependent components.
 */
export function mockNextHeaders(): void {
  vi.mock("next/headers", () => ({
    cookies: () => ({
      get: vi.fn().mockReturnValue({ value: "fake-session" }),
      set: vi.fn(),
      remove: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
      setAll: vi.fn(),
    }),
  }));
}

/**
 * Export the context manager for advanced use cases
 */
export { rlsContextManager as RLSContextManager };

/**
 * Type exports for external usage
 */
export type { RLSTestUser, MockSupabaseUser, MockSupabaseClient };
