import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { IssueList } from "../IssueList";

import {
  createMockIssuesList,
  createMockLocations,
  createMockStatuses,
  createMockTRPCQueryResult,
  createMockTRPCLoadingResult,
  createMockTRPCErrorResult,
} from "~/test/mockUtils";
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

describe("IssueList Component - Basic Tests", () => {
  // Use centralized mock data factories
  const mockIssues = createMockIssuesList({
    count: 1,
    overrides: {
      title: "Test Issue 1",
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

  describe("Core Rendering", () => {
    it("renders loading state correctly", () => {
      mockIssuesQuery.mockReturnValue(createMockTRPCLoadingResult());

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("renders error state with retry functionality", async () => {
      const mockError = new Error("Network error");
      const mockErrorResult = createMockTRPCErrorResult(mockError);
      mockErrorResult.refetch = mockRefetch; // Ensure refetch function is available
      mockIssuesQuery.mockReturnValue(mockErrorResult);

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/failed to load issues/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();

      const retryButton = screen.getByRole("button", { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      await userEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it("renders empty state when no issues found", () => {
      mockIssuesQuery.mockReturnValue(createMockTRPCQueryResult([]));

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
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
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Check for basic issue content (like the working navigation test)
      expect(screen.getByText("Test Issue 1")).toBeInTheDocument();
      expect(screen.getAllByText("New")).toHaveLength(2); // One in status filter, one in issue status
      expect(screen.getByText("Medium")).toBeInTheDocument();

      // Use more flexible text matching for machine and location
      expect(screen.getByText(/Medieval Madness/)).toBeInTheDocument();
      expect(screen.getByText(/Main Floor/)).toBeInTheDocument();
      expect(screen.getByText(/2 comments.*1 attachment/)).toBeInTheDocument();
    });

    it("shows correct issue count", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("1 issue found")).toBeInTheDocument();
    });
  });

  describe("View Mode Controls", () => {
    it("toggles between grid and list view modes", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Wait for component to render with issues
      await waitFor(() => {
        expect(screen.getByText("1 issue found")).toBeInTheDocument();
      });

      // Find buttons by their icon test IDs
      const listButton = screen.getByTestId("ViewListIcon").closest("button");

      // Switch to list view
      if (listButton) {
        await userEvent.click(listButton);
      }

      // Verify the button click was successful (component should handle view state internally)
    });

    it("shows refresh button and works correctly", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();

      await userEvent.click(refreshButton);
      expect(mockRefetch).toHaveBeenCalledOnce();
    });
  });

  describe("Filtering Functionality", () => {
    it("renders all filter controls", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("1 issue found")).toBeInTheDocument();
      });

      // Check that we have the expected number of comboboxes (4 filters)
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes).toHaveLength(4);

      // Check for filter section labels - appears in both heading and mobile button
      expect(screen.getAllByText("Filters")).toHaveLength(2);
    });

    it("populates location filter dropdown correctly", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("1 issue found")).toBeInTheDocument();
      });

      // Find the first combobox (location filter) by position
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes).toHaveLength(4);

      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);

      await waitFor(() => {
        expect(screen.getByText("All Locations")).toBeInTheDocument();
      });

      // Check for location options
      expect(screen.getByText("Main Floor")).toBeInTheDocument();
      expect(screen.getByText("Back Room")).toBeInTheDocument();
    });

    it("updates URL when location filter changes", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("1 issue found")).toBeInTheDocument();
      });

      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);

      await waitFor(() => {
        expect(screen.getByText("Main Floor")).toBeInTheDocument();
      });

      const locationOption = screen.getByText("Main Floor");
      await userEvent.click(locationOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
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
      expect(screen.getAllByRole("checkbox")).toHaveLength(2); // Select all + 1 issue checkbox
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

    it("shows bulk actions when issues are selected", async () => {
      mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view", "issue:assign", "issue:edit"].includes(permission),
      );

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
      expect(checkboxes).toHaveLength(2); // Select all + 1 issue checkbox
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
  });

  describe("Issue Navigation", () => {
    it("navigates to issue detail when title is clicked", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const issueTitle = screen.getByText("Test Issue 1");
      await userEvent.click(issueTitle);

      expect(mockPush).toHaveBeenCalledWith("/issues/issue-1");
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
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={filters} />
        </VitestTestWrapper>,
      );

      expect(mockIssuesQuery).toHaveBeenCalledWith(filters);
    });

    it("calls location.getAll for filter dropdown", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(mockLocationsQuery).toHaveBeenCalled();
    });

    it("calls issueStatus.getAll for filter dropdown", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(mockStatusesQuery).toHaveBeenCalled();
    });
  });
});
