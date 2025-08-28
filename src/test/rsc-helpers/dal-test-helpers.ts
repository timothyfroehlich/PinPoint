/**
 * DAL Test Helpers - RSC Integration
 * Enhanced Archetype 4: Repository/DAL Tests with real database
 */

import { SEED_TEST_IDS } from "../constants/seed-test-ids";

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
        organizationId: testOrgId,
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

  return mockContext;
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
