/**
 * Vitest Mock Configuration Utilities
 *
 * Centralized vi.mock() configurations for IssueList tests to eliminate
 * duplication of mock setup patterns across test files.
 *
 * Usage:
 * ```typescript
 * const mocks = createIssueListMocks();
 * setupNavigationMocks(mocks);
 * setupTRPCMocks(mocks);
 * setupPermissionMocks(mocks);
 * ```
 */

import { vi } from "vitest";

import type { IssueListMocks } from "./issueListTestSetup";

/**
 * Setup Next.js navigation mocks
 * Configures useRouter and useSearchParams mocks consistently across all tests
 */
export function setupNavigationMocks(mocks: IssueListMocks): void {
  vi.mock("next/navigation", () => ({
    useRouter: () => ({
      push: mocks.mockPush,
    }),
    useSearchParams: () => mocks.mockSearchParams,
  }));
}

/**
 * Setup tRPC API mocks with consistent structure
 * Provides the complex tRPC mock configuration used across all IssueList tests
 */
export function setupTRPCMocks(mocks: IssueListMocks): void {
  vi.mock("~/trpc/react", async () => {
    const actual =
      await vi.importActual<typeof import("~/trpc/react")>("~/trpc/react");
    return {
      ...actual,
      api: {
        ...actual.api,
        createClient: actual.api.createClient,
        Provider: actual.api.Provider,
        issue: {
          ...actual.api.issue,
          core: {
            ...actual.api.issue.core,
            getAll: {
              ...actual.api.issue.core.getAll,
              useQuery: mocks.mockIssuesQuery,
            },
          },
        },
        location: {
          ...actual.api.location,
          getAll: {
            ...actual.api.location.getAll,
            useQuery: mocks.mockLocationsQuery,
          },
        },
        issueStatus: {
          ...actual.api.issueStatus,
          getAll: {
            ...actual.api.issueStatus.getAll,
            useQuery: mocks.mockStatusesQuery,
          },
        },
        machine: {
          ...actual.api.machine,
          core: {
            ...actual.api.machine.core,
            getAll: {
              ...actual.api.machine.core.getAll,
              useQuery: mocks.mockMachinesQuery,
            },
          },
        },
        user: {
          ...actual.api.user,
          getCurrentMembership: {
            ...actual.api.user.getCurrentMembership,
            useQuery: vi.fn(() => ({
              data: null,
              isLoading: false,
              isError: false,
            })),
          },
          getAllInOrganization: {
            ...actual.api.user.getAllInOrganization,
            useQuery: mocks.mockUsersQuery,
          },
        },
      },
    };
  });
}

/**
 * Setup permission hook mocks
 * Configures the usePermissions hook mock consistently across all tests
 */
export function setupPermissionMocks(mocks: IssueListMocks): void {
  vi.mock("~/hooks/usePermissions", () => ({
    usePermissions: mocks.mockUsePermissions,
  }));
}

/**
 * All-in-one mock setup for IssueList tests
 * Convenience function that sets up all required mocks at once
 */
export function setupAllIssueListMocks(mocks: IssueListMocks): void {
  setupNavigationMocks(mocks);
  setupTRPCMocks(mocks);
  setupPermissionMocks(mocks);
}
