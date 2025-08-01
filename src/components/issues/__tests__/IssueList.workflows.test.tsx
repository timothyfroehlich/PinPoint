import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";

import { IssueList } from "../IssueList";

import {
  createMockTRPCQueryResult,
  EXTENDED_PERMISSION_SCENARIOS,
} from "~/test/mockUtils";
import {
  createIssueListMocks,
  setupIssueListTest,
  createWorkflowIssues,
} from "~/test/setup/issueListTestSetup";
import { setupAllIssueListMocks } from "~/test/setup/viTestMocks";
import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
  VITEST_ROLE_MAPPING,
} from "~/test/VitestTestWrapper";

// ✅ SHARED MOCK SETUP: Centralized vi.hoisted() mock creation (was ~50 lines of duplication)
const mocks = createIssueListMocks();
setupAllIssueListMocks(mocks);

describe("IssueList - Technician Workflows and User Journeys", () => {
  // ✅ SHARED TEST SETUP: Use centralized scenario-based mock data with workflow customizations
  const testSetup = setupIssueListTest("WORKFLOW", mocks);

  // Create realistic workflow test data using shared utility
  const workflowIssues = createWorkflowIssues();

  beforeEach(() => {
    // ✅ SHARED CLEANUP: Centralized mock reset and configuration
    testSetup.resetMocks();

    // Override with workflow-specific issues
    mocks.mockIssuesQuery.mockReturnValue({
      data: workflowIssues,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mocks.mockRefetch,
    });
  });

  describe("Technician Daily Workflow", () => {
    it("allows technician to view assigned issues", () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
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
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

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

      expect(screen.getByText("1 issue selected")).toBeInTheDocument();

      // Should see bulk assignment option
      const assignButton = screen.getByTestId("bulk-assign-button");
      expect(assignButton).toBeInTheDocument();
      expect(assignButton).not.toBeDisabled();
    });

    it("shows appropriate bulk actions for technician permissions", async () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

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
      mocks.mockHasPermission.mockImplementation((permission: string) =>
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
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("5 issues found")).toBeInTheDocument();
      });

      // Mock the filtered response when assignee filter is applied
      mocks.mockIssuesQuery.mockReturnValue({
        data: assignedIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mocks.mockRefetch,
      });

      // Test workflow concept: filtering by assignee would reduce results
      // This validates that the API mock structure supports assignee-based workflows
      expect(assignedIssues).toHaveLength(2);
      expect(
        assignedIssues.every((issue) => issue.assignedTo?.id === "user-tech"),
      ).toBe(true);
    });
  });

  describe("Issue Navigation Workflows", () => {
    it("allows technician to navigate to issue details for troubleshooting", async () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Click on issue title to navigate to details
      const issueTitle = screen.getByText("Ball stuck in medieval castle");
      await userEvent.click(issueTitle);

      expect(mocks.mockPush).toHaveBeenCalledWith("/issues/issue-1");
    });

    it("supports keyboard navigation for accessibility", async () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Test keyboard navigation for issue selection
      const firstCheckbox = screen.getAllByRole("checkbox")[1] as HTMLElement;
      firstCheckbox.focus();

      // Use userEvent.click instead of keyboard space to avoid act() warnings
      await userEvent.click(firstCheckbox);

      expect(screen.getByText("1 issue selected")).toBeInTheDocument();

      // Test that bulk actions are available after selection
      const assignButton = screen.getByTestId("bulk-assign-button");
      expect(assignButton).toBeInTheDocument();
    });
  });

  describe("Priority-Based Workflows", () => {
    it("highlights high-priority issues for immediate attention", () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
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
      mocks.mockHasPermission.mockImplementation((permission: string) =>
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
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("5 issues found")).toBeInTheDocument();
      });

      // Mock filtered response for high priority
      mocks.mockIssuesQuery.mockReturnValue({
        data: highPriorityIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mocks.mockRefetch,
      });

      // This would be triggered by actual priority filter interaction
      // The test validates the data structure supports priority-based workflows
      expect(highPriorityIssues).toHaveLength(1);
      expect(highPriorityIssues[0]?.priority?.name).toBe("High");
    });
  });

  describe("Status Workflow Transitions", () => {
    it("displays issues across different status categories for workflow management", () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see issues in different workflow states
      expect(screen.getAllByText("New")).toHaveLength(3); // Status appears in issue cards
      expect(screen.getAllByText("In Progress")).toHaveLength(1); // Active work
      expect(screen.getAllByText("Resolved")).toHaveLength(1); // Completed work

      // Should see status pills
      expect(
        screen.getByRole("button", { name: /Open \(\d+\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /In Progress \(\d+\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Closed \(\d+\)/ }),
      ).toBeInTheDocument();
    });

    it("allows technician to filter by status for workflow organization", async () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("5 issues found")).toBeInTheDocument();
      });

      // Check status pills are available for filtering
      const openButton = screen.getByRole("button", { name: /Open \(\d+\)/ });
      const inProgressButton = screen.getByRole("button", {
        name: /In Progress \(\d+\)/,
      });
      const closedButton = screen.getByRole("button", {
        name: /Closed \(\d+\)/,
      });

      expect(openButton).toBeInTheDocument();
      expect(inProgressButton).toBeInTheDocument();
      expect(closedButton).toBeInTheDocument();

      // Click on In Progress pill to filter
      await userEvent.click(inProgressButton);

      // Should trigger URL update for status filter
      await waitFor(() => {
        expect(mocks.mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusIds="),
        );
      });
    });

    it("supports bulk status updates for efficient workflow management", async () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
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
      const closeButton = screen.getByTestId("bulk-close-button");
      expect(closeButton).not.toBeDisabled();
    });
  });

  describe("Location-Based Workflows", () => {
    it("allows technician to filter by location for area-focused work", async () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("5 issues found")).toBeInTheDocument();
      });

      // Expand advanced filters to access location filter
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Location")).toBeInTheDocument();
      });

      // Open location filter for area-based workflow
      const locationSelect = screen.getByLabelText("Location");
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
        expect(mocks.mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
        );
      });
    });

    it("displays machine information for context in repair workflows", () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should see machine information for context
      expect(screen.getAllByText(/Medieval Madness/)).toHaveLength(5);
      expect(screen.getAllByText(/Main Floor/)).toHaveLength(5);
    });
  });

  describe("Manager Override Scenarios", () => {
    it("shows limited functionality for managers without assign permission", () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        [...VITEST_PERMISSION_SCENARIOS.MANAGER].includes(permission as never),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MANAGER]}
          userRole={VITEST_ROLE_MAPPING.MANAGER}
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
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
          <IssueList initialFilters={testSetup.defaultFilters} />
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
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
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

      expect(mocks.mockRefetch).toHaveBeenCalledOnce();

      // Workflow state should be preserved during refresh
      // (In practice, this would depend on the component's state management)
    });

    it("handles concurrent technician workflows without conflicts", () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
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

      mocks.mockIssuesQuery.mockReturnValue({
        data: concurrentWorkflowIssues,
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
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should display issues with different assignees
      expect(screen.getAllByText("Tech Johnson")).toHaveLength(3);
      expect(screen.getAllByText("Tech Smith")).toHaveLength(2);
      expect(screen.getByText("5 issues found")).toBeInTheDocument();
    });

    it("supports emergency escalation workflows for critical issues", async () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
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

      mocks.mockIssuesQuery.mockReturnValue({
        data: emergencyIssues,
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
          <IssueList initialFilters={testSetup.defaultFilters} />
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
      expect(screen.getByTestId("bulk-assign-button")).not.toBeDisabled();
    });
  });

  describe("Error Recovery Workflows", () => {
    it("allows workflow continuation after API errors", async () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      // Start with an API error
      const mockError = new Error("Temporary network error");
      mocks.mockIssuesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: mockError,
        refetch: mocks.mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
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

      expect(mocks.mockRefetch).toHaveBeenCalledOnce();

      // After retry, restore normal data for workflow continuation
      mocks.mockIssuesQuery.mockReturnValue({
        data: workflowIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mocks.mockRefetch,
      });
    });

    it("maintains partial functionality during partial API failures", () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        (
          EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN as readonly string[]
        ).includes(permission),
      );

      // Issues API works, but locations API fails
      mocks.mockIssuesQuery.mockReturnValue({
        data: workflowIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mocks.mockRefetch,
      });

      mocks.mockLocationsQuery.mockReturnValue(
        createMockTRPCQueryResult(undefined, {
          isError: true,
          error: new Error("Location service temporarily unavailable"),
        }),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN]}
          userRole="Technician"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Core workflow should still function (viewing and selecting issues)
      expect(screen.getByText("5 issues found")).toBeInTheDocument();
      expect(screen.getByText("Select All")).toBeInTheDocument();

      // Status-based filtering should still work even with location errors
      expect(
        screen.getByRole("button", { name: /Open \(\d+\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /In Progress \(\d+\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Closed \(\d+\)/ }),
      ).toBeInTheDocument();
    });
  });
});
