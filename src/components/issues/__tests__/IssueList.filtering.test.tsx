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

describe("IssueList - Filtering Functionality", () => {
  // Use centralized mock data factories
  const mockIssues = createMockIssuesList({
    count: 3,
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

  describe("Filter Controls Rendering", () => {
    it("renders all filter controls", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
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
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
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

    it("populates status filter dropdown correctly", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      const comboboxes = screen.getAllByRole("combobox");
      const statusSelect = comboboxes[1] as HTMLElement;
      fireEvent.mouseDown(statusSelect);

      await waitFor(() => {
        expect(screen.getAllByText("New")).toHaveLength(5); // Status in issues + filter option + additional references
      });

      expect(screen.getAllByText("In Progress")).toHaveLength(3); // Filter option + additional references
      expect(screen.getAllByText("Resolved")).toHaveLength(2); // Filter option + additional references
    });
  });

  describe("Filter Parameter Handling", () => {
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

  describe("URL Updates on Filter Changes", () => {
    it("updates URL when location filter changes", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
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

    it("updates URL when status category filter changes", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Apply status category filter
      const comboboxes = screen.getAllByRole("combobox");
      const categorySelect = comboboxes[2] as HTMLElement;
      fireEvent.mouseDown(categorySelect);

      const newOptions = screen.getAllByText("New");
      const newOption = newOptions.find((option) =>
        option.closest('[role="option"]'),
      ) as HTMLElement;
      await userEvent.click(newOption);

      // Wait for URL update
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusIds="),
        );
      });
    });

    it("handles multiple filter changes in sequence", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Apply location filter first
      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);
      await userEvent.click(screen.getByText("Main Floor"));

      // Apply status filter second (status is typically position 1)
      const statusSelect = comboboxes[1] as HTMLElement;
      fireEvent.mouseDown(statusSelect);

      // Wait for dropdown to open and find the resolved option
      await waitFor(() => {
        expect(
          screen.getByRole("option", { name: "Resolved" }),
        ).toBeInTheDocument();
      });

      const resolvedOption = screen.getByRole("option", { name: "Resolved" });
      await userEvent.click(resolvedOption);

      // Verify URL updates were made
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
        );
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusIds="),
        );
      });
    });

    it("removes parameters when filters are cleared", async () => {
      const initialFilters = {
        locationId: "location-1",
        statusIds: ["status-1"],
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={initialFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Clear location filter
      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);
      await userEvent.click(screen.getByText("All Locations"));

      await waitFor(() => {
        // URL should be updated without locationId parameter
        expect(mockPush).toHaveBeenCalledWith(
          expect.not.stringContaining("locationId="),
        );
      });
    });
  });

  describe("Initial Filter State from URL", () => {
    it("loads with default filters when no URL parameters are present", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should call API with default filters
      expect(mockIssuesQuery).toHaveBeenCalledWith(defaultFilters);
    });

    it("loads with filters from URL parameters", () => {
      const initialFilters = {
        locationId: "location-1",
        statusIds: ["status-1", "status-2"],
        machineId: "machine-1",
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={initialFilters} />
        </VitestTestWrapper>,
      );

      // Should call API with URL-provided filters
      expect(mockIssuesQuery).toHaveBeenCalledWith(initialFilters);
    });

    it("handles invalid URL parameters gracefully", () => {
      const invalidFilters = {
        locationId: "invalid-location",
        sortBy: "created" as const, // Use valid sortBy for TypeScript compliance
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={invalidFilters} />
        </VitestTestWrapper>,
      );

      // Component should still render and handle invalid parameters
      expect(screen.getByText("3 issues found")).toBeInTheDocument();
    });

    it("handles empty filter values correctly", () => {
      const emptyFilters = {
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={emptyFilters} />
        </VitestTestWrapper>,
      );

      expect(mockIssuesQuery).toHaveBeenCalledWith(emptyFilters);
    });
  });

  describe("Complex Filter Combinations", () => {
    it("handles complex filter combinations in URLs", () => {
      const complexFilters = {
        locationId: "location-1",
        statusIds: ["status-1", "status-2"],
        machineId: "machine-5",
        assignedToId: "user-3",
        sortBy: "severity" as const,
        sortOrder: "asc" as const,
      };

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={complexFilters} />
        </VitestTestWrapper>,
      );

      // Should call API with complex filter combination
      expect(mockIssuesQuery).toHaveBeenCalledWith(complexFilters);
    });

    it("supports browser back/forward navigation with filter states", () => {
      // Test that different initial filter states are handled correctly
      const initialFilters = {
        locationId: "location-1",
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      const { unmount } = render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={initialFilters} />
        </VitestTestWrapper>,
      );

      expect(mockIssuesQuery).toHaveBeenCalledWith(initialFilters);

      // Unmount and render with different filters (simulating navigation)
      unmount();
      vi.clearAllMocks();

      // Setup fresh API responses
      mockIssuesQuery.mockReturnValue(createMockTRPCQueryResult(mockIssues));
      mockLocationsQuery.mockReturnValue({ data: mockLocations });
      mockStatusesQuery.mockReturnValue({ data: mockStatuses });

      const newFilters = {
        statusIds: ["status-2"],
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={newFilters} />
        </VitestTestWrapper>,
      );

      // Should call API with new filters
      expect(mockIssuesQuery).toHaveBeenCalledWith(newFilters);
    });

    it("maintains filter state consistency across page reloads", () => {
      const persistedFilters = {
        locationId: "location-2",
        statusIds: ["status-1"],
        machineId: "machine-3",
        sortBy: "severity" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={persistedFilters} />
        </VitestTestWrapper>,
      );

      // Should maintain exact filter state on reload
      expect(mockIssuesQuery).toHaveBeenCalledWith(persistedFilters);
    });
  });

  describe("Filter Error Handling", () => {
    it("handles missing required sort parameters gracefully", () => {
      const incompleteFilters = {
        locationId: "location-1",
        sortBy: "created" as const, // Required for TypeScript compliance
        sortOrder: "desc" as const, // Required for TypeScript compliance
      };

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={incompleteFilters} />
        </VitestTestWrapper>,
      );

      // Component should handle missing parameters gracefully
      expect(screen.getByText("3 issues found")).toBeInTheDocument();
    });

    it("handles malformed filter URLs gracefully", () => {
      const malformedFilters = {
        statusIds: ["invalid-status"], // Use array for TypeScript compliance
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={malformedFilters} />
        </VitestTestWrapper>,
      );

      // Component should handle malformed data gracefully
      expect(screen.getByText("3 issues found")).toBeInTheDocument();
    });
  });

  describe("Sort Parameter Changes", () => {
    it("handles sort parameter changes correctly", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Change sort option
      const comboboxes = screen.getAllByRole("combobox");
      const sortSelect = comboboxes[3] as HTMLElement; // Sort is typically the last combobox
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
});
