/**
 * Organization Context Mocking Setup
 * Foundation Repair Plan Phase 2.3: Test Architecture Stabilization
 *
 * Provides comprehensive organization context mocking for DAL functions
 * Uses SEED_TEST_IDS for predictable test data
 */

import { vi } from "vitest";
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

export function setupOrganizationMocks() {
  // Mock the main organization context functions
  vi.mock("~/lib/organization-context", async () => {
    const actual = await vi.importActual("~/lib/organization-context");
    return {
      ...actual,
      getOrganizationContext: vi.fn(async () => ({
        organization: {
          id: SEED_TEST_IDS.ORGANIZATIONS.primary,
          name: "Test Organization",
          subdomain: "test-org",
        },
        user: {
          id: SEED_TEST_IDS.USERS.ADMIN,
          email: "tim@pinpoint.dev",
          name: "Tim Froehlich",
        },
        accessLevel: "member" as const,
        membership: {
          id: "membership-test",
          role: {
            id: "role-admin",
            name: "Admin",
          },
        },
      })),
      requireOrganizationContext: vi.fn(async () => ({
        organization: {
          id: SEED_TEST_IDS.ORGANIZATIONS.primary,
          name: "Test Organization",
          subdomain: "test-org",
        },
        user: {
          id: SEED_TEST_IDS.USERS.ADMIN,
          email: "tim@pinpoint.dev",
          name: "Tim Froehlich",
        },
        accessLevel: "member" as const,
        membership: {
          id: "membership-test",
          role: {
            id: "role-admin",
            name: "Admin",
          },
        },
      })),
      requireMemberAccess: vi.fn(async () => ({
        organization: {
          id: SEED_TEST_IDS.ORGANIZATIONS.primary,
          name: "Test Organization",
          subdomain: "test-org",
        },
        user: {
          id: SEED_TEST_IDS.USERS.ADMIN,
          email: "tim@pinpoint.dev",
          name: "Tim Froehlich",
        },
        accessLevel: "member" as const,
        membership: {
          id: "membership-test",
          role: {
            id: "role-admin",
            name: "Admin",
          },
        },
      })),
      ensureOrgContextAndBindRLS: vi.fn(async (fn) => {
        // Mock the RLS binding by calling the function with a mock transaction and context
        const mockTx = {} as any; // Mock transaction object
        const mockContext = {
          organization: {
            id: SEED_TEST_IDS.ORGANIZATIONS.primary,
            name: "Test Organization",
            subdomain: "test-org",
          },
          user: {
            id: SEED_TEST_IDS.USERS.ADMIN,
            email: "tim@pinpoint.dev",
            name: "Tim Froehlich",
          },
          accessLevel: "member" as const,
          membership: {
            id: "membership-test",
            role: {
              id: "role-admin",
              name: "Admin",
            },
          },
        };
        return fn(mockTx, mockContext);
      }),
    };
  });

  // Mock Supabase auth context
  vi.mock("~/lib/supabase/server", () => ({
    createClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: SEED_TEST_IDS.USERS.ADMIN,
              email: "tim@pinpoint.dev",
              user_metadata: {
                name: "Tim Froehlich",
              },
            },
          },
          error: null,
        }),
      },
    })),
  }));

  // Mock DAL shared functions
  vi.mock("~/lib/dal/shared", async () => {
    const actual = await vi.importActual("~/lib/dal/shared");
    return {
      ...actual,
      getDALAuthContext: vi.fn(async () => ({
        user: {
          id: SEED_TEST_IDS.USERS.ADMIN,
          email: "tim@pinpoint.dev",
          user_metadata: {
            name: "Tim Froehlich",
          },
        },
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        membership: {
          id: "membership-test",
          role: {
            id: "role-admin",
            name: "Admin",
          },
        },
        role: {
          id: "role-admin",
          name: "Admin",
        },
      })),
      requireAuthContext: vi.fn(async () => ({
        user: {
          id: SEED_TEST_IDS.USERS.ADMIN,
          email: "tim@pinpoint.dev",
          user_metadata: {
            name: "Tim Froehlich",
          },
        },
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      })),
      requireAuthContextWithRole: vi.fn(async () => ({
        user: {
          id: SEED_TEST_IDS.USERS.ADMIN,
          email: "tim@pinpoint.dev",
          user_metadata: {
            name: "Tim Froehlich",
          },
        },
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        membership: {
          id: "membership-test",
          roleId: "role-admin",
        },
        role: {
          id: "role-admin",
          name: "Admin",
        },
        permissions: [],
      })),
    };
  });
}

// Auto-setup when imported as setupFile
setupOrganizationMocks();
