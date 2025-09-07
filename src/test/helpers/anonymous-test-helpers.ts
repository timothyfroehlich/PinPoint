/**
 * Anonymous User Test Helpers - RLS Testing Infrastructure
 *
 * Provides utilities for testing anonymous user scenarios with:
 * - Organization context from subdomain resolution
 * - Cross-organization access validation
 * - RLS policy testing for anonymous users
 * - Session variable setup for database-level scoping
 */

import { vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mockDeep } from "vitest-mock-extended";
import type { TRPCContext } from "~/server/api/trpc.base";
import type { DrizzleClient } from "~/server/db/drizzle";
import type { SupabaseServerClient } from "~/lib/supabase/server";
import type { AnonymousTestContext } from "~/lib/types";
import { SEED_TEST_IDS } from "../constants/seed-test-ids";
import { createMockDatabase } from "./service-test-helpers";
import {
  SUBDOMAIN_VERIFIED_HEADER,
  SUBDOMAIN_HEADER,
} from "~/lib/subdomain-verification";

// AnonymousTestContext has been moved to ~/lib/types/test.ts for centralization

/**
 * Creates a mock tRPC context for anonymous user testing
 *
 * @param options - Configuration options
 * @returns AnonymousTestContext - Ready-to-use anonymous test context
 */
export function createAnonymousTestContext(
  options: {
    /** Organization to use for testing (defaults to primary) */
    organizationId?: string;
    /** Subdomain to simulate (auto-generated if not provided) */
    subdomain?: string;
    /** Additional headers to include */
    additionalHeaders?: Record<string, string>;
  } = {},
): AnonymousTestContext {
  const orgId = options.organizationId ?? SEED_TEST_IDS.ORGANIZATIONS.primary;
  const subdomain = options.subdomain ?? "test-primary";

  // Create mock organization
  const organization = {
    id: orgId,
    name:
      orgId === SEED_TEST_IDS.ORGANIZATIONS.primary
        ? "Austin Pinball Collective"
        : "Competitor Arcade",
    subdomain,
  };

  // Create request headers with subdomain
  // Include both headers to simulate middleware-verified subdomain
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

  // Create anonymous tRPC context
  const mockContext: Partial<TRPCContext> = {
    db: mockDb,
    user: null, // Anonymous user
    supabase: mockSupabase,
    organizationId: null, // No auth-based org context
    organization, // Resolved from subdomain
    headers,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown,
  };

  return {
    mockContext,
    mockDb,
    mockSupabase,
    organization,
    headers,
  };
}

/**
 * Creates an anonymous test context for cross-organization scenarios
 *
 * @returns Object with contexts for both organizations
 */
export function createCrossOrgTestContext(): {
  primaryContext: AnonymousTestContext;
  competitorContext: AnonymousTestContext;
} {
  const primaryContext = createAnonymousTestContext({
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    subdomain: "primary-test",
  });

  const competitorContext = createAnonymousTestContext({
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
    subdomain: "competitor-test",
  });

  return { primaryContext, competitorContext };
}

/**
 * Mocks session variable setup for RLS testing
 *
 * @param mockDb - Mocked database client
 * @param organizationId - Organization ID to set in session
 */
export function mockSessionVariableSetup(
  mockDb: MockProxy<DrizzleClient>,
  _organizationId: string,
): void {
  // Mock the session variable SQL execution
  mockDb.execute.mockImplementation((query) => {
    // Check if this is the session variable query
    if (query && typeof query === "object" && "sql" in query) {
      const sqlQuery = (query as { sql: string }).sql;
      if (
        typeof sqlQuery === "string" &&
        sqlQuery.includes("SET LOCAL app.current_organization_id")
      ) {
        // Mock successful session variable setting
        return Promise.resolve([]);
      }
    }
    return Promise.resolve([]);
  });
}

/**
 * Validates that RLS session variable was set correctly
 *
 * @param mockDb - Mocked database client
 * @param expectedOrgId - Expected organization ID
 */
export function expectSessionVariableSet(
  mockDb: MockProxy<DrizzleClient>,
  expectedOrgId: string,
): void {
  expect(mockDb.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      sql: expect.stringContaining(
        `SET LOCAL app.current_organization_id = ${expectedOrgId}`,
      ),
    }),
  );
}

/**
 * Simulates anonymous user accessing different organization's data
 * Used to test cross-organization security boundaries
 */
export function createCrossOrgAccessScenario(): {
  userContext: AnonymousTestContext; // User from primary org
  targetData: { organizationId: string }; // Data from competitor org
} {
  const userContext = createAnonymousTestContext({
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
  });

  const targetData = {
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
  };

  return { userContext, targetData };
}

/**
 * Mock machine data for QR code testing scenarios
 */
export const mockMachineData = {
  primaryOrg: {
    id: "machine-test-001",
    name: "Test Medieval Madness",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    qr_code_id: "qr-test-001",
    organization: {
      id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      name: "Austin Pinball Collective",
      subdomain: "primary-test",
    },
    model: {
      name: "Medieval Madness",
      manufacturer: "Williams",
    },
    location: {
      name: "Main Floor",
    },
  },

  competitorOrg: {
    id: "machine-test-002",
    name: "Competitor Medieval Madness",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
    qr_code_id: "qr-test-002",
    organization: {
      id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      name: "Competitor Arcade",
      subdomain: "competitor-test",
    },
    model: {
      name: "Medieval Madness",
      manufacturer: "Williams",
    },
    location: {
      name: "Game Room",
    },
  },
};

/**
 * Anonymous user testing utilities
 */
export const anonymousTestUtils = {
  /** Create anonymous user context */
  createContext: createAnonymousTestContext,

  /** Create cross-organization test scenarios */
  createCrossOrgContext: createCrossOrgTestContext,

  /** Mock session variable setup for RLS */
  mockSessionVariable: mockSessionVariableSetup,

  /** Validate session variable was set */
  expectSessionVariable: expectSessionVariableSet,

  /** Cross-organization access scenario */
  crossOrgAccess: createCrossOrgAccessScenario,

  /** Mock machine data for testing */
  mockMachines: mockMachineData,

  /** Test data constants */
  testIds: SEED_TEST_IDS,
};
