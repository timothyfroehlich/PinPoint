/**
 * DAL Test Helpers - RSC Integration
 * Integration (DAL): Repository/DAL tests with canonical resolver mocks
 * Updated to use getRequestAuthContext discriminated union pattern
 */

import { SEED_TEST_IDS } from "../constants/seed-test-ids";
import {
  SUBDOMAIN_HEADER,
  SUBDOMAIN_VERIFIED_HEADER,
} from "~/lib/subdomain-verification";

/**
 * Create mock auth context for DAL testing
 * Uses SEED_TEST_IDS for predictable testing
 */
export function createMockAuthContext(userId?: string, orgId?: string) {
  const testUserId = userId ?? SEED_TEST_IDS.USERS.ADMIN;
  const testOrgId = orgId ?? SEED_TEST_IDS.ORGANIZATIONS.primary;

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
 * Mock the canonical auth resolver for DAL functions
 * DAL functions use getRequestAuthContext() which returns discriminated union
 */
export function mockSupabaseAuth(mockContext = createMockAuthContext()) {
  // Mock the canonical auth resolver to return authorized state
  vi.mock("~/server/auth/context", () => ({
    getRequestAuthContext: vi.fn(async () => ({
      kind: "authorized",
      user: {
        id: mockContext.user.id,
        email: mockContext.user.email,
        name: mockContext.user.user_metadata?.name,
      },
      org: {
        id: mockContext.organizationId,
        name: "Test Organization",
        subdomain: "test-org",
      },
      membership: {
        id: "membership-test",
        role: {
          id: "role-admin",
          name: "Admin",
        },
        userId: mockContext.user.id,
        organizationId: mockContext.organizationId,
      },
    })),
    requireAuthorized: vi.fn(async () => ({
      kind: "authorized",
      user: {
        id: mockContext.user.id,
        email: mockContext.user.email,
        name: mockContext.user.user_metadata?.name,
      },
      org: {
        id: mockContext.organizationId,
        name: "Test Organization",
        subdomain: "test-org",
      },
      membership: {
        id: "membership-test",
        role: {
          id: "role-admin",
          name: "Admin",
        },
        userId: mockContext.user.id,
        organizationId: mockContext.organizationId,
      },
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
