/**
 * DAL Test Helpers - RSC Integration
 * Enhanced Archetype 4: Repository/DAL Tests with real database
 */

import { SEED_TEST_IDS } from "../constants/seed-test-ids";
import { SUBDOMAIN_HEADER, SUBDOMAIN_VERIFIED_HEADER } from "~/lib/subdomain-verification";

/**
 * Create mock auth context for DAL testing
 * Uses SEED_TEST_IDS for predictable testing
 */
export function createMockAuthContext(userId?: string, orgId?: string) {
  const testUserId = userId || SEED_TEST_IDS.USERS.ADMIN;
  const testOrgId = orgId || SEED_TEST_IDS.ORGANIZATIONS.primary;

  return {
    user: {
      id: testUserId,
      email: "tim.froehlich@example.com",
      user_metadata: {
        name: "Tim Froehlich",
      },
    },
    organizationId: testOrgId,
  };
}

/**
 * Mock the Supabase auth context for DAL functions
 * DAL functions call requireAuthContext() which needs auth
 */
export function mockSupabaseAuth(mockContext = createMockAuthContext()) {
  // Mock the createClient function to return auth context
  vi.mock("~/lib/supabase/server", () => ({
    createClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockContext.user },
          error: null,
        }),
      },
    })),
  }));

  // Also mock secure org validation for any code paths that use it
  vi.mock("~/lib/organization-context", () => ({
    requireMemberAccess: vi.fn(async () => ({
      organization: { id: mockContext.organizationId },
      user: { id: mockContext.user.id },
      accessLevel: "member",
      membership: { id: "membership-test", user_id: mockContext.user.id, organization_id: mockContext.organizationId },
    })),
    getOrganizationContext: vi.fn(async () => ({
      user: { id: mockContext.user.id },
      organization: { id: mockContext.organizationId },
      accessLevel: "member",
      membership: { role: { name: "Admin" } },
    })),
  }));

  return mockContext;
}

/**
 * Create headers representing a middleware-verified subdomain for DAL tests.
 */
export function createTrustedSubdomainHeaders(subdomain: string): Headers {
  return new Headers({
    [SUBDOMAIN_HEADER]: subdomain,
    [SUBDOMAIN_VERIFIED_HEADER]: "1",
  });
}

/**
 * Create headers with an untrusted subdomain (no verification header) for DAL tests.
 */
export function createUntrustedSubdomainHeaders(subdomain: string): Headers {
  return new Headers({
    [SUBDOMAIN_HEADER]: subdomain,
  });
}

/**
 * Test DAL function with proper auth context
 * Pattern for all DAL tests
 */
export async function testDALFunction<T>(
  dalFunction: () => Promise<T>,
  mockContext = createMockAuthContext(),
): Promise<T> {
  mockSupabaseAuth(mockContext);
  return await dalFunction();
}

/**
 * Assert organization scoping works correctly
 * Critical security pattern for all DAL functions
 */
export async function assertOrganizationScoping<
  T extends { organizationId?: string },
>(
  dalFunction: () => Promise<T[]>,
  expectedOrgId: string = SEED_TEST_IDS.ORGANIZATIONS.primary,
) {
  const results = await testDALFunction(dalFunction);

  // Verify all results belong to expected organization
  results.forEach((result) => {
    expect(result.organizationId).toBe(expectedOrgId);
  });

  return results;
}
