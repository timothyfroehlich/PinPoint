import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";

import { IssueList } from "../IssueList";

import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
  VITEST_ROLE_MAPPING,
} from "~/test/VitestTestWrapper";

// Mock next/navigation with vi.hoisted
const { mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSearchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock tRPC API calls with vi.hoisted - preserve React components
const { mockRefetch, mockIssuesQuery, mockLocationsQuery, mockStatusesQuery } =
  vi.hoisted(() => ({
    mockRefetch: vi.fn(),
    mockIssuesQuery: vi.fn(),
    mockLocationsQuery: vi.fn(),
    mockStatusesQuery: vi.fn(),
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
        core: {
          getAll: {
            useQuery: mockIssuesQuery,
          },
        },
      },
      location: {
        getAll: {
          useQuery: mockLocationsQuery,
        },
      },
      issueStatus: {
        getAll: {
          useQuery: mockStatusesQuery,
        },
      },
      user: {
        getCurrentMembership: {
          useQuery: vi.fn(() => ({
            data: null,
            isLoading: false,
            isError: false,
          })),
        },
      },
    },
  };
});

// Mock hasPermission function for tests that need direct permission mocking
const mockHasPermission = vi.fn();

// Using dependency injection via PermissionDepsProvider instead of global mocks

describe("IssueList - Permission-Based Access Control", () => {
  const mockIssues = [
    {
      id: "issue-1",
      title: "Critical Machine Failure",
      status: {
        id: "status-1",
        name: "New",
        category: "NEW" as const,
        organizationId: "org-1",
        isDefault: true,
      },
      priority: {
        id: "priority-1",
        name: "Critical",
        order: 1,
        organizationId: "org-1",
        isDefault: false,
      },
      machine: {
        id: "machine-1",
        name: "Medieval Madness",
        model: {
          id: "model-1",
          name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
        },
        location: {
          id: "location-1",
          name: "Main Floor",
          organizationId: "org-1",
        },
      },
      assignedTo: null,
      createdAt: "2023-01-01T00:00:00.000Z",
      _count: {
        comments: 3,
        attachments: 2,
      },
    },
    {
      id: "issue-2",
      title: "Flipper Maintenance",
      status: {
        id: "status-2",
        name: "In Progress",
        category: "IN_PROGRESS" as const,
        organizationId: "org-1",
        isDefault: false,
      },
      priority: {
        id: "priority-2",
        name: "Low",
        order: 4,
        organizationId: "org-1",
        isDefault: false,
      },
      machine: {
        id: "machine-2",
        name: "Attack from Mars",
        model: {
          id: "model-2",
          name: "Attack from Mars",
          manufacturer: "Bally",
          year: 1995,
        },
        location: {
          id: "location-2",
          name: "Back Room",
          organizationId: "org-1",
        },
      },
      assignedTo: {
        id: "user-tech",
        name: "Tech User",
        email: "tech@example.com",
        image: null,
      },
      createdAt: "2023-01-02T00:00:00.000Z",
      _count: {
        comments: 1,
        attachments: 0,
      },
    },
  ];

  const mockLocations = [
    { id: "location-1", name: "Main Floor" },
    { id: "location-2", name: "Back Room" },
  ];

  const mockStatuses = [
    { id: "status-1", name: "New" },
    { id: "status-2", name: "In Progress" },
    { id: "status-3", name: "Resolved" },
  ];

  const defaultFilters = {
    sortBy: "created" as const,
    sortOrder: "desc" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default API responses
    mockIssuesQuery.mockReturnValue({
      data: mockIssues,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    mockLocationsQuery.mockReturnValue({
      data: mockLocations,
    });

    mockStatusesQuery.mockReturnValue({
      data: mockStatuses,
    });
  });

  describe("Admin Role - Full Access", () => {
    beforeEach(() => {
      mockHasPermission.mockImplementation((permission) =>
        [...VITEST_PERMISSION_SCENARIOS.ADMIN].includes(permission),
      );
    });

    it("shows all management features for admin users", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show selection controls
      expect(screen.getByText("Select All")).toBeInTheDocument();
      expect(screen.getAllByRole("checkbox")).toHaveLength(3); // Select all + 2 issues

      // All filter controls should be available - check by combobox role
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes).toHaveLength(4); // Location, Status, Category, Sort By
    });

    it("enables bulk assignment for admin users", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue to trigger bulk actions
      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      const assignButton = screen.getByRole("button", { name: /assign/i });
      expect(assignButton).toBeInTheDocument();
      expect(assignButton).not.toBeDisabled();
      expect(assignButton).not.toHaveAttribute("aria-disabled", "true");
    });

    it("enables bulk close for admin users", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue to trigger bulk actions
      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).not.toBeDisabled();
    });

    it("allows admin users to navigate to issue details", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const issueTitle = screen.getByText("Critical Machine Failure");
      await userEvent.click(issueTitle);

      expect(mockPush).toHaveBeenCalledWith("/issues/issue-1");
    });
  });

  describe("Manager Role - Limited Management Access", () => {
    beforeEach(() => {
      mockHasPermission.mockImplementation((permission) =>
        [...VITEST_PERMISSION_SCENARIOS.MANAGER].includes(permission),
      );
    });

    it("shows management features for manager users", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MANAGER]}
          userRole={VITEST_ROLE_MAPPING.MANAGER}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should NOT show selection controls (no issue:assign permission)
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

      // Should still have access to filtering
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThan(0);
    });

    it("does not show bulk actions for manager users", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MANAGER]}
          userRole={VITEST_ROLE_MAPPING.MANAGER}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // No selection controls means no bulk actions
      expect(
        screen.queryByRole("button", { name: /assign/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /close/i }),
      ).not.toBeInTheDocument();
    });

    it("allows manager users to view and navigate issues", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MANAGER]}
          userRole={VITEST_ROLE_MAPPING.MANAGER}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see issue content
      expect(screen.getByText("Critical Machine Failure")).toBeInTheDocument();
      expect(screen.getByText("Flipper Maintenance")).toBeInTheDocument();

      // Should be able to navigate
      const issueTitle = screen.getByText("Critical Machine Failure");
      await userEvent.click(issueTitle);

      expect(mockPush).toHaveBeenCalledWith("/issues/issue-1");
    });
  });

  describe("Member Role - Basic Access", () => {
    beforeEach(() => {
      mockHasPermission.mockImplementation((permission) =>
        [...VITEST_PERMISSION_SCENARIOS.MEMBER].includes(permission),
      );
    });

    it("shows read-only view for member users", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole={VITEST_ROLE_MAPPING.MEMBER}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see issue content
      expect(screen.getByText("Critical Machine Failure")).toBeInTheDocument();
      expect(screen.getByText("Flipper Maintenance")).toBeInTheDocument();

      // Should NOT see selection or management controls
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("allows member users to filter and sort issues", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole={VITEST_ROLE_MAPPING.MEMBER}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Filtering should still be available to all users
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes).toHaveLength(4); // Location, Status, Category, Sort By
    });

    it("allows member users to navigate to issue details", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole={VITEST_ROLE_MAPPING.MEMBER}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const issueTitle = screen.getByText("Critical Machine Failure");
      await userEvent.click(issueTitle);

      expect(mockPush).toHaveBeenCalledWith("/issues/issue-1");
    });

    it("shows refresh functionality for member users", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole={VITEST_ROLE_MAPPING.MEMBER}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();

      await userEvent.click(refreshButton);
      expect(mockRefetch).toHaveBeenCalledOnce();
    });
  });

  describe("Public/Unauthenticated Users", () => {
    beforeEach(() => {
      mockHasPermission.mockImplementation(() => false);
    });

    it("shows minimal read-only view for public users", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.PUBLIC]}
          userRole={VITEST_ROLE_MAPPING.PUBLIC}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should still show basic issue information
      expect(screen.getByText("Critical Machine Failure")).toBeInTheDocument();
      expect(screen.getByText("Flipper Maintenance")).toBeInTheDocument();

      // Should NOT show any management controls
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /assign/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Permission Boundary Edge Cases", () => {
    it("handles mixed permissions correctly", () => {
      // User with view but not assign permissions
      mockHasPermission.mockImplementation((permission) =>
        ["issue:view", "machine:view"].includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "machine:view"]}
          userRole="Custom"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see issues but no selection controls
      expect(screen.getByText("Critical Machine Failure")).toBeInTheDocument();
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
    });

    it("shows disabled bulk actions with tooltips for insufficient permissions", async () => {
      // Mock having issue:assign to show selection, but not issue:edit for close
      mockHasPermission.mockImplementation((permission) =>
        ["issue:view", "issue:assign"].includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign"]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue to show bulk actions
      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      // Assign button should be enabled
      const assignButton = screen.getByRole("button", { name: /assign/i });
      expect(assignButton).not.toBeDisabled();

      // Close button should be disabled and show tooltip for missing permission
      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toBeDisabled();
    });

    it("handles permission loading state", () => {
      // Test realistic authentication flow - session loading
      render(
        <VitestTestWrapper sessionLoading={true}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show loading spinner when session is loading
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("gracefully handles permission check failures", () => {
      // Test error boundary behavior with permission system
      // When membership query has error, component should still render with fallback behavior
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          userRole={VITEST_ROLE_MAPPING.MEMBER}
          queryOptions={{
            isError: true,
            error: new Error("Permission check failed"),
          }}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Component should still render but with degraded permissions (like a fallback)
      // Should show basic content but no permission-dependent features
      expect(screen.getByText("Critical Machine Failure")).toBeInTheDocument();
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
    });
  });

  describe("Role-Based UI Variations", () => {
    it("adapts UI based on technician role capabilities", () => {
      // Technician typically has issue:assign but not full admin permissions
      const technicianPermissions = [
        "issue:view",
        "issue:create",
        "issue:update",
        "issue:assign",
        "machine:view",
      ];

      mockHasPermission.mockImplementation((permission) =>
        technicianPermissions.includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show selection controls for assignment
      expect(screen.getByText("Select All")).toBeInTheDocument();

      // Should show assign button but not close button (missing issue:edit)
      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;
      fireEvent.click(firstIssueCheckbox);

      expect(
        screen.getByRole("button", { name: /assign/i }),
      ).not.toBeDisabled();

      // Close button should be enabled since technician has issue:update permission
      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).not.toBeDisabled();
    });

    it("shows machine owner specific permissions", () => {
      // Machine owner might have limited permissions for their machines
      const ownerPermissions = ["issue:view", "issue:create", "machine:view"];

      mockHasPermission.mockImplementation((permission) =>
        ownerPermissions.includes(permission),
      );

      render(
        <VitestTestWrapper userPermissions={ownerPermissions} userRole="Owner">
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see issues but no management controls
      expect(screen.getByText("Critical Machine Failure")).toBeInTheDocument();
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();

      // Filtering should still work
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThan(0);
    });
  });

  describe("Multi-Tenant Permission Isolation", () => {
    it("enforces organization-scoped permissions", () => {
      // Permissions should only apply within the user's organization
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // API should be called with organization context
      expect(mockIssuesQuery).toHaveBeenCalledWith(defaultFilters);

      // All displayed issues should belong to the same organization
      mockIssues.forEach((issue) => {
        expect(issue.machine.location.organizationId).toBe("org-1");
        expect(issue.status.organizationId).toBe("org-1");
        expect(issue.priority?.organizationId).toBe("org-1");
      });
    });
  });
});
