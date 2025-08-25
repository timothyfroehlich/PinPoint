/**
 * Service Test Helpers - Archetype 3 Infrastructure
 *
 * Provides utilities for testing service layer business logic with:
 * - TypeScript-safe mocking patterns
 * - Multi-tenant security validation
 * - Predictable test data setup
 * - Organization scoping verification
 */

/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing */

import { vi } from "vitest";
import { mockDeep, type MockProxy } from "vitest-mock-extended";
import type { DrizzleClient } from "~/server/db/drizzle";
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

/**
 * Creates a fully mocked DrizzleClient for service testing
 *
 * @returns MockProxy<DrizzleClient> - Fully mocked Drizzle client with proper method chaining
 */
export function createMockDatabase(): MockProxy<DrizzleClient> {
  const mockDb = mockDeep<DrizzleClient>();

  // Mock the insert(...).values(...) chain
  const mockInsertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
    returning: vi.fn().mockResolvedValue([]),
  };

  // Mock the update(...).set(...).where(...) chain
  const mockUpdateChain = {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
      returning: vi.fn().mockResolvedValue([]),
    }),
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
    returning: vi.fn().mockResolvedValue([]),
  };

  // Mock the delete(...).where(...) chain
  const mockDeleteChain = {
    where: vi.fn().mockResolvedValue([]),
  };

  // Mock the select(...).from(...).where(...) chain
  const mockSelectChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    where: vi.fn().mockResolvedValue([]),
    innerJoin: vi.fn().mockResolvedValue([]),
  };

  // Mock the selectDistinct(...).from(...).where(...) chain
  const mockSelectDistinctChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    where: vi.fn().mockResolvedValue([]),
    innerJoin: vi.fn().mockResolvedValue([]),
  };

  // Set up the mock chains with proper typing
  mockDb.insert.mockReturnValue(mockInsertChain);
  mockDb.update.mockReturnValue(mockUpdateChain);
  mockDb.delete.mockReturnValue(mockDeleteChain);
  mockDb.select.mockReturnValue(mockSelectChain);
  mockDb.selectDistinct.mockReturnValue(mockSelectDistinctChain);
  mockDb.execute.mockResolvedValue([]);

  return mockDb;
}

/**
 * Service test context with mocked database and organization
 */
export interface ServiceTestContext {
  /** Mocked Drizzle database client */
  mockDb: MockProxy<DrizzleClient>;
  /** Primary organization ID for testing */
  organizationId: string;
  /** Competitor organization ID for security testing */
  competitorOrgId: string;
}

/**
 * Creates a standardized service test context
 *
 * @returns ServiceTestContext - Ready-to-use test context
 */
export function createServiceTestContext(): ServiceTestContext {
  return {
    mockDb: createMockDatabase(),
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    competitorOrgId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
  };
}

/**
 * Validates that a database operation includes organization scoping
 *
 * @param mockCall - The mock call to validate
 * @param expectedOrgId - Expected organization ID
 */
export function expectOrganizationScoping(
  mockCall: unknown,
  expectedOrgId: string,
): void {
  // Type guard to ensure mockCall has the expected structure
  if (
    !mockCall ||
    typeof mockCall !== "object" ||
    !("toHaveBeenCalledWith" in mockCall)
  ) {
    throw new Error("mockCall must be a vitest mock function");
  }

  const mockFunction = mockCall as {
    toHaveBeenCalledWith: (args: unknown) => void;
  };
  mockFunction.toHaveBeenCalledWith(
    expect.objectContaining({
      organization_id: expectedOrgId,
    }),
  );
}

/**
 * Creates mock database responses for role operations
 */
export const mockRoleResponses = {
  /** Mock admin role response */
  adminRole: {
    id: SEED_TEST_IDS.ROLES.ADMIN_PRIMARY,
    name: "Admin",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    is_system: true,
    is_default: false,
    created_at: new Date("2025-01-01"),
    updated_at: new Date("2025-01-01"),
  },

  /** Mock member role response */
  memberRole: {
    id: SEED_TEST_IDS.ROLES.MEMBER_PRIMARY,
    name: "Member",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    is_system: false,
    is_default: true,
    created_at: new Date("2025-01-01"),
    updated_at: new Date("2025-01-01"),
  },

  /** Mock permission response */
  permission: {
    id: "perm-issues-create-001",
    name: "issues:create",
    description: "Create issues",
  },
};

/**
 * Creates mock database responses for user operations
 */
export const mockUserResponses = {
  /** Mock admin user response */
  adminUser: {
    id: SEED_TEST_IDS.USERS.ADMIN,
    email: SEED_TEST_IDS.EMAILS.ADMIN,
    name: SEED_TEST_IDS.NAMES.ADMIN,
    email_verified: new Date("2025-01-01"),
    image: null,
    bio: null,
    notification_frequency: "IMMEDIATE" as const,
    email_notifications_enabled: true,
    push_notifications_enabled: true,
    created_at: new Date("2025-01-01"),
    updated_at: new Date("2025-01-01"),
  },
};

/**
 * Service testing utilities for common patterns
 */
export const serviceTestUtils = {
  /** Create a service test context */
  createContext: createServiceTestContext,

  /** Mock database creation */
  mockDatabase: createMockDatabase,

  /** Organization scoping validation */
  expectOrgScoping: expectOrganizationScoping,

  /** Predefined mock responses */
  mockResponses: {
    roles: mockRoleResponses,
    users: mockUserResponses,
  },

  /** Test data constants */
  testIds: SEED_TEST_IDS,
};
