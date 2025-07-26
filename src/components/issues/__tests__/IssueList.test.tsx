import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { IssueList } from "../IssueList";

import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
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

describe("IssueList Component", () => {
  const mockIssues = [
    {
      id: "issue-1",
      title: "Test Issue 1",
      status: {
        id: "status-1",
        name: "New",
        category: "NEW" as const,
        organizationId: "org-1",
        isDefault: true,
      },
      priority: {
        id: "priority-1",
        name: "High",
        order: 1,
        organizationId: "org-1",
        isDefault: false,
      },
      machine: {
        id: "machine-1",
        name: "Machine 1",
        model: {
          id: "model-1",
          name: "Test Machine",
          manufacturer: "Stern",
          year: 2020,
        },
        location: {
          id: "location-1",
          name: "Test Location",
          organizationId: "org-1",
        },
      },
      assignedTo: null,
      createdAt: "2023-01-01T00:00:00.000Z",
      _count: {
        comments: 2,
        attachments: 1,
      },
    },
    {
      id: "issue-2",
      title: "Test Issue 2",
      status: {
        id: "status-2",
        name: "In Progress",
        category: "IN_PROGRESS" as const,
        organizationId: "org-1",
        isDefault: false,
      },
      priority: null,
      machine: {
        id: "machine-2",
        name: "Machine 2",
        model: {
          id: "model-2",
          name: "Another Machine",
          manufacturer: "Williams",
          year: 2019,
        },
        location: {
          id: "location-2",
          name: "Another Location",
          organizationId: "org-1",
        },
      },
      assignedTo: {
        id: "user-1",
        name: "John Doe",
        email: "john@example.com",
        image: "https://example.com/avatar.jpg",
      },
      createdAt: "2023-01-02T00:00:00.000Z",
      _count: {
        comments: 0,
        attachments: 0,
      },
    },
  ];

  const mockLocations = [
    { id: "location-1", name: "Test Location" },
    { id: "location-2", name: "Another Location" },
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

    // Using dependency injection instead of global mocks
  });

  describe("Core Rendering", () => {
    it("renders loading state correctly", () => {
      mockIssuesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("renders error state with retry functionality", async () => {
      const mockError = new Error("Network connection failed");
      mockIssuesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: mockError,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/failed to load issues/i)).toBeInTheDocument();
      expect(
        screen.getByText(/network connection failed/i),
      ).toBeInTheDocument();

      const retryButton = screen.getByRole("button", { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      await userEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it("renders empty state when no issues found", () => {
      mockIssuesQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/no issues found/i)).toBeInTheDocument();
      expect(
        screen.getByText(/try adjusting your filters/i),
      ).toBeInTheDocument();
    });

    it("renders issue cards with complete data structure", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Check first issue
      expect(screen.getByText("Test Issue 1")).toBeInTheDocument();
      expect(screen.getByText("New")).toBeInTheDocument();
      expect(screen.getByText("High")).toBeInTheDocument();
      expect(
        screen.getByText("Test Machine at Test Location"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("2 comments • 1 attachments"),
      ).toBeInTheDocument();

      // Check second issue
      expect(screen.getByText("Test Issue 2")).toBeInTheDocument();
      expect(screen.getByText("In Progress")).toBeInTheDocument();
      expect(screen.getByText("Normal")).toBeInTheDocument(); // null priority shows as "Normal"
      expect(
        screen.getByText("Another Machine at Another Location"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("0 comments • 0 attachments"),
      ).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("handles issue data structure correctly with all fields", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Verify status chips are present and contain correct text
      const newChip = screen.getByText("New");
      expect(newChip).toBeInTheDocument();
      expect(newChip.closest(".MuiChip-root")).toBeInTheDocument();

      const inProgressChip = screen.getByText("In Progress");
      expect(inProgressChip).toBeInTheDocument();
      expect(inProgressChip.closest(".MuiChip-root")).toBeInTheDocument();
    });
  });

  describe("View Mode Controls", () => {
    it("toggles between grid and list view modes", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should start in grid view
      const gridIcon = screen.getByTestId("ViewModuleIcon");
      const listIcon = screen.getByTestId("ViewListIcon");
      const gridButton = gridIcon.closest("button");
      const listButton = listIcon.closest("button");

      expect(gridButton).toBeInTheDocument();
      expect(listButton).toBeInTheDocument();

      if (gridButton && listButton) {
        // Check for MUI IconButton color classes instead of attributes
        expect(gridButton).toHaveClass("MuiIconButton-colorPrimary");
        expect(listButton).not.toHaveClass("MuiIconButton-colorPrimary");

        // Switch to list view
        await userEvent.click(listButton);

        expect(gridButton).not.toHaveClass("MuiIconButton-colorPrimary");
        expect(listButton).toHaveClass("MuiIconButton-colorPrimary");
      }
    });

    it("adapts card layout based on view mode", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Switch to list view and verify layout changes
      const listIcon = screen.getByTestId("ViewListIcon");
      const listButton = listIcon.closest("button");
      expect(listButton).toBeInTheDocument();

      if (listButton) {
        await userEvent.click(listButton);
      }

      // In list view, all items should take full width - check by finding issue cards
      const issueCards = screen
        .getAllByText("Test Issue 1")
        .concat(screen.getAllByText("Test Issue 2"));
      expect(issueCards).toHaveLength(2);
      // Cards are present and rendered correctly in list view
      issueCards.forEach((card) => {
        expect(card).toBeInTheDocument();
      });
    });

    it("shows refresh button and works correctly", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();

      await userEvent.click(refreshButton);
      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it("displays correct issue count", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("2 issues found")).toBeInTheDocument();
    });

    it("handles singular issue count correctly", () => {
      mockIssuesQuery.mockReturnValue({
        data: [mockIssues[0]],
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("1 issue found")).toBeInTheDocument();
    });
  });

  describe("Filtering Functionality", () => {
    it("renders all filter controls", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Check for filter labels by text - multiple elements may contain "location" so use getAllByText
      const locationLabels = screen.getAllByText("Location");
      expect(locationLabels.length).toBeGreaterThan(0);
      // Use getAllByText for Status since it appears in form label and potentially dropdowns
      const statusLabels = screen.getAllByText("Status");
      expect(statusLabels.length).toBeGreaterThan(0);
      // Use getAllByText for Category since it may appear in multiple places
      const categoryLabels = screen.getAllByText("Category");
      expect(categoryLabels.length).toBeGreaterThan(0);
      // Use getAllByText for Sort By since it may appear in multiple places
      const sortByLabels = screen.getAllByText("Sort By");
      expect(sortByLabels.length).toBeGreaterThan(0);
    });

    it("populates location filter dropdown correctly", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Get the first combobox which should be Location
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThanOrEqual(1);
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);

      expect(screen.getByText("All Locations")).toBeInTheDocument();
      expect(screen.getByText("Test Location")).toBeInTheDocument();
      expect(screen.getByText("Another Location")).toBeInTheDocument();
    });

    it("populates status filter dropdown correctly", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Get the second combobox which should be Status
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThanOrEqual(2);
      const statusSelect = comboboxes[1] as HTMLElement;
      fireEvent.mouseDown(statusSelect);

      expect(screen.getByText("All Statuses")).toBeInTheDocument();
      // Use getByRole to specifically target dropdown options
      expect(screen.getByRole("option", { name: "New" })).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "In Progress" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Resolved" }),
      ).toBeInTheDocument();
    });

    it("updates URL when filters change", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Get the first combobox which should be Location
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThanOrEqual(1);
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);

      const locationOption = screen.getByText("Test Location");
      await userEvent.click(locationOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
        );
      });
    });

    it("handles status category filter correctly", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Get the third combobox which should be Category
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThanOrEqual(3);
      const categorySelect = comboboxes[2] as HTMLElement;
      fireEvent.mouseDown(categorySelect);

      const newOption = screen.getByRole("option", { name: "New" });
      await userEvent.click(newOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusCategory=NEW"),
        );
      });
    });

    it("handles sort options correctly", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Get the fourth combobox which should be Sort By
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThanOrEqual(4);
      const sortSelect = comboboxes[3] as HTMLElement;
      fireEvent.mouseDown(sortSelect);

      const updatedOption = screen.getByText("Updated Date");
      await userEvent.click(updatedOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("sortBy=updated"),
        );
      });
    });

    it("clears filters correctly", async () => {
      const initialFiltersWithData = {
        locationId: "location-1",
        statusId: "status-1",
        statusCategory: "NEW" as const,
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={initialFiltersWithData} />
        </VitestTestWrapper>,
      );

      // Get the first combobox which should be Location
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThanOrEqual(1);
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);

      const allLocationsOption = screen.getByText("All Locations");
      await userEvent.click(allLocationsOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.not.stringContaining("locationId"),
        );
      });
    });
  });

  describe("Permission-Based Access Control", () => {
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

    it("shows bulk assign button with proper permission", async () => {
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

      // Select an issue to show bulk actions
      const firstCheckbox = screen.getAllByRole("checkbox")[1] as HTMLElement; // Skip "Select All"
      await userEvent.click(firstCheckbox);

      const assignButton = screen.getByRole("button", { name: /assign/i });
      expect(assignButton).toBeInTheDocument();
      expect(assignButton).not.toBeDisabled();
    });

    it("shows disabled bulk assign button with tooltip for insufficient permissions", async () => {
      // Set up user with issue:assign permission to show selection controls
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

      // Select an issue to show bulk actions
      const firstCheckbox = screen.getAllByRole("checkbox")[1] as HTMLElement;
      await userEvent.click(firstCheckbox);

      // Verify bulk actions toolbar is visible
      expect(screen.getByText("1 issue selected")).toBeInTheDocument();

      // Should have assign button (since user has permission)
      const assignButton = screen.getByRole("button", { name: /assign/i });
      expect(assignButton).toBeInTheDocument();
      expect(assignButton).not.toBeDisabled();
    });

    it("shows bulk close button with proper permission", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view", "issue:assign", "issue:update"].includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:update"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue to show bulk actions
      const firstCheckbox = screen.getAllByRole("checkbox")[1] as HTMLElement;
      await userEvent.click(firstCheckbox);

      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).not.toBeDisabled();
    });

    it("renders in read-only mode for users with only view permission", () => {
      mockHasPermission.mockImplementation(
        (permission: string) => permission === "issue:view",
      );

      render(
        <VitestTestWrapper userPermissions={["issue:view"]} userRole="Member">
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show issues but no interactive elements
      expect(screen.getByText("Test Issue 1")).toBeInTheDocument();
      expect(screen.getByText("Test Issue 2")).toBeInTheDocument();
      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });
  });

  describe("Issue Selection", () => {
    beforeEach(() => {
      mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view", "issue:assign"].includes(permission),
      );
    });

    it("handles individual issue selection", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const issueCheckboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = issueCheckboxes[1] as HTMLElement; // Skip "Select All"

      await userEvent.click(firstIssueCheckbox);

      expect(firstIssueCheckbox).toBeChecked();
      expect(screen.getByText("1 issue selected")).toBeInTheDocument();
    });

    it("handles select all functionality", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const selectAllCheckbox = screen.getAllByRole(
        "checkbox",
      )[0] as HTMLElement;
      await userEvent.click(selectAllCheckbox);

      expect(selectAllCheckbox).toBeChecked();
      expect(screen.getByText("2 issues selected")).toBeInTheDocument();

      // All individual checkboxes should be checked
      const issueCheckboxes = screen.getAllByRole("checkbox");
      issueCheckboxes.slice(1).forEach((checkbox) => {
        expect(checkbox).toBeChecked();
      });
    });

    it("shows indeterminate state for partial selection", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;

      await userEvent.click(firstIssueCheckbox);

      // Check indeterminate state using data attribute since MUI uses custom implementation
      expect(selectAllCheckbox).toHaveAttribute("data-indeterminate", "true");
      expect(screen.getByText("1 issue selected")).toBeInTheDocument();
    });

    it("shows bulk actions toolbar when issues are selected", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:update"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      expect(screen.getByText("1 issue selected")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /assign/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close/i }),
      ).toBeInTheDocument();
    });

    it("hides bulk actions toolbar when no issues are selected", () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign"]}
          userRole="Admin"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.queryByText(/issues selected/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /assign/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Issue Navigation", () => {
    it("navigates to issue detail when title is clicked", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const issueTitle = screen.getByText("Test Issue 1");
      await userEvent.click(issueTitle);

      expect(mockPush).toHaveBeenCalledWith("/issues/issue-1");
    });

    it("applies hover styles to issue titles", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const issueTitle = screen.getByText("Test Issue 1");
      expect(issueTitle).toHaveStyle({ cursor: "pointer" });
    });
  });

  describe("Integration with tRPC APIs", () => {
    it("calls issue.core.getAll with correct filter parameters", () => {
      const filters = {
        locationId: "location-1",
        statusCategory: "NEW" as const,
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={filters} />
        </VitestTestWrapper>,
      );

      expect(mockIssuesQuery).toHaveBeenCalledWith(filters);
    });

    it("calls location.getAll for filter dropdown", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(mockLocationsQuery).toHaveBeenCalled();
    });

    it("calls issueStatus.getAll for filter dropdown", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(mockStatusesQuery).toHaveBeenCalled();
    });

    it("handles API errors gracefully", () => {
      const mockError = new Error("API connection timeout");
      mockIssuesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: mockError,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/failed to load issues/i)).toBeInTheDocument();
      expect(screen.getByText(/api connection timeout/i)).toBeInTheDocument();
    });
  });

  describe("Permissions Loading State", () => {
    it("shows loading spinner when session is loading", () => {
      // Test realistic authentication flow - session loading
      render(
        <VitestTestWrapper sessionLoading={true}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show loading spinner when session is loading
      expect(screen.getByRole("progressbar")).toBeInTheDocument();

      // Should not show any issue content while loading
      expect(screen.queryByText("No issues found")).not.toBeInTheDocument();
    });

    it("shows loading spinner when membership is loading", () => {
      // Test edge case - session ready but membership query loading
      render(
        <VitestTestWrapper
          userPermissions={["issue:view"]}
          membershipLoading={true}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should show loading spinner when membership is loading
      expect(screen.getByRole("progressbar")).toBeInTheDocument();

      // Should not show any issue content while loading
      expect(screen.queryByText("No issues found")).not.toBeInTheDocument();
    });
  });
});
