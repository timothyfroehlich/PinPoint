import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { IssueList } from "../IssueList";

import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
} from "~/test/VitestTestWrapper";

// Mock next/navigation with more detailed URL parameter tracking
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

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

describe("IssueList - URL State Management", () => {
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

    mockHasPermission.mockReturnValue(true);
  });

  describe("Initial Filter State from URL", () => {
    it("loads with default filters when no URL parameters are present", () => {
      const defaultFilters = {
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should call API with default filters
      expect(mockIssuesQuery).toHaveBeenCalledWith(defaultFilters);

      // UI should reflect default state - check filters are rendered
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes).toHaveLength(4);
    });

    it("loads with filters from URL parameters", () => {
      const initialFilters = {
        locationId: "location-1",
        statusId: "status-2",
        statusCategory: "IN_PROGRESS" as const,
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={initialFilters} />
        </VitestTestWrapper>,
      );

      // Should call API with URL-provided filters
      expect(mockIssuesQuery).toHaveBeenCalledWith(initialFilters);

      // UI should reflect URL state - verify filters are rendered with data
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes).toHaveLength(4);
      // Note: MUI Select values are not easily testable via DOM attributes
      // The component should call API with correct parameters, which we verified above
    });

    it("handles invalid URL parameters gracefully", () => {
      const invalidFilters = {
        locationId: "invalid-location",
        statusCategory: "INVALID_STATUS" as any,
        sortBy: "invalid-sort" as any,
        sortOrder: "invalid-order" as any,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={invalidFilters} />
        </VitestTestWrapper>,
      );

      // Should still render without crashing
      expect(screen.getByText("Test Issue 1")).toBeInTheDocument();

      // Invalid values should be handled gracefully - component should still render
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes).toHaveLength(4);
    });

    it("handles empty string parameters correctly", () => {
      const emptyFilters = {
        locationId: "",
        statusId: "",
        statusCategory: undefined,
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={emptyFilters} />
        </VitestTestWrapper>,
      );

      // Should handle empty strings as passed to API (component may filter these)
      expect(mockIssuesQuery).toHaveBeenCalledWith(emptyFilters);
    });
  });

  describe("URL Updates on Filter Changes", () => {
    const defaultFilters = {
      sortBy: "created" as const,
      sortOrder: "desc" as const,
    };

    it("updates URL when location filter changes", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);

      const locationOption = screen.getByText("Test Location");
      await userEvent.click(locationOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
        );
      });

      // Should preserve other parameters
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("sortBy=created"),
      );
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("sortOrder=desc"),
      );
    });

    it("updates URL when status filter changes", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const comboboxes = screen.getAllByRole("combobox");
      const statusSelect = comboboxes[1] as HTMLElement;
      fireEvent.mouseDown(statusSelect);

      const statusOption = screen.getByText("In Progress");
      await userEvent.click(statusOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusId=status-2"),
        );
      });
    });

    it("updates URL when status category filter changes", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const comboboxes = screen.getAllByRole("combobox");
      const categorySelect = comboboxes[2] as HTMLElement;
      fireEvent.mouseDown(categorySelect);

      const categoryOption = screen.getByText("In Progress");
      await userEvent.click(categoryOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusCategory=IN_PROGRESS"),
        );
      });
    });

    it("updates URL when sort options change", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const comboboxes = screen.getAllByRole("combobox");
      const sortSelect = comboboxes[3] as HTMLElement;
      fireEvent.mouseDown(sortSelect);

      const sortOption = screen.getByText("Priority");
      await userEvent.click(sortOption);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("sortBy=severity"),
        );
      });
    });

    it("handles multiple filter changes in sequence", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // First filter change
      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);
      await userEvent.click(screen.getByText("Test Location"));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
        );
      });

      // Second filter change
      const categorySelect = comboboxes[2] as HTMLElement;
      fireEvent.mouseDown(categorySelect);
      // Use getAllByText to get the menu option, not the chip
      const newOptions = screen.getAllByText("New");
      const menuOption = newOptions.find((el) => el.closest('[role="option"]'));
      if (menuOption) {
        await userEvent.click(menuOption);
      }

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusCategory=NEW"),
        );
      });

      // Should contain both parameters
      expect(mockPush).toHaveBeenLastCalledWith(
        expect.stringMatching(
          /locationId=location-1.*statusCategory=NEW|statusCategory=NEW.*locationId=location-1/,
        ),
      );
    });
  });

  describe("URL Parameter Handling", () => {
    it("removes parameters when filters are cleared", async () => {
      const initialFilters = {
        locationId: "location-1",
        statusCategory: "NEW" as const,
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={initialFilters} />
        </VitestTestWrapper>,
      );

      // Clear location filter
      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);

      const allLocationsOption = screen.getByText("All Locations");
      await userEvent.click(allLocationsOption);

      await waitFor(() => {
        // Should not contain locationId parameter
        expect(mockPush).toHaveBeenCalledWith(
          expect.not.stringContaining("locationId"),
        );
      });

      // Should still contain other parameters
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("statusCategory=NEW"),
      );
    });

    it("handles undefined/null filter values correctly", async () => {
      const defaultFilters = {
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Set a filter, then clear it
      const comboboxes = screen.getAllByRole("combobox");
      const categorySelect = comboboxes[2] as HTMLElement;
      fireEvent.mouseDown(categorySelect);
      // Use getAllByText to get the menu option, not the chip
      const newOptions = screen.getAllByText("New");
      const menuOption = newOptions.find((el) => el.closest('[role="option"]'));
      if (menuOption) {
        await userEvent.click(menuOption);
      }

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusCategory=NEW"),
        );
      });

      // Clear the filter
      fireEvent.mouseDown(categorySelect);
      await userEvent.click(screen.getByText("All Categories"));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.not.stringContaining("statusCategory"),
        );
      });
    });

    it("preserves existing URL structure", async () => {
      const defaultFilters = {
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);
      await userEvent.click(screen.getByText("Test Location"));

      await waitFor(() => {
        const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1];
        const url = lastCall?.[0] as string;

        // Should be a proper query string format
        expect(url).toMatch(/^\/issues\?/);
        expect(url).toContain("locationId=location-1");
        expect(url).toContain("sortBy=created");
        expect(url).toContain("sortOrder=desc");
      });
    });
  });

  describe("Shareable URLs", () => {
    it("creates bookmarkable URLs with complete filter state", async () => {
      const defaultFilters = {
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Apply multiple filters to create a complex state
      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);
      await userEvent.click(screen.getByText("Test Location"));

      const categorySelect = comboboxes[2] as HTMLElement;
      fireEvent.mouseDown(categorySelect);
      // Use getAllByText to get the menu option, not the chip
      const newOptions = screen.getAllByText("New");
      const menuOption = newOptions.find((el) => el.closest('[role="option"]'));
      if (menuOption) {
        await userEvent.click(menuOption);
      }

      const sortSelect = comboboxes[3] as HTMLElement;
      fireEvent.mouseDown(sortSelect);
      await userEvent.click(screen.getByText("Priority"));

      await waitFor(() => {
        const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1];
        const url = lastCall?.[0] as string;

        // Should contain all filter parameters for sharing
        expect(url).toContain("locationId=location-1");
        expect(url).toContain("statusCategory=NEW");
        expect(url).toContain("sortBy=severity");
        expect(url).toContain("sortOrder=desc");
      });
    });

    it("handles complex filter combinations in URLs", () => {
      const complexFilters = {
        locationId: "location-2",
        machineId: "machine-5",
        statusId: "status-3",
        statusCategory: "RESOLVED" as const,
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={complexFilters} />
        </VitestTestWrapper>,
      );

      // Should handle all parameters correctly
      expect(mockIssuesQuery).toHaveBeenCalledWith(complexFilters);

      // UI should reflect the complex state - verify component renders properly
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes).toHaveLength(4);
    });
  });

  describe("Browser Navigation Integration", () => {
    it("supports browser back/forward navigation with filter states", () => {
      // Test that different initial filter states are handled correctly
      const initialFilters = {
        locationId: "location-1",
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      const { unmount } = render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={initialFilters} />
        </VitestTestWrapper>,
      );

      // Verify initial state
      expect(mockIssuesQuery).toHaveBeenCalledWith(initialFilters);

      // Unmount and render with different filters (simulating navigation)
      unmount();
      vi.clearAllMocks();

      // Reset mock return values
      mockIssuesQuery.mockReturnValue({
        data: mockIssues,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      });

      const newFilters = {
        statusCategory: "NEW" as const,
        sortBy: "updated" as const,
        sortOrder: "asc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={newFilters} />
        </VitestTestWrapper>,
      );

      // Should call API with new filters
      expect(mockIssuesQuery).toHaveBeenCalledWith(newFilters);
    });

    it("maintains filter state consistency across page reloads", () => {
      const persistedFilters = {
        locationId: "location-1",
        statusCategory: "IN_PROGRESS" as const,
        sortBy: "severity" as const,
        sortOrder: "desc" as const,
      };

      // Simulate page reload with persisted URL parameters
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={persistedFilters} />
        </VitestTestWrapper>,
      );

      // Should restore exact state from URL
      expect(mockIssuesQuery).toHaveBeenCalledWith(persistedFilters);

      // UI should reflect persisted state - verify component renders properly
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes).toHaveLength(4);
    });
  });

  describe("URL Encoding and Special Characters", () => {
    it("handles special characters in URL parameters correctly", async () => {
      const defaultFilters = {
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      // Mock locations with special characters
      mockLocationsQuery.mockReturnValue({
        data: [
          { id: "location-special", name: "Location & Co." },
          { id: "location-unicode", name: "Café Münch" },
        ],
      });

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      const comboboxes = screen.getAllByRole("combobox");
      const locationSelect = comboboxes[0] as HTMLElement;
      fireEvent.mouseDown(locationSelect);

      const specialLocation = screen.getByText("Location & Co.");
      await userEvent.click(specialLocation);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-special"),
        );
      });
    });

    it("handles long parameter values appropriately", async () => {
      const defaultFilters = {
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <IssueList initialFilters={defaultFilters} />
        </VitestTestWrapper>,
      );

      // Apply multiple filters to create a long URL
      const comboboxes = screen.getAllByRole("combobox");
      const categorySelect = comboboxes[2] as HTMLElement;
      fireEvent.mouseDown(categorySelect);
      await userEvent.click(screen.getByText("In Progress"));

      const sortSelect = comboboxes[3] as HTMLElement;
      fireEvent.mouseDown(sortSelect);
      await userEvent.click(screen.getByText("Updated Date"));

      await waitFor(() => {
        const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1];
        const url = lastCall?.[0] as string;

        // URL should be well-formed despite multiple parameters
        expect(url).toMatch(/^\/issues\?/);
        expect(url.split("&").length).toBeGreaterThan(1);
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("handles missing required sort parameters gracefully", () => {
      const incompleteFilters = {
        locationId: "location-1",
        // Missing required sortBy and sortOrder
      } as any;

      expect(() => {
        render(
          <VitestTestWrapper
            userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          >
            <IssueList initialFilters={incompleteFilters} />
          </VitestTestWrapper>,
        );
      }).not.toThrow();

      // Component should render with fallback values
      expect(screen.getByText("Test Issue 1")).toBeInTheDocument();
    });

    it("handles URL parameter parsing errors gracefully", () => {
      const malformedFilters = {
        locationId: null as any,
        statusCategory: {} as any,
        sortBy: "created" as const,
        sortOrder: "desc" as const,
      };

      expect(() => {
        render(
          <VitestTestWrapper
            userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          >
            <IssueList initialFilters={malformedFilters} />
          </VitestTestWrapper>,
        );
      }).not.toThrow();

      // Should handle malformed data and still render
      expect(screen.getByText("Test Issue 1")).toBeInTheDocument();
    });
  });
});
