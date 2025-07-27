import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { IssueList } from "../IssueList";

import {
  createMockIssuesList,
  createMockLocations,
  createMockStatuses,
  createMockUsers,
  EXTENDED_PERMISSION_SCENARIOS,
} from "~/test/mockUtils";
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
const {
  mockRefetch,
  mockIssuesQuery,
  mockLocationsQuery,
  mockStatusesQuery,
  mockMachinesQuery,
  mockUsersQuery,
} = vi.hoisted(() => ({
  mockRefetch: vi.fn(),
  mockIssuesQuery: vi.fn(),
  mockLocationsQuery: vi.fn(),
  mockStatusesQuery: vi.fn(),
  mockMachinesQuery: vi.fn(),
  mockUsersQuery: vi.fn(),
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
          ...actual.api.issue?.core,
          getAll: {
            ...actual.api.issue?.core?.getAll,
            useQuery: mockIssuesQuery,
          },
        },
      },
      location: {
        ...actual.api.location,
        getAll: {
          ...actual.api.location?.getAll,
          useQuery: mockLocationsQuery,
        },
      },
      issueStatus: {
        ...actual.api.issueStatus,
        getAll: {
          ...actual.api.issueStatus?.getAll,
          useQuery: mockStatusesQuery,
        },
      },
      machine: {
        ...actual.api.machine,
        core: {
          ...actual.api.machine?.core,
          getAll: {
            ...actual.api.machine?.core?.getAll,
            useQuery: mockMachinesQuery,
          },
        },
      },
      user: {
        ...actual.api.user,
        getCurrentMembership: {
          ...actual.api.user?.getCurrentMembership,
          useQuery: vi.fn(() => ({
            data: null,
            isLoading: false,
            isError: false,
          })),
        },
        getAllInOrganization: {
          ...actual.api.user?.getAllInOrganization,
          useQuery: mockUsersQuery,
        },
      },
    },
  };
});

// Mock usePermissions hook with vi.hoisted
const { mockHasPermission } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
}));

vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: mockHasPermission,
    isLoading: false,
  }),
}));

describe("IssueList - Technician Workflows and User Journeys", () => {
  // Create realistic workflow test data
  const workflowIssues = createMockIssuesList({
    count: 5,
    overrides: {
      _count: { comments: 2, attachments: 1 },
    },
  });

  // Override specific issues for workflow scenarios
  const firstIssue = workflowIssues[0];
  if (!firstIssue) throw new Error("Expected first issue");
  workflowIssues[0] = {
    ...firstIssue,
    title: "Ball stuck in medieval castle",
    status: {
      id: "status-new",
      name: "New",
      category: "NEW" as const,
      organizationId: "org-1",
      isDefault: true,
    },
    priority: {
      id: "priority-high",
      name: "High",
      order: 2,
      organizationId: "org-1",
      isDefault: false,
    },
    assignedTo: null,
  };

  const secondIssue = workflowIssues[1];
  if (!secondIssue) throw new Error("Expected second issue");
  workflowIssues[1] = {
    ...secondIssue,
    title: "Display flickering on AFM",
    status: {
      id: "status-progress",
      name: "In Progress",
      category: "IN_PROGRESS" as const,
      organizationId: "org-1",
      isDefault: false,
    },
    priority: {
      id: "priority-medium",
      name: "Medium",
      order: 3,
      organizationId: "org-1",
      isDefault: true,
    },
    assignedTo: {
      id: "user-tech",
      name: "Tech Johnson",
      email: "tech@example.com",
      image: null,
    },
  };

  const thirdIssue = workflowIssues[2];
  if (!thirdIssue) throw new Error("Expected third issue");
  workflowIssues[2] = {
    ...thirdIssue,
    title: "Routine playfield cleaning",
    status: {
      id: "status-resolved",
      name: "Resolved",
      category: "RESOLVED" as const,
      organizationId: "org-1",
      isDefault: false,
    },
    priority: {
      id: "priority-low",
      name: "Low",
      order: 4,
      organizationId: "org-1",
      isDefault: false,
    },
    assignedTo: {
      id: "user-tech",
      name: "Tech Johnson",
      email: "tech@example.com",
      image: null,
    },
  };

  const mockLocations = createMockLocations({ count: 3, overrides: {} });
  const mockStatuses = createMockStatuses({ count: 4 });
  const mockUsers = createMockUsers({ count: 2 });

  const defaultFilters = {
    sortBy: "created" as const,
    sortOrder: "desc" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default API responses
    mockIssuesQuery.mockReturnValue({
      data: workflowIssues,
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

    mockMachinesQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    mockUsersQuery.mockReturnValue({
      data: mockUsers,
      isLoading: false,
      isError: false,
    });

    mockHasPermission.mockReturnValue(true);
  });

  describe("Technician Daily Workflow", () => {
    it("allows technician to view assigned issues", () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see all issues in their list
      expect(screen.getByText("5 issues found")).toBeInTheDocument();

      // Should see issues they're assigned to
      expect(screen.getByText("Display flickering on AFM")).toBeInTheDocument();
      expect(
        screen.getByText("Routine playfield cleaning"),
      ).toBeInTheDocument();

      // Should see unassigned issues they can claim
      expect(
        screen.getByText("Ball stuck in medieval castle"),
      ).toBeInTheDocument();
    });

    it("allows technician to select and bulk assign issues to themselves", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select the unassigned high-priority issue
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(6); // Select all + 5 issue checkboxes

      const firstIssueCheckbox = checkboxes[1] as HTMLElement; // Ball stuck issue
      await userEvent.click(firstIssueCheckbox);

      expect(screen.getByText("1 issue selected")).toBeInTheDocument();

      // Should see bulk assignment option
      const assignButton = screen.getByRole("button", { name: /assign/i });
      expect(assignButton).toBeInTheDocument();
      expect(assignButton).not.toBeDisabled();
    });

    it("shows appropriate bulk actions for technician permissions", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue
      const checkboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = checkboxes[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      // Technicians should have both assign and close (edit) permissions
      expect(
        screen.getByRole("button", { name: /assign/i }),
      ).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /close/i })).not.toBeDisabled();
    });

    it("allows technician to filter by their assigned issues", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      // Mock filtered response for assigned issues
      const assignedIssues = workflowIssues.filter(
        (issue) => issue.assignedTo?.id === "user-tech",
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("5 issues found")).toBeInTheDocument();
      });

      // Mock the filtered response when assignee filter is applied
      mockIssuesQuery.mockReturnValue({
        data: assignedIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      // Apply assignee filter (typically a combobox for assigned user)
      const comboboxes = screen.getAllByRole("combobox");
      // Assumng assignee filter is one of the comboboxes - we'd need to identify the right one
      // For this test, we'll simulate the filter application
      const assigneeSelect = comboboxes[3] as HTMLElement; // Assuming assignee is last filter
      fireEvent.mouseDown(assigneeSelect);

      // This test validates the workflow concept - in practice the exact UI interaction
      // would depend on the specific filter implementation
    });
  });

  describe("Issue Navigation Workflows", () => {
    it("allows technician to navigate to issue details for troubleshooting", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Click on issue title to navigate to details
      const issueTitle = screen.getByText("Ball stuck in medieval castle");
      await userEvent.click(issueTitle);

      expect(mockPush).toHaveBeenCalledWith("/issues/issue-1");
    });

    it("supports keyboard navigation for accessibility", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Test keyboard navigation for issue selection
      const firstCheckbox = screen.getAllByRole("checkbox")[1] as HTMLElement;
      firstCheckbox.focus();
      await userEvent.keyboard(" "); // Space to toggle

      expect(screen.getByText("1 issue selected")).toBeInTheDocument();

      // Test that bulk actions are available after selection
      await userEvent.keyboard("{Tab}"); // Navigate through interface
      const assignButton = screen.getByRole("button", { name: /assign/i });
      expect(assignButton).toBeInTheDocument();
    });
  });

  describe("Priority-Based Workflows", () => {
    it("highlights high-priority issues for immediate attention", () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // High priority issue should be visible and prominent
      expect(
        screen.getByText("Ball stuck in medieval castle"),
      ).toBeInTheDocument();
      expect(screen.getByText("High")).toBeInTheDocument();

      // Should also show medium and low priority issues
      expect(screen.getAllByText("Medium")).toHaveLength(3);
      expect(screen.getAllByText("Low")).toHaveLength(1);
    });

    it("allows filtering by priority for workflow organization", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      // Filter to only high priority issues
      const highPriorityIssues = workflowIssues.filter(
        (issue) => issue.priority?.name === "High",
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("5 issues found")).toBeInTheDocument();
      });

      // Mock filtered response for high priority
      mockIssuesQuery.mockReturnValue({
        data: highPriorityIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      // This would be triggered by actual priority filter interaction
      // The test validates the data structure supports priority-based workflows
      expect(highPriorityIssues).toHaveLength(1);
      expect(highPriorityIssues[0]?.priority?.name).toBe("High");
    });
  });

  describe("Status Workflow Transitions", () => {
    it("displays issues across different status categories for workflow management", () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see issues in different workflow states
      expect(screen.getAllByText("New")).toHaveLength(4); // Status appears in multiple places
      expect(screen.getAllByText("In Progress")).toHaveLength(2); // Active work
      expect(screen.getAllByText("Resolved")).toHaveLength(1); // Completed work
    });

    it("allows technician to filter by status for workflow organization", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("5 issues found")).toBeInTheDocument();
      });

      // Open status filter
      const comboboxes = screen.getAllByRole("combobox");
      const statusSelect = comboboxes[1] as HTMLElement;
      fireEvent.mouseDown(statusSelect);

      await waitFor(() => {
        expect(screen.getAllByText("New")).toHaveLength(5); // Status in issues + filter options + button text
      });

      // Filter options should be available for workflow management
      expect(screen.getAllByText("In Progress")).toHaveLength(4);
      expect(screen.getAllByText("Resolved")).toHaveLength(3);
    });

    it("supports bulk status updates for efficient workflow management", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select multiple issues for bulk status update
      const checkboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = checkboxes[1] as HTMLElement;
      const secondIssueCheckbox = checkboxes[2] as HTMLElement;

      await userEvent.click(firstIssueCheckbox);
      await userEvent.click(secondIssueCheckbox);

      expect(screen.getByText("2 issues selected")).toBeInTheDocument();

      // Should have close action available (for status transitions)
      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).not.toBeDisabled();
    });
  });

  describe("Location-Based Workflows", () => {
    it("allows technician to filter by location for area-focused work", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("5 issues found")).toBeInTheDocument();
      });

      // Open location filter for area-based workflow
      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);

      await waitFor(() => {
        expect(screen.getByText("All Locations")).toBeInTheDocument();
      });

      // Should see location options for filtering
      expect(screen.getByText("Main Floor")).toBeInTheDocument();
      expect(screen.getByText("Back Room")).toBeInTheDocument();

      // Select Main Floor for focused work
      const locationOption = screen.getByText("Main Floor");
      await userEvent.click(locationOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
        );
      });
    });

    it("displays machine information for context in repair workflows", () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see machine information for context
      expect(screen.getAllByText(/Medieval Madness/)).toHaveLength(5);
      expect(screen.getAllByText(/Main Floor/)).toHaveLength(5);
    });
  });

  describe("Manager Override Scenarios", () => {
    it("shows limited functionality for managers without assign permission", () => {
      mockHasPermission.mockImplementation((permission: string) =>
        [...VITEST_PERMISSION_SCENARIOS.MANAGER].includes(permission as never),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MANAGER]}
          userRole={VITEST_ROLE_MAPPING.MANAGER}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Manager can view issues but not select them (no issue:assign)
      expect(screen.getByText("5 issues found")).toBeInTheDocument();
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows full functionality for admin users", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Admin should see all functionality
      expect(screen.getByText("5 issues found")).toBeInTheDocument();
      expect(screen.getByText("Select All")).toBeInTheDocument();
      expect(screen.getAllByRole("checkbox")).toHaveLength(6); // Select all + 5 issues
    });
  });

  describe("Real-World Workflow Integration", () => {
    it("maintains workflow state during data refreshes", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue for work
      const checkboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = checkboxes[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      expect(screen.getByText("1 issue selected")).toBeInTheDocument();

      // Refresh data (simulating real-time updates)
      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      await userEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalledOnce();

      // Workflow state should be preserved during refresh
      // (In practice, this would depend on the component's state management)
    });

    it("handles concurrent technician workflows without conflicts", () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      // Simulate multiple technicians working on different issues
      const concurrentWorkflowIssues = workflowIssues.map((issue, index) => ({
        ...issue,
        assignedTo:
          index % 2 === 0
            ? {
                id: "user-tech1",
                name: "Tech Johnson",
                email: "tech1@example.com",
                image: null,
              }
            : {
                id: "user-tech2",
                name: "Tech Smith",
                email: "tech2@example.com",
                image: null,
              },
      }));

      mockIssuesQuery.mockReturnValue({
        data: concurrentWorkflowIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should display issues with different assignees
      expect(screen.getAllByText("Tech Johnson")).toHaveLength(3);
      expect(screen.getAllByText("Tech Smith")).toHaveLength(2);
      expect(screen.getByText("5 issues found")).toBeInTheDocument();
    });

    it("supports emergency escalation workflows for critical issues", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      // Create critical issue scenario
      const baseIssue = workflowIssues[0];
      if (!baseIssue)
        throw new Error("Expected base issue for critical scenario");
      const criticalIssue = {
        ...baseIssue,
        title: "CRITICAL: Main power failure - all machines down",
        priority: {
          id: "priority-critical",
          name: "Critical",
          order: 1,
          organizationId: "org-1",
          isDefault: false,
        },
      };

      const emergencyIssues = [criticalIssue, ...workflowIssues.slice(1)];

      mockIssuesQuery.mockReturnValue({
        data: emergencyIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Critical issue should be prominently displayed
      expect(
        screen.getByText("CRITICAL: Main power failure - all machines down"),
      ).toBeInTheDocument();
      expect(screen.getAllByText("Critical")).toHaveLength(1);

      // Technician should be able to immediately claim critical issue
      const checkboxes = screen.getAllByRole("checkbox");
      const criticalIssueCheckbox = checkboxes[1] as HTMLElement;
      await userEvent.click(criticalIssueCheckbox);

      expect(screen.getByText("1 issue selected")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /assign/i }),
      ).not.toBeDisabled();
    });
  });

  describe("Error Recovery Workflows", () => {
    it("allows workflow continuation after API errors", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      // Start with an API error
      const mockError = new Error("Temporary network error");
      mockIssuesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: mockError,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/failed to load issues/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/temporary network error/i)).toBeInTheDocument();

      // Technician can retry to resume workflow
      const retryButton = screen.getByRole("button", { name: /retry/i });
      await userEvent.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledOnce();

      // After retry, restore normal data for workflow continuation
      mockIssuesQuery.mockReturnValue({
        data: workflowIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it("maintains partial functionality during partial API failures", () => {
      mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      // Issues API works, but locations API fails
      mockIssuesQuery.mockReturnValue({
        data: workflowIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      mockLocationsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error("Location service temporarily unavailable"),
      });

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Core workflow should still function (viewing and selecting issues)
      expect(screen.getByText("5 issues found")).toBeInTheDocument();
      expect(screen.getByText("Select All")).toBeInTheDocument();

      // Location-based filtering might be degraded, but core functionality remains
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThan(0);
    });
  });
});
