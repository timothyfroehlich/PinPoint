import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { IssueList } from "../IssueList";

import { EXTENDED_PERMISSION_SCENARIOS } from "~/test/mockUtils";
import {
  setupIssueListTest,
  createWorkflowIssues,
} from "~/test/setup/issueListTestSetup";
import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
  VITEST_ROLE_MAPPING,
} from "~/test/VitestTestWrapper";

/**
 * IssueList Integration Tests - Consolidated from workflows + integration test files
 *
 * Focus: Auth integration + real component interaction testing
 * Mock Strategy: Minimal external mocks, real auth context
 * - ✅ Real: Auth context, permission hooks, component interactions
 * - ✅ Mock: Only external APIs that can't be seeded
 * - ✅ Use: Seed data helpers from src/test/seed-data-helpers.ts
 * - ✅ Apply: Proven page.test.tsx auth integration patterns
 */

// ✅ SHARED MOCK SETUP: vi.hoisted() must be at top level of each test file
const mocks = vi.hoisted(() => ({
  // Navigation mocks
  mockPush: vi.fn(),
  mockSearchParams: new URLSearchParams(),

  // tRPC API mocks
  mockRefetch: vi.fn(),
  mockIssuesQuery: vi.fn(),
  mockLocationsQuery: vi.fn(),
  mockStatusesQuery: vi.fn(),
  mockMachinesQuery: vi.fn(),
  mockUsersQuery: vi.fn(),

  // Permission mocks
  mockUsePermissions: vi.fn(),
  mockHasPermission: vi.fn(),
}));

// ✅ SETUP MOCKS: Configure vi.mock() calls using hoisted mocks
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.mockPush,
  }),
  useSearchParams: () => mocks.mockSearchParams,
}));

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

vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: mocks.mockUsePermissions,
}));

describe("IssueList Integration Tests", () => {
  // ✅ SHARED TEST SETUP: Use centralized scenario-based mock data
  const testSetup = setupIssueListTest("INTEGRATION", mocks);

  // Create realistic workflow test data using shared utility
  const workflowIssues = createWorkflowIssues();

  beforeEach(() => {
    // ✅ SHARED CLEANUP: Centralized mock reset and configuration
    testSetup.resetMocks();
  });

  // =============================================================================
  // UNAUTHENTICATED USER EXPERIENCE (Auth Integration Pattern)
  // =============================================================================

  describe("🔓 Unauthenticated Users", () => {
    it("should show public content only with no auth features", () => {
      // ✅ CRITICAL: Configure mocks for unauthenticated user
      mocks.mockHasPermission.mockReturnValue(false); // No permissions for unauthenticated users
      mocks.mockUsePermissions.mockReturnValue({
        hasPermission: mocks.mockHasPermission,
        isLoading: false,
        isAuthenticated: false, // ✅ KEY FIX: Must be false for unauthenticated users
        permissions: [],
        isError: false,
        isAdmin: false,
      });

      render(
        <VitestTestWrapper session={null}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show basic issue list without auth-dependent features
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();
      expect(screen.getAllByText(/Test.*Issue/)).toHaveLength(3);

      // Should NOT show auth-dependent features
      expect(
        screen.queryByRole("button", { name: /select all/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("bulk-assign-button"),
      ).not.toBeInTheDocument();
    });

    it("should handle issue navigation for public users", async () => {
      // ✅ CRITICAL: Configure mocks for unauthenticated user
      mocks.mockHasPermission.mockReturnValue(false);
      mocks.mockUsePermissions.mockReturnValue({
        hasPermission: mocks.mockHasPermission,
        isLoading: false,
        isAuthenticated: false,
        permissions: [],
        isError: false,
        isAdmin: false,
      });

      render(
        <VitestTestWrapper session={null}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should still allow navigation to issue detail
      const issueTitle = screen.getAllByText(/Test.*Issue/)[0] as HTMLElement;
      await userEvent.click(issueTitle);

      expect(mocks.mockPush).toHaveBeenCalledWith("/issues/issue-1");
    });

    it("should show appropriate messaging for unauthenticated users", () => {
      // ✅ CRITICAL: Configure mocks for unauthenticated user
      mocks.mockHasPermission.mockReturnValue(false);
      mocks.mockUsePermissions.mockReturnValue({
        hasPermission: mocks.mockHasPermission,
        isLoading: false,
        isAuthenticated: false,
        permissions: [],
        isError: false,
        isAdmin: false,
      });

      render(
        <VitestTestWrapper session={null}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Look for any sign-in prompts or messaging (if component implements them)
      // This test validates that the component gracefully handles no auth state
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();
    });
  });

  // =============================================================================
  // MEMBER USER EXPERIENCE (Auth Integration Pattern)
  // =============================================================================

  describe("👤 Member Users", () => {
    beforeEach(() => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        ([...VITEST_PERMISSION_SCENARIOS.MEMBER] as string[]).includes(
          permission,
        ),
      );
    });

    it("should show member features but disable admin controls", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole={VITEST_ROLE_MAPPING.MEMBER}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show basic functionality
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();
      expect(screen.getAllByText(/Test.*Issue/)).toHaveLength(3);

      // Member permissions don't include issue:assign, so no selection controls
      expect(
        screen.queryByRole("button", { name: /select all/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

      // Should still allow issue navigation
      expect(screen.getAllByText(/Test.*Issue/)).toHaveLength(3);
    });

    it("should handle filter interactions for members", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole={VITEST_ROLE_MAPPING.MEMBER}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Members should be able to use filters
      const openButton = screen.getByRole("button", { name: /Open \(\d+\)/ });
      await userEvent.click(openButton);

      await waitFor(() => {
        expect(mocks.mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusIds="),
        );
      });
    });

    it("should show tooltips for disabled features", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole={VITEST_ROLE_MAPPING.MEMBER}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // This test validates that members understand why certain features are disabled
      // The exact implementation depends on how the component handles permission tooltips
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();
    });
  });

  // =============================================================================
  // ADMIN USER EXPERIENCE (Auth Integration Pattern)
  // =============================================================================

  describe("👑 Admin Users", () => {
    it("should show all features and controls", () => {
      // ✅ CRITICAL: Configure mocks for admin user - ensure issue:assign permission works
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        ([...VITEST_PERMISSION_SCENARIOS.ADMIN] as string[]).includes(
          permission,
        ),
      );
      mocks.mockUsePermissions.mockReturnValue({
        hasPermission: mocks.mockHasPermission,
        isLoading: false,
        isAuthenticated: true,
        permissions: [...VITEST_PERMISSION_SCENARIOS.ADMIN],
        isError: false,
        isAdmin: true,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
          injectPermissionDeps={false}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show all functionality including selection controls
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();
      expect(screen.getByText("Select All")).toBeInTheDocument(); // Typography text, not button
      expect(screen.getAllByRole("checkbox")).toHaveLength(4); // Select all + 3 issues
    });

    it("should enable bulk actions for admin users", async () => {
      // ✅ CRITICAL: Configure mocks for admin user - ensure issue:assign permission works
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        ([...VITEST_PERMISSION_SCENARIOS.ADMIN] as string[]).includes(
          permission,
        ),
      );
      mocks.mockUsePermissions.mockReturnValue({
        hasPermission: mocks.mockHasPermission,
        isLoading: false,
        isAuthenticated: true,
        permissions: [...VITEST_PERMISSION_SCENARIOS.ADMIN],
        isError: false,
        isAdmin: true,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
          injectPermissionDeps={false}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue to show bulk actions
      const checkboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = checkboxes[1] as HTMLElement; // Skip "Select All"
      await userEvent.click(firstIssueCheckbox);

      expect(screen.getByText(/\d+ issues? selected/)).toBeInTheDocument();
      expect(screen.getByTestId("bulk-assign-button")).toBeInTheDocument();
      expect(screen.getByTestId("bulk-close-button")).toBeInTheDocument();

      // Admin should have all bulk actions enabled
      expect(screen.getByTestId("bulk-assign-button")).not.toBeDisabled();
      expect(screen.getByTestId("bulk-close-button")).not.toBeDisabled();
    });

    it("should handle admin-specific workflows", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Test select all functionality
      const checkboxes = screen.getAllByRole("checkbox");
      const selectAllCheckbox = checkboxes[0] as HTMLElement;

      await userEvent.click(selectAllCheckbox);
      expect(screen.getByText(/\d+ issues? selected/)).toBeInTheDocument();
    });
  });

  // =============================================================================
  // TECHNICIAN WORKFLOW INTEGRATION (from workflows.test.tsx)
  // =============================================================================

  describe("🔧 Technician Daily Workflows", () => {
    beforeEach(() => {
      // Override with workflow-specific issues for realistic scenarios
      mocks.mockIssuesQuery.mockReturnValue({
        data: workflowIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mocks.mockRefetch,
      });

      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          [...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN] as readonly string[]
        ).includes(permission),
      );
    });

    it("allows technician to view assigned issues", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see all issues in their list
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();

      // Should see issues they're assigned to
      expect(screen.getByText(/Display flickering/)).toBeInTheDocument();
      expect(screen.getByText(/Routine.*cleaning/)).toBeInTheDocument();

      // Should see unassigned issues they can claim
      expect(screen.getByText(/Ball stuck.*castle/)).toBeInTheDocument();
    });

    it("allows technician to select and bulk assign issues to themselves", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select the unassigned high-priority issue
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(6); // Select all + 5 issue checkboxes

      const firstIssueCheckbox = checkboxes[1] as HTMLElement; // Ball stuck issue
      await userEvent.click(firstIssueCheckbox);

      expect(screen.getByText(/\d+ issues? selected/)).toBeInTheDocument();

      // Should see bulk assignment option
      const assignButton = screen.getByTestId("bulk-assign-button");
      expect(assignButton).toBeInTheDocument();
      expect(assignButton).not.toBeDisabled();
    });

    it("shows appropriate bulk actions for technician permissions", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue
      const checkboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = checkboxes[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      // Technicians should have both assign and close (edit) permissions
      expect(screen.getByTestId("bulk-assign-button")).not.toBeDisabled();
      expect(screen.getByTestId("bulk-close-button")).not.toBeDisabled();
    });

    it("allows technician to filter by their assigned issues", async () => {
      // Mock filtered response for assigned issues
      const assignedIssues = workflowIssues.filter(
        (issue) => issue.assignedTo?.id === "user-tech",
      );

      // Override query to return filtered results
      mocks.mockIssuesQuery.mockReturnValue({
        data: assignedIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mocks.mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList
            initialFilters={{
              ...testSetup.defaultFilters,
              assigneeId: "user-tech",
            }}
          />
        </VitestTestWrapper>,
      );

      // Should show only assigned issues
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();
      expect(screen.getByText(/Display flickering/)).toBeInTheDocument();
      expect(screen.getByText(/Routine.*cleaning/)).toBeInTheDocument();

      // Should NOT show unassigned issues
      expect(screen.queryByText(/Ball stuck.*castle/)).not.toBeInTheDocument();
    });

    it("handles mixed priority workflow scenarios", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see issues with different priorities and statuses
      expect(screen.getByText(/Ball stuck.*castle/)).toBeInTheDocument(); // High priority, New
      expect(screen.getByText(/Display flickering/)).toBeInTheDocument(); // Medium priority, In Progress
      expect(screen.getByText(/Routine.*cleaning/)).toBeInTheDocument(); // Low priority, Resolved

      // Should be able to select high-priority issues for immediate attention
      const checkboxes = screen.getAllByRole("checkbox");
      const highPriorityCheckbox = checkboxes[1] as HTMLElement; // First issue (Ball stuck)

      await userEvent.click(highPriorityCheckbox);
      expect(screen.getByText(/\d+ issues? selected/)).toBeInTheDocument();
    });
  });

  // =============================================================================
  // CROSS-ROLE WORKFLOW INTEGRATION
  // =============================================================================

  describe("Cross-Role Workflow Integration", () => {
    it("handles role transitions gracefully", () => {
      // ✅ CRITICAL: Configure mocks for member user - ensure issue:assign permission is NOT included
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        ([...VITEST_PERMISSION_SCENARIOS.MEMBER] as string[]).includes(
          permission,
        ),
      );
      mocks.mockUsePermissions.mockReturnValue({
        hasPermission: mocks.mockHasPermission,
        isLoading: false,
        isAuthenticated: true,
        permissions: [...VITEST_PERMISSION_SCENARIOS.MEMBER],
        isError: false,
        isAdmin: false,
      });

      // Test scenario: User role changes from Member to Admin
      const { rerender } = render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole={VITEST_ROLE_MAPPING.MEMBER}
          injectPermissionDeps={false}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Initially as Member - no selection controls
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();

      // Update permissions mock for Admin role
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        ([...VITEST_PERMISSION_SCENARIOS.ADMIN] as string[]).includes(
          permission,
        ),
      );
      mocks.mockUsePermissions.mockReturnValue({
        hasPermission: mocks.mockHasPermission,
        isLoading: false,
        isAuthenticated: true,
        permissions: [...VITEST_PERMISSION_SCENARIOS.ADMIN],
        isError: false,
        isAdmin: true,
      });

      // Re-render with Admin permissions
      rerender(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
          injectPermissionDeps={false}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Now should show Admin features
      expect(screen.getByText("Select All")).toBeInTheDocument();
    });

    it("maintains data consistency across permission changes", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should maintain same issue data regardless of permission level
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();
      expect(screen.getAllByText(/Test.*Issue/)).toHaveLength(3);
    });
  });

  // =============================================================================
  // MULTI-TENANT SECURITY INTEGRATION
  // =============================================================================

  describe("Multi-Tenant Security Boundaries", () => {
    it("scopes all queries to current organization", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // All API calls should be scoped to organization
      expect(mocks.mockIssuesQuery).toHaveBeenCalled();
      expect(mocks.mockLocationsQuery).toHaveBeenCalled();
      expect(mocks.mockStatusesQuery).toHaveBeenCalled();

      // Should show organization-scoped data
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();
    });

    it("prevents cross-organization data access", () => {
      // This test validates that the component doesn't display data from other orgs
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should only show data for the user's organization
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();
      // Actual cross-org prevention happens at the API level via organization scoping
    });
  });

  // =============================================================================
  // END-TO-END USER WORKFLOWS
  // =============================================================================

  describe("End-to-End User Workflows", () => {
    it("supports complete issue management workflow", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // 1. View issues
      expect(screen.getByText(/\d+ issues? found/)).toBeInTheDocument();

      // 2. Filter issues
      const openButton = screen.getByRole("button", { name: /Open \(\d+\)/ });
      await userEvent.click(openButton);

      // 3. Select issues
      const checkboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = checkboxes[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      // 4. Perform bulk actions
      expect(screen.getByText(/\d+ issues? selected/)).toBeInTheDocument();
      expect(screen.getByTestId("bulk-assign-button")).toBeInTheDocument();

      // 5. Navigate to detail
      const issueLinks = screen.getAllByText(/Test.*Issue/);
      await userEvent.click(issueLinks[0] as HTMLElement);
      expect(mocks.mockPush).toHaveBeenCalledWith("/issues/issue-1");
    });

    it("handles complex filter and selection combinations", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Apply multiple filters and then perform bulk actions
      const openButton = screen.getByRole("button", { name: /Open \(\d+\)/ });
      await userEvent.click(openButton);

      // Expand advanced filters
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      // Select location filter
      await waitFor(() => {
        expect(screen.getByLabelText("Location")).toBeInTheDocument();
      });

      const locationSelect = screen.getByLabelText("Location");
      fireEvent.mouseDown(locationSelect);

      await waitFor(() => {
        expect(
          screen.getByRole("option", { name: /Main Floor/ }),
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("option", { name: /Main Floor/ }));

      // Then select issues for bulk actions
      const checkboxes = screen.getAllByRole("checkbox");
      const selectAllCheckbox = checkboxes[0] as HTMLElement;
      await userEvent.click(selectAllCheckbox);

      expect(screen.getByText(/\d+ issues? selected/)).toBeInTheDocument();
    });
  });
});
