import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { IssueList } from "../IssueList";

import { VitestTestWrapper } from "~/test/VitestTestWrapper";

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

describe("IssueList - Critical Technician User Journeys", () => {
  // Mock data representing realistic technician workflow scenarios
  const mockNewIssues = [
    {
      id: "issue-new-1",
      title: "Ball stuck in Medieval Madness castle",
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
      machine: {
        id: "machine-mm",
        name: "Medieval Madness #1",
        model: {
          id: "model-mm",
          name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
        },
        location: {
          id: "location-main",
          name: "Main Floor",
          organizationId: "org-1",
        },
      },
      assignedTo: null,
      createdAt: "2023-12-05T08:30:00.000Z",
      _count: {
        comments: 1,
        attachments: 2,
      },
    },
    {
      id: "issue-new-2",
      title: "Flipper not responding on Attack from Mars",
      status: {
        id: "status-new",
        name: "New",
        category: "NEW" as const,
        organizationId: "org-1",
        isDefault: true,
      },
      priority: {
        id: "priority-critical",
        name: "Critical",
        order: 1,
        organizationId: "org-1",
        isDefault: false,
      },
      machine: {
        id: "machine-afm",
        name: "Attack from Mars #2",
        model: {
          id: "model-afm",
          name: "Attack from Mars",
          manufacturer: "Bally",
          year: 1995,
        },
        location: {
          id: "location-main",
          name: "Main Floor",
          organizationId: "org-1",
        },
      },
      assignedTo: null,
      createdAt: "2023-12-05T09:15:00.000Z",
      _count: {
        comments: 0,
        attachments: 1,
      },
    },
    {
      id: "issue-new-3",
      title: "Display flickering on Theatre of Magic",
      status: {
        id: "status-new",
        name: "New",
        category: "NEW" as const,
        organizationId: "org-1",
        isDefault: true,
      },
      priority: {
        id: "priority-medium",
        name: "Medium",
        order: 3,
        organizationId: "org-1",
        isDefault: true,
      },
      machine: {
        id: "machine-tom",
        name: "Theatre of Magic",
        model: {
          id: "model-tom",
          name: "Theatre of Magic",
          manufacturer: "Bally",
          year: 1995,
        },
        location: {
          id: "location-back",
          name: "Back Room",
          organizationId: "org-1",
        },
      },
      assignedTo: null,
      createdAt: "2023-12-05T10:00:00.000Z",
      _count: {
        comments: 2,
        attachments: 0,
      },
    },
  ];

  const mockInProgressIssues = [
    {
      id: "issue-progress-1",
      title: "Replacing playfield glass on Twilight Zone",
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
      machine: {
        id: "machine-tz",
        name: "Twilight Zone",
        model: {
          id: "model-tz",
          name: "Twilight Zone",
          manufacturer: "Bally",
          year: 1993,
        },
        location: {
          id: "location-workshop",
          name: "Workshop",
          organizationId: "org-1",
        },
      },
      assignedTo: {
        id: "user-tech",
        name: "Tech Johnson",
        email: "tech@example.com",
        image: null,
      },
      createdAt: "2023-12-04T14:30:00.000Z",
      _count: {
        comments: 4,
        attachments: 3,
      },
    },
  ];

  const mockLocationsData = [
    { id: "location-main", name: "Main Floor" },
    { id: "location-back", name: "Back Room" },
    { id: "location-workshop", name: "Workshop" },
  ];

  const mockStatusesData = [
    { id: "status-new", name: "New" },
    { id: "status-acknowledged", name: "Acknowledged" },
    { id: "status-progress", name: "In Progress" },
    { id: "status-resolved", name: "Resolved" },
    { id: "status-closed", name: "Closed" },
  ];

  const defaultFilters = {
    sortBy: "created" as const,
    sortOrder: "desc" as const,
  };

  // Technician permissions for daily workflow
  const technicianPermissions = [
    "issue:view",
    "issue:create",
    "issue:update",
    "issue:assign",
    "issue:edit",
    "machine:view",
    "location:view",
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default API responses
    mockIssuesQuery.mockReturnValue({
      data: mockNewIssues,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    mockLocationsQuery.mockReturnValue({
      data: mockLocationsData,
    });

    mockStatusesQuery.mockReturnValue({
      data: mockStatusesData,
    });

    mockHasPermission.mockImplementation((permission: string) =>
      technicianPermissions.includes(permission),
    );
  });

  describe("CUJ 4.1 - Daily Triage Workflow", () => {
    beforeEach(() => {
      // Setup API to return new issues for triage
      mockIssuesQuery.mockReturnValue({
        data: mockNewIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it("allows technician to filter for 'New' reports for daily triage", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Verify all issues are shown initially
      expect(
        screen.getByText("Ball stuck in Medieval Madness castle"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Flipper not responding on Attack from Mars"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Display flickering on Theatre of Magic"),
      ).toBeInTheDocument();

      // Filter by "New" status category for daily triage
      const comboboxes = screen.getAllByRole("combobox");
      const categorySelect = comboboxes[2] as HTMLElement; // Category is index 2
      fireEvent.mouseDown(categorySelect);

      const newOption = screen.getByRole("option", { name: "New" });
      await userEvent.click(newOption);

      // Should show filtered results
      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // All issues should be "New" status - filter out dropdown options
      const statusChips = screen
        .getAllByText("New")
        .filter((el) => el.closest(".MuiChip-root") !== null);
      expect(statusChips).toHaveLength(3);
    });

    it("displays issues sorted by priority for effective triage", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Check that critical priority issues are clearly marked
      expect(screen.getByText("Critical")).toBeInTheDocument();
      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();

      // Sort by severity/priority for triage workflow
      const comboboxes = screen.getAllByRole("combobox");
      const sortSelect = comboboxes[3] as HTMLElement; // Sort By is index 3
      fireEvent.mouseDown(sortSelect);

      const priorityOption = screen.getByRole("option", { name: "Priority" });
      await userEvent.click(priorityOption);

      // URL should be updated with sort parameter
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("sortBy=severity"),
        );
      });
    });

    it("shows issue details needed for triage assessment", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Each issue should show key triage information
      const firstIssueTitle = screen.getByText(
        "Ball stuck in Medieval Madness castle",
      );
      const firstIssue = firstIssueTitle.closest(
        ".MuiCard-root",
      ) as HTMLElement;
      expect(firstIssue).toBeInTheDocument();

      // Check essential triage info is visible
      expect(within(firstIssue).getByText("High")).toBeInTheDocument(); // Priority
      expect(
        within(firstIssue).getByText("Medieval Madness at Main Floor"),
      ).toBeInTheDocument(); // Machine and Location
      expect(
        within(firstIssue).getByText("1 comments • 2 attachments"),
      ).toBeInTheDocument(); // Activity indicators
      expect(within(firstIssue).getByText("Unassigned")).toBeInTheDocument(); // Assignment status
    });

    it("allows technician to navigate to issue details for assessment", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Click on critical issue for detailed assessment
      const criticalIssue = screen.getByText(
        "Flipper not responding on Attack from Mars",
      );
      await userEvent.click(criticalIssue);

      expect(mockPush).toHaveBeenCalledWith("/issues/issue-new-2");
    });
  });

  describe("CUJ 4.2 - Acknowledging & Closing Issues", () => {
    beforeEach(() => {
      mockIssuesQuery.mockReturnValue({
        data: mockNewIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it("allows technician to select multiple issues for bulk acknowledgment", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Should show selection controls for technician
      expect(screen.getByText("Select All")).toBeInTheDocument();

      // Select multiple issues for bulk acknowledgment
      const checkboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = checkboxes[1] as HTMLElement; // Skip "Select All"
      const secondIssueCheckbox = checkboxes[2] as HTMLElement;

      await userEvent.click(firstIssueCheckbox);
      await userEvent.click(secondIssueCheckbox);

      // Should show bulk actions toolbar
      expect(screen.getByText("2 issues selected")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /assign/i }),
      ).toBeInTheDocument();
    });

    it("provides bulk assignment functionality for acknowledging issues", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Select issues for assignment (acknowledgment)
      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      // Assign button should be enabled
      const assignButton = screen.getByRole("button", { name: /assign/i });
      expect(assignButton).not.toBeDisabled();

      // Click assign (would open assignment dialog in real implementation)
      await userEvent.click(assignButton);

      // For now, this is just a placeholder action
      // In full implementation, this would trigger assignment workflow
    });

    it("provides bulk close functionality for invalid/duplicate issues", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Select issue for closing
      const firstIssueCheckbox = screen.getAllByRole(
        "checkbox",
      )[1] as HTMLElement;
      await userEvent.click(firstIssueCheckbox);

      // Close button should be enabled (technician has issue:edit permission)
      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).not.toBeDisabled();

      // Click close (would open close confirmation in real implementation)
      await userEvent.click(closeButton);

      // For now, this is just a placeholder action
      // In full implementation, this would trigger close workflow
    });

    it("allows technician to select all issues for batch processing", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Use "Select All" for batch processing
      const selectAllCheckbox = screen.getAllByRole(
        "checkbox",
      )[0] as HTMLElement;
      await userEvent.click(selectAllCheckbox);

      // All issues should be selected
      expect(screen.getByText("3 issues selected")).toBeInTheDocument();

      // All individual checkboxes should be checked
      const issueCheckboxes = screen.getAllByRole("checkbox").slice(1);
      issueCheckboxes.forEach((checkbox) => {
        expect(checkbox).toBeChecked();
      });

      // Bulk actions should be available
      expect(
        screen.getByRole("button", { name: /assign/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close/i }),
      ).toBeInTheDocument();
    });
  });

  describe("CUJ 4.3 - Managing Issue Lifecycle", () => {
    beforeEach(() => {
      // Mix of new and in-progress issues for lifecycle management
      const allIssues = [...mockNewIssues, ...mockInProgressIssues];
      mockIssuesQuery.mockReturnValue({
        data: allIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it("allows technician to view issues across different lifecycle stages", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("4 issues found")).toBeInTheDocument();
      });

      // Should see issues in different stages - filter out dropdown options
      const newStatusChips = screen
        .getAllByText("New")
        .filter((el) => el.closest(".MuiChip-root") !== null);
      expect(newStatusChips).toHaveLength(3);
      expect(screen.getByText("In Progress")).toBeInTheDocument();

      // Should see both unassigned and assigned issues
      expect(screen.getAllByText("Unassigned")).toHaveLength(3);
      expect(screen.getByText("Tech Johnson")).toBeInTheDocument();
    });

    it("allows filtering by status to manage specific lifecycle stages", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("4 issues found")).toBeInTheDocument();
      });

      // Filter by "In Progress" status category - test UI interaction
      const comboboxes = screen.getAllByRole("combobox");
      const categorySelect = comboboxes[2] as HTMLElement; // Category is index 2
      fireEvent.mouseDown(categorySelect);

      const inProgressOption = screen.getByRole("option", {
        name: "In Progress",
      });
      await userEvent.click(inProgressOption);

      // URL should be updated with filter parameter
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusCategory=IN_PROGRESS"),
        );
      });
    });

    it("shows assignment status clearly for workflow management", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("4 issues found")).toBeInTheDocument();
      });

      // Check assignment status visibility
      const assignedIssueTitle = screen.getByText(
        "Replacing playfield glass on Twilight Zone",
      );
      const assignedIssue = assignedIssueTitle.closest(
        ".MuiCard-root",
      ) as HTMLElement;
      expect(
        within(assignedIssue).getByText("Tech Johnson"),
      ).toBeInTheDocument();

      // Check unassigned issues
      const unassignedLabels = screen.getAllByText("Unassigned");
      expect(unassignedLabels).toHaveLength(3);
    });

    it("allows technician to track issue progress through comments and attachments", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("4 issues found")).toBeInTheDocument();
      });

      // Check that activity indicators are visible for progress tracking
      expect(
        screen.getByText("1 comments • 2 attachments"),
      ).toBeInTheDocument(); // New issue with customer photos
      expect(
        screen.getByText("4 comments • 3 attachments"),
      ).toBeInTheDocument(); // In-progress with work documentation
    });

    it("supports filtering by location for site-specific workflow management", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("4 issues found")).toBeInTheDocument();
      });

      // Filter by Main Floor location - test UI interaction
      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement; // Location is index 0
      fireEvent.mouseDown(locationSelect);

      const mainFloorOption = screen.getByRole("option", {
        name: "Main Floor",
      });
      await userEvent.click(mainFloorOption);

      // URL should be updated with filter parameter
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-main"),
        );
      });
    });
  });

  describe("Technician Efficiency Features", () => {
    beforeEach(() => {
      mockIssuesQuery.mockReturnValue({
        data: mockNewIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });
    });

    it("provides quick access to issue details for technical assessment", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Test quick navigation to different issue types
      const mechanicalIssue = screen.getByText(
        "Ball stuck in Medieval Madness castle",
      );
      const electricalIssue = screen.getByText(
        "Flipper not responding on Attack from Mars",
      );
      const displayIssue = screen.getByText(
        "Display flickering on Theatre of Magic",
      );

      // Should be able to quickly navigate to any issue
      await userEvent.click(mechanicalIssue);
      expect(mockPush).toHaveBeenCalledWith("/issues/issue-new-1");

      await userEvent.click(electricalIssue);
      expect(mockPush).toHaveBeenCalledWith("/issues/issue-new-2");

      await userEvent.click(displayIssue);
      expect(mockPush).toHaveBeenCalledWith("/issues/issue-new-3");
    });

    it("shows machine and location information for efficient routing", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Check that location routing information is clear
      expect(
        screen.getByText("Medieval Madness at Main Floor"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Attack from Mars at Main Floor"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Theatre of Magic at Back Room"),
      ).toBeInTheDocument();

      // Different locations should be clearly distinguished
      expect(
        screen.getByText("Medieval Madness at Main Floor"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Attack from Mars at Main Floor"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Theatre of Magic at Back Room"),
      ).toBeInTheDocument();
    });

    it("supports sorting by creation date for chronological workflow", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Default sort should be by creation date (newest first)
      const comboboxes = screen.getAllByRole("combobox");
      const sortSelect = comboboxes[3] as HTMLElement; // Sort By is index 3
      fireEvent.mouseDown(sortSelect);

      // Should have creation date as an option
      expect(screen.getAllByText("Created Date")).toHaveLength(2); // One in dropdown, one in option

      // Close dropdown
      fireEvent.keyDown(sortSelect, { key: "Escape" });

      // Issues should show creation dates for chronological context (multiple instances expected)
      expect(screen.getAllByText("12/5/2023")).toHaveLength(3); // Formatted dates appear on each issue
    });

    it("allows view mode switching for different workflow preferences", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Should have view mode controls
      const gridButton = screen.getByTestId("ViewModuleIcon").closest("button");
      const listButton = screen.getByTestId("ViewListIcon").closest("button");

      expect(gridButton).toBeInTheDocument();
      expect(listButton).toBeInTheDocument();

      // Switch to list view for compact display
      if (listButton) {
        await userEvent.click(listButton);
      }

      // List view should be active
      expect(listButton).toHaveClass("MuiIconButton-colorPrimary");
      expect(gridButton).not.toHaveClass("MuiIconButton-colorPrimary");
    });
  });

  describe("Workflow State Persistence", () => {
    it("maintains filter state across page navigation", async () => {
      const filtersWithLocation = {
        locationId: "location-main",
        statusCategory: "NEW" as const,
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={filtersWithLocation} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Verify that API was called with the correct filters
      expect(mockIssuesQuery).toHaveBeenCalledWith(filtersWithLocation);
    });

    it("updates URL parameters for shareable workflow states", async () => {
      render(
        <VitestTestWrapper
          userPermissions={technicianPermissions}
          userRole="Technician"
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Apply a filter that would be useful to share with other technicians
      const comboboxes = screen.getAllByRole("combobox");
      const categorySelect = comboboxes[2] as HTMLElement; // Category is index 2
      fireEvent.mouseDown(categorySelect);

      const newOption = screen.getByRole("option", { name: "New" });
      await userEvent.click(newOption);

      // URL should be updated for sharing
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusCategory=NEW"),
        );
      });
    });
  });
});
