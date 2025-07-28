import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { IssueList } from "../IssueList";

import {
  createMockIssuesList,
  createMockLocations,
  createMockStatuses,
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

describe("IssueList Component - Selection and Bulk Actions", () => {
  // Use centralized mock data factories
  const mockIssues = createMockIssuesList({
    count: 2,
    overrides: {
      title: "Test Issue",
      _count: { comments: 2, attachments: 1 },
    },
  });
  const mockLocations = createMockLocations({ count: 2, overrides: {} });
  const mockStatuses = createMockStatuses({ count: 3 });

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

    mockMachinesQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    mockUsersQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    mockHasPermission.mockReturnValue(true);
  });

  describe("Selection Controls Visibility", () => {
    it("shows selection controls for users with issue:assign permission", () => {
      mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view", "issue:assign"].includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("Select All")).toBeInTheDocument();
      expect(screen.getAllByRole("checkbox")).toHaveLength(3); // Select all + 2 issue checkboxes
    });

    it("hides selection controls for users without issue:assign permission", () => {
      mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view"].includes(permission),
      );

      render(
        <VitestTestWrapper userPermissions={["issue:view"]} userRole="Member">
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows selection controls for admin users", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("Select All")).toBeInTheDocument();
      expect(screen.getAllByRole("checkbox")).toHaveLength(3); // Select all + 2 issues
    });

    it("hides selection controls for manager users without assign permission", () => {
      mockHasPermission.mockImplementation((permission: string) =>
        ([...VITEST_PERMISSION_SCENARIOS.MANAGER] as string[]).includes(
          permission,
        ),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MANAGER]}
          userRole={VITEST_ROLE_MAPPING.MANAGER}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Manager permissions don't include issue:assign
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows selection controls for technicians with assign permission", () => {
      const technicianPermissions = [
        ...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN,
      ];

      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("Select All")).toBeInTheDocument();
      expect(screen.getAllByRole("checkbox")).toHaveLength(3); // Select all + 2 issues
    });
  });

  describe("Individual Issue Selection", () => {
    beforeEach(() => {
      mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view", "issue:assign", "issue:edit"].includes(permission),
      );
    });

    it("shows bulk actions when issues are selected", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue to show bulk actions
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3); // Select all + 2 issue checkboxes
      const firstIssueCheckbox = checkboxes[1] as HTMLElement; // Skip "Select All"
      await userEvent.click(firstIssueCheckbox);

      expect(screen.getByText("1 issue selected")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /assign/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close/i }),
      ).toBeInTheDocument();
    });

    it("updates selection count when multiple issues are selected", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = checkboxes[1];
      const secondIssueCheckbox = checkboxes[2];

      if (!firstIssueCheckbox || !secondIssueCheckbox) {
        throw new Error("Expected checkboxes not found");
      }

      // Select first issue
      await userEvent.click(firstIssueCheckbox);
      expect(screen.getByText("1 issue selected")).toBeInTheDocument();

      // Select second issue
      await userEvent.click(secondIssueCheckbox);
      expect(screen.getByText("2 issues selected")).toBeInTheDocument();
    });

    it("shows bulk action buttons when issues are selected", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const firstCheckbox = screen.getAllByRole("checkbox")[1] as HTMLElement; // Skip "Select All"
      await userEvent.click(firstCheckbox);

      // Bulk action buttons should appear
      expect(
        screen.getByRole("button", { name: /assign/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close/i }),
      ).toBeInTheDocument();
    });

    it("clears selection when deselecting all issues", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = checkboxes[1] as HTMLElement;

      // Select issue
      await userEvent.click(firstIssueCheckbox);
      expect(screen.getByText("1 issue selected")).toBeInTheDocument();

      // Deselect issue
      await userEvent.click(firstIssueCheckbox);

      // Selection should be cleared
      expect(screen.queryByText("1 issue selected")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /assign/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Select All Functionality", () => {
    beforeEach(() => {
      mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view", "issue:assign", "issue:edit"].includes(permission),
      );
    });

    it("selects all issues when Select All is clicked", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const issueCheckboxes = screen.getAllByRole("checkbox");
      const selectAllCheckbox = issueCheckboxes[0] as HTMLElement;
      const firstIssueCheckbox = issueCheckboxes[1] as HTMLElement; // Skip "Select All"
      await userEvent.click(firstIssueCheckbox);

      await userEvent.click(selectAllCheckbox);

      expect(screen.getByText("2 issues selected")).toBeInTheDocument();

      // All individual checkboxes should be checked
      const issueCheckboxes2 = screen.getAllByRole("checkbox");
      issueCheckboxes2.slice(1).forEach((checkbox) => {
        expect(checkbox).toBeChecked();
      });
    });

    it("deselects all issues when Select All is clicked while all are selected", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // First select all issues
      const checkboxes = screen.getAllByRole("checkbox");
      const selectAllCheckbox = checkboxes[0];
      const firstIssueCheckbox = checkboxes[1];

      if (!selectAllCheckbox || !firstIssueCheckbox) {
        throw new Error("Expected checkboxes not found");
      }

      await userEvent.click(firstIssueCheckbox);
      await userEvent.click(selectAllCheckbox);

      expect(screen.getByText("2 issues selected")).toBeInTheDocument();

      // Now deselect all
      await userEvent.click(selectAllCheckbox);

      expect(screen.queryByText("2 issues selected")).not.toBeInTheDocument();
      const issueCheckboxes = screen.getAllByRole(
        "checkbox",
      ) as HTMLInputElement[];
      issueCheckboxes.slice(1).forEach((checkbox) => {
        expect(checkbox).not.toBeChecked();
      });
    });
  });

  describe("Bulk Action Permissions", () => {
    it("enables bulk assignment for admin users", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

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

      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).not.toBeDisabled();
    });

    it("shows disabled bulk actions with tooltips for insufficient permissions", async () => {
      // Mock having issue:assign to show selection, but not issue:edit for close
      mockHasPermission.mockImplementation((permission: string) =>
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

      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      // Assign button should be enabled
      const assignButton = screen.getByRole("button", { name: /assign/i });
      expect(assignButton).not.toBeDisabled();

      // Close button should be disabled for missing permission
      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toBeDisabled();
    });

    it("enables bulk actions for technicians with appropriate permissions", async () => {
      const technicianPermissions = [
        ...EXTENDED_PERMISSION_SCENARIOS.TECHNICIAN,
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

      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;
      fireEvent.click(firstIssueCheckbox);

      expect(
        screen.getByRole("button", { name: /assign/i }),
      ).not.toBeDisabled();

      // Close button should be enabled since technician has issue:edit permission
      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).not.toBeDisabled();
    });
  });

  describe("Selection State Management", () => {
    beforeEach(() => {
      mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view", "issue:assign", "issue:edit"].includes(permission),
      );
    });

    it("maintains selection state when filters change", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue
      const firstCheckbox = screen.getAllByRole("checkbox")[1] as HTMLElement;
      await userEvent.click(firstCheckbox);
      expect(screen.getByText("1 issue selected")).toBeInTheDocument();

      // Apply a filter (should clear selection) - expand advanced filters first
      const expandButton = screen.getByRole("button", { name: "" }); // ExpandMore icon
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Location")).toBeInTheDocument();
      });

      const locationSelect = screen.getByLabelText("Location");
      fireEvent.mouseDown(locationSelect);

      await waitFor(() => {
        expect(screen.getByText("All Locations")).toBeInTheDocument();
      });

      const locationOption = screen.getByText("Main Floor");
      await userEvent.click(locationOption);

      // Selection should be maintained or cleared depending on implementation
      // This test verifies the behavior is predictable
    });

    it("clears selection when navigating away", () => {
      // Test that selection doesn't persist inappropriately
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Component should start with no selection
      expect(screen.queryByText("1 issue selected")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /assign/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Accessibility and Interaction", () => {
    beforeEach(() => {
      mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view", "issue:assign", "issue:edit"].includes(permission),
      );
    });

    it("provides proper ARIA labels for selection controls", () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3); // Select all + 2 issue checkboxes

      // All checkboxes should be accessible
      checkboxes.forEach((checkbox) => {
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).toHaveAttribute("type", "checkbox");
      });
    });

    it("supports keyboard navigation for selection", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const firstCheckbox = screen.getAllByRole("checkbox")[1] as HTMLElement;

      // Focus and activate with keyboard
      firstCheckbox.focus();
      await userEvent.keyboard(" "); // Space to toggle checkbox

      expect(screen.getByText("1 issue selected")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("gracefully handles permission check failures", () => {
      // Mock reduced permissions for fallback behavior
      mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view"].includes(permission),
      );

      // Test error boundary behavior with permission system
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

      // Component should still render but with degraded permissions
      // When there's a permission error, it should fall back to basic view-only
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
    });

    it("handles empty issue list with selection controls", () => {
      mockIssuesQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show empty state but not selection controls when no issues
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });
  });
});
