/**
 * Canonical Resolver Mocking Setup
 * Updated to use the canonical authentication resolver pattern
 *
 * Provides mocking for the canonical getRequestAuthContext resolver
 * Returns discriminated union: { kind, user, org, membership }
 * Uses SEED_TEST_IDS for predictable test data
 */

import { vi } from "vitest";
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

export function setupOrganizationMocks() {
  // Mock the canonical auth resolver - this is the primary entry point
  vi.mock("~/server/auth/context", () => ({
    getRequestAuthContext: vi.fn(async () => ({
      kind: "authorized",
      user: {
        id: SEED_TEST_IDS.USERS.ADMIN,
        email: "tim@pinpoint.dev",
        name: "Tim Froehlich",
      },
      org: {
        id: SEED_TEST_IDS.ORGANIZATIONS.primary,
        name: "Test Organization",
        subdomain: "test-org",
      },
      membership: {
        id: "membership-test",
        role: {
          id: "role-admin",
          name: "Admin",
        },
        userId: SEED_TEST_IDS.USERS.ADMIN,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    })),
    requireAuthorized: vi.fn(async () => ({
      kind: "authorized",
      user: {
        id: SEED_TEST_IDS.USERS.ADMIN,
        email: "tim@pinpoint.dev",
        name: "Tim Froehlich",
      },
      org: {
        id: SEED_TEST_IDS.ORGANIZATIONS.primary,
        name: "Test Organization",
        subdomain: "test-org",
      },
      membership: {
        id: "membership-test",
        role: {
          id: "role-admin",
          name: "Admin",
        },
        userId: SEED_TEST_IDS.USERS.ADMIN,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    })),
  }));
}

// Auto-setup when imported as setupFile
setupOrganizationMocks();

/**
 * Helper to create unauthenticated auth context mock
 */
export function mockUnauthenticatedContext() {
  vi.mock("~/server/auth/context", () => ({
    getRequestAuthContext: vi.fn(async () => ({
      kind: "unauthenticated",
    })),
    requireAuthorized: vi.fn(async () => {
      throw new Error("Member access required");
    }),
  }));
}

/**
 * Helper to create no-membership auth context mock
 */
export function mockNoMembershipContext(userId = SEED_TEST_IDS.USERS.ADMIN, orgId = SEED_TEST_IDS.ORGANIZATIONS.primary) {
  const { getRequestAuthContext } = vi.hoisted(() => {
    return { getRequestAuthContext: vi.fn() };
  });
  
  vi.mock("~/server/auth/context", () => ({
    getRequestAuthContext,
    requireAuthorized: vi.fn(async () => {
      throw new Error("Member access required");
    }),
  }));

  getRequestAuthContext.mockResolvedValue({
    kind: "no-membership",
    user: {
      id: userId,
      email: "tim@pinpoint.dev",
      name: "Tim Froehlich",
    },
    orgId,
  });
}
