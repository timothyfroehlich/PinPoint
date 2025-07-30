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

describe("IssueList - Integration Tests with tRPC APIs", () => {
  // Use centralized mock data factories that align with status category logic
  const mockIssuesData = createMockIssuesList({
    count: 3,
    overrides: {
      title: "Test Integration Issue",
      _count: { comments: 2, attachments: 1 },
    },
  });
  const mockLocationsData = createMockLocations({ count: 3, overrides: {} });
  const mockStatusesData = createMockStatuses({ count: 4 });

  const defaultFilters = {
    sortBy: "created" as const,
    sortOrder: "desc" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockHasPermission.mockImplementation((permission: string) =>
      [...VITEST_PERMISSION_SCENARIOS.ADMIN].includes(permission as any),
    );

    // Default API responses
    mockIssuesQuery.mockReturnValue({
      data: mockIssuesData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    mockLocationsQuery.mockReturnValue(
      createMockTRPCQueryResult(mockLocationsData),
    );

    mockStatusesQuery.mockReturnValue(
      createMockTRPCQueryResult(mockStatusesData),
    );

    mockMachinesQuery.mockReturnValue({
      data: [
        {
          id: "machine-1",
          name: "Medieval Madness #1",
          organizationId: "org-1",
          modelId: "model-mm",
          locationId: "location-1",
          ownerId: null,
          model: {
            id: "model-mm",
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
        {
          id: "machine-3",
          name: "Attack from Mars #1",
          organizationId: "org-1",
          modelId: "model-afm",
          locationId: "location-1",
          ownerId: null,
          model: {
            id: "model-afm",
            name: "Attack from Mars",
            manufacturer: "Bally",
            year: 1995,
          },
          location: {
            id: "location-1",
            name: "Main Floor",
            organizationId: "org-1",
          },
        },
        {
          id: "machine-5",
          name: "Tales of Arabian Nights #1",
          organizationId: "org-1",
          modelId: "model-totan",
          locationId: "location-2",
          ownerId: null,
          model: {
            id: "model-totan",
            name: "Tales of Arabian Nights",
            manufacturer: "Williams",
            year: 1996,
          },
          location: {
            id: "location-2",
            name: "Back Room",
            organizationId: "org-1",
          },
        },
      ],
      isLoading: false,
      isError: false,
    });

    mockUsersQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
  });

  describe("API Data Fetching Integration", () => {
    it("successfully fetches and displays issues from tRPC API", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Wait for API data to load
      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Check that issues are displayed (using the mock data pattern)
      expect(screen.getAllByText(/Test Integration Issue/)).toHaveLength(3);
    });

    it("successfully fetches and populates location filter dropdown", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Wait for data to load, then expand advanced filters to access location dropdown
      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Click expand button to show advanced filters
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      await waitFor(() => {
        const locationSelect = screen.getByLabelText("Location");
        fireEvent.mouseDown(locationSelect);

        // Check for location options from mock data
        expect(screen.getByText("Main Floor")).toBeInTheDocument();
        expect(screen.getByText("Back Room")).toBeInTheDocument();
        expect(screen.getByText("Workshop")).toBeInTheDocument();
      });
    });

    it("successfully displays status toggle pills", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Check for status pills with counts
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
    });
  });

  describe("Filter Integration with API", () => {
    it("sends correct filter parameters when location filter is applied", async () => {
      const filteredIssues = mockIssuesData.filter(
        (issue) => issue.machine.location.id === "location-main",
      );

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Mock filtered response for when location filter is applied
      mockIssuesQuery.mockReturnValue({
        data: filteredIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      // Expand advanced filters first
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Location")).toBeInTheDocument();
      });

      // Apply location filter
      const locationSelect = screen.getByLabelText("Location");
      fireEvent.mouseDown(locationSelect);

      const mainFloorOption = screen.getByText("Main Floor");
      await userEvent.click(mainFloorOption);

      // Wait for URL update
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
        );
      });
    });

    it("sends correct filter parameters when status category filter is applied", async () => {
      const filteredIssues = mockIssuesData.filter(
        (issue) => issue.status.category === "NEW",
      );

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Mock filtered response
      mockIssuesQuery.mockReturnValue({
        data: filteredIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      // Apply status category filter by clicking Open pill (which has 3 issues)
      const openButton = screen.getByRole("button", {
        name: /Open \(\d+\)/,
      });
      await userEvent.click(openButton);

      // Wait for URL update
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusIds="),
        );
      });
    });

    it("handles multiple filters applied simultaneously", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Expand advanced filters first
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Location")).toBeInTheDocument();
      });

      // Apply location filter (use mock location name)
      const locationSelect = screen.getByLabelText("Location");
      fireEvent.mouseDown(locationSelect);
      await userEvent.click(screen.getByText("Main Floor"));

      // Wait for location filter to be applied
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
        );
      });

      // Now apply status filter - find and click an enabled status pill
      await waitFor(() => {
        const openButton = screen.getByRole("button", {
          name: /Open \(\d+\)/,
        });
        expect(openButton).not.toHaveAttribute("aria-disabled", "true");
      });

      const openButton = screen.getByRole("button", {
        name: /Open \(\d+\)/,
      });
      await userEvent.click(openButton);

      // Verify status filter URL update
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusIds="),
        );
      });
    }, 10000);

    it("handles sort parameter changes correctly", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Expand advanced filters first
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Sort By")).toBeInTheDocument();
      });

      // Change sort option
      const sortSelect = screen.getByLabelText("Sort By");
      fireEvent.mouseDown(sortSelect);

      const updatedOption = screen.getByText("Updated Date");
      await userEvent.click(updatedOption);

      // Wait for URL update with sort parameter
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("sortBy=updated"),
        );
      });
    });
  });

  describe("Error Handling Integration", () => {
    it("handles API errors gracefully with retry functionality", async () => {
      // Mock error state
      const mockError = new Error("Internal server error");
      mockIssuesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: mockError,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/failed to load issues/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/internal server error/i)).toBeInTheDocument();

      // Click retry button
      const retryButton = screen.getByRole("button", { name: /retry/i });
      await userEvent.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it("handles network errors appropriately", async () => {
      // Mock network error
      const networkError = new Error("Network connection failed");
      mockIssuesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: networkError,
        refetch: mockRefetch,
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load issues/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/network connection failed/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /retry/i }),
      ).toBeInTheDocument();
    });

    it("handles partial API failures gracefully", async () => {
      // Issues API succeeds, but locations API fails
      mockIssuesQuery.mockReturnValue({
        data: mockIssuesData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      mockLocationsQuery.mockReturnValue(
        createMockTRPCQueryResult(undefined, {
          isError: true,
          error: new Error("Location service unavailable"),
        }),
      );

      mockStatusesQuery.mockReturnValue(
        createMockTRPCQueryResult(mockStatusesData),
      );

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Issues should still display
      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      expect(screen.getAllByText(/Test Integration Issue/)).toHaveLength(3);

      // Status pills should still be present even with location error
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

  describe("Real-time Data Updates", () => {
    it("refetches data when refresh button is clicked", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Click refresh
      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      await userEvent.click(refreshButton);

      // Should trigger refetch
      expect(mockRefetch).toHaveBeenCalledOnce();
    });

    it("handles updated data from API correctly", async () => {
      const baseIssue = mockIssuesData[0];
      if (!baseIssue) throw new Error("No base issue for test");

      const updatedIssuesData = [
        {
          ...baseIssue,
          title: "Updated: Flipper Stuck on Medieval Madness",
          status: {
            ...baseIssue.status,
            name: "In Progress",
            category: "IN_PROGRESS" as const,
          },
        },
      ];

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Simulate data update by changing mock return value
      mockIssuesQuery.mockReturnValue({
        data: updatedIssuesData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      // Refresh to get updated data
      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      await userEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalledOnce();
    });
  });

  describe("Multi-tenant API Integration", () => {
    it("ensures all API calls respect organization scoping", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          userRole={VITEST_ROLE_MAPPING.ADMIN}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Verify all expected API calls were made
      expect(mockIssuesQuery).toHaveBeenCalled();
      expect(mockLocationsQuery).toHaveBeenCalled();
      expect(mockStatusesQuery).toHaveBeenCalled();

      // Verify all data belongs to the same organization
      mockIssuesData.forEach((issue) => {
        expect(issue.machine.location.organizationId).toBe("org-1");
        expect(issue.status.organizationId).toBe("org-1");
        expect(issue.priority?.organizationId).toBe("org-1");
      });
    });
  });
});
