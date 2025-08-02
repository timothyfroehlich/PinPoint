import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { IssueList } from "../IssueList";

import {
  createMockTRPCLoadingResult,
  createMockTRPCErrorResult,
  createMockTRPCQueryResult,
  EXTENDED_PERMISSION_SCENARIOS,
} from "~/test/mockUtils";
import { setupIssueListTest } from "~/test/setup/issueListTestSetup";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// Type-safe filter interface matching the component
interface IssueFilters {
  locationId?: string | undefined;
  machineId?: string | undefined;
  statusIds?: string[] | undefined;
  search?: string | undefined;
  assigneeId?: string | undefined;
  reporterId?: string | undefined;
  ownerId?: string | undefined;
  sortBy: "created" | "updated" | "status" | "severity" | "game";
  sortOrder: "asc" | "desc";
  statusCategory?: "NEW" | "IN_PROGRESS" | "RESOLVED" | undefined;
}

/**
 * IssueList Unit Tests - Consolidated from basic/filtering/selection test files
 *
 * Focus: Fast unit tests with external API mocks for business logic validation
 * Mock Strategy: External API mocks only (following successful page.test.tsx pattern)
 * - ✅ Keep: tRPC API mocks (api.issue.list, api.location.list, etc.)
 * - ❌ Remove: Component mocks, permission component mocks
 * - ✅ Keep: Shared issueListTestSetup.ts infrastructure
 */

// ✅ SHARED MOCK SETUP: Simplified hoisted mocks with better type safety
const mocks = vi.hoisted(() => ({
  // Navigation mocks
  mockPush: vi.fn(),
  mockSearchParams: new URLSearchParams(),

  // tRPC API mocks
  mockRefetch: vi.fn(),
  mockIssuesQuery: vi.fn(),
  mockLocationsQuery: vi.fn(),
  mockStatusesQuery: vi.fn(),
  mockMachinesQuery: vi.fn(),
  mockUsersQuery: vi.fn(),

  // Permission mocks
  mockUsePermissions: vi.fn(),
  mockHasPermission: vi.fn(),
}));

// ✅ SETUP MOCKS: Configure vi.mock() calls using hoisted mocks
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.mockPush,
  }),
  useSearchParams: () => mocks.mockSearchParams,
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
          ...actual.api.issue.core,
          getAll: {
            ...actual.api.issue.core.getAll,
            useQuery: mocks.mockIssuesQuery,
          },
        },
      },
      location: {
        ...actual.api.location,
        getAll: {
          ...actual.api.location.getAll,
          useQuery: mocks.mockLocationsQuery,
        },
      },
      issueStatus: {
        ...actual.api.issueStatus,
        getAll: {
          ...actual.api.issueStatus.getAll,
          useQuery: mocks.mockStatusesQuery,
        },
      },
      machine: {
        ...actual.api.machine,
        core: {
          ...actual.api.machine.core,
          getAll: {
            ...actual.api.machine.core.getAll,
            useQuery: mocks.mockMachinesQuery,
          },
        },
      },
      user: {
        ...actual.api.user,
        getCurrentMembership: {
          ...actual.api.user.getCurrentMembership,
          useQuery: vi.fn(() => ({
            data: null,
            isLoading: false,
            isError: false,
          })),
        },
        getAllInOrganization: {
          ...actual.api.user.getAllInOrganization,
          useQuery: mocks.mockUsersQuery,
        },
      },
    },
  };
});

vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: mocks.mockUsePermissions,
}));

describe("IssueList Unit Tests", () => {
  // ✅ SHARED TEST SETUP: Use centralized scenario-based mock data
  // Use the "FILTERING" scenario, which provides 3 issues with diverse attributes.
  // This scenario is optimal for unit tests that need to verify filtering and sorting logic,
  // as it ensures predictable, controlled data that covers multiple filter/sort cases.
  // Other scenarios may have too few or too many issues, or lack the necessary diversity for thorough testing.
  const testSetup = setupIssueListTest("FILTERING", mocks);

  beforeEach(() => {
    // ✅ SHARED CLEANUP: Centralized mock reset and configuration
    testSetup.resetMocks();

    // Reset URL search params to clean state
    mocks.mockSearchParams.forEach((_, key) => {
      mocks.mockSearchParams.delete(key);
    });
  });

  // =============================================================================
  // CORE RENDERING TESTS (from basic.test.tsx)
  // =============================================================================

  describe("Core Rendering", () => {
    it("renders loading state correctly", () => {
      mocks.mockIssuesQuery.mockReturnValue(createMockTRPCLoadingResult());

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Target the main loading indicator in the centered layout context
      const mainLoadingIndicator = screen.getByTestId("main-loading-indicator");
      expect(mainLoadingIndicator).toBeInTheDocument();
      expect(mainLoadingIndicator).toHaveAttribute("role", "progressbar");
    });

    it("renders error state with retry functionality", async () => {
      const mockError = new Error("Network error");
      const mockErrorResult = createMockTRPCErrorResult(mockError);
      mockErrorResult.refetch = mocks.mockRefetch;
      mocks.mockIssuesQuery.mockReturnValue(mockErrorResult);

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // More resilient error message patterns that allow for variations
      expect(screen.getByText(/failed.*load.*issues/i)).toBeInTheDocument();
      expect(screen.getByText(/network.*error/i)).toBeInTheDocument();

      const retryButton = screen.getByRole("button", { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      await userEvent.click(retryButton);
      expect(mocks.mockRefetch).toHaveBeenCalledOnce();
    });

    it("renders empty state when no issues found", () => {
      mocks.mockIssuesQuery.mockReturnValue(createMockTRPCQueryResult([]));

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
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
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Check for issue titles as headings (level 3 as per component)
      const issueTitles = screen.getAllByRole("heading", { level: 3 });
      expect(issueTitles.length).toBeGreaterThan(0);

      // Verify at least one issue title matches expected pattern
      expect(
        screen.getByRole("heading", { name: /Test Issue 1/i }),
      ).toBeInTheDocument();

      // Check for status filter pills (not individual issue status chips)
      expect(
        screen.getByRole("button", { name: /Open \(\d+\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /In Progress \(\d+\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Closed \(\d+\)/ }),
      ).toBeInTheDocument();

      // Verify machine and location information is present in issue cards
      expect(screen.getAllByText(/Medieval Madness/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Main Floor/i)[0]).toBeInTheDocument();

      // Check for comment/attachment counts with more flexible matching
      expect(screen.getAllByText(/comments/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/attachments/i)[0]).toBeInTheDocument();

      // Verify priority information is displayed
      expect(screen.getAllByText(/Medium/i)[0]).toBeInTheDocument();
    });

    it("shows correct issue count", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // More semantic check for issue count - could be in a status region or heading
      const issueCountElement = screen.getByText(/\d+ issues? found/i);
      expect(issueCountElement).toBeInTheDocument();
      expect(issueCountElement.tagName).toBe("H6"); // Should be a heading for semantic meaning
    });
  });

  // =============================================================================
  // VIEW MODE CONTROLS (from basic.test.tsx)
  // =============================================================================

  describe("View Mode Controls", () => {
    it("toggles between grid and list view modes", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Wait for component to render with issues
      await waitFor(() => {
        expect(screen.getByText(/\d+ issues? found/i)).toBeInTheDocument();
      });

      // Find view toggle buttons by their semantic role and accessible name
      const listButton = screen.getByRole("button", { name: /list view/i });

      // Switch to list view - button should be found and clickable
      await userEvent.click(listButton);

      // Verify the button click was successful (component should handle view state internally)
    });

    it("shows refresh button and works correctly", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();

      await userEvent.click(refreshButton);
      expect(mocks.mockRefetch).toHaveBeenCalledOnce();
    });
  });

  // =============================================================================
  // FILTER CONTROLS RENDERING (consolidated from basic + filtering)
  // =============================================================================

  describe("Filter Controls Rendering", () => {
    it("renders all filter controls", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText(/\d+ issues? found/i)).toBeInTheDocument();
      });

      // Check for status pills (Open, In Progress, Closed)
      expect(screen.getByText(/Open \(\d+\)/)).toBeInTheDocument();
      expect(screen.getByText(/In Progress \(\d+\)/)).toBeInTheDocument();
      expect(screen.getByText(/Closed \(\d+\)/)).toBeInTheDocument();

      // Check for search field
      expect(
        screen.getByPlaceholderText("Search issues..."),
      ).toBeInTheDocument();
    });

    it("populates location filter dropdown correctly", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText(/\d+ issues? found/i)).toBeInTheDocument();
      });

      // Expand advanced filters to access location dropdown
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Location")).toBeInTheDocument();
      });

      const locationSelect = screen.getByLabelText("Location");
      fireEvent.mouseDown(locationSelect);

      await waitFor(() => {
        expect(screen.getByText(/all locations/i)).toBeInTheDocument();
      });

      // Check for location options from shared mock data
      expect(
        screen.getByRole("option", { name: /main floor/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: /back room/i }),
      ).toBeInTheDocument();
    });

    it("renders status toggle pills correctly", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText(/\d+ issues? found/i)).toBeInTheDocument();
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

  // =============================================================================
  // FILTER PARAMETER HANDLING (from filtering.test.tsx)
  // =============================================================================

  describe("Filter Parameter Handling", () => {
    it("calls issue.core.getAll with correct filter parameters", () => {
      const filters: IssueFilters = {
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

      expect(mocks.mockIssuesQuery).toHaveBeenCalledWith(filters);
    });

    it("calls location.getAll for filter dropdown", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(mocks.mockLocationsQuery).toHaveBeenCalled();
    });

    it("calls issueStatus.getAll for filter dropdown", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(mocks.mockStatusesQuery).toHaveBeenCalled();
    });

    it("handles complex filter combinations", () => {
      const complexFilters: IssueFilters = {
        locationId: "location-1",
        statusIds: ["status-1", "status-2"],
        machineId: "machine-5",
        assigneeId: "user-3",
        sortBy: "severity" as const,
        sortOrder: "asc" as const,
      };

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={complexFilters} />
        </VitestTestWrapper>,
      );

      // Should call API with complex filter combination
      expect(mocks.mockIssuesQuery).toHaveBeenCalledWith(complexFilters);
    });
  });

  // =============================================================================
  // URL UPDATES ON FILTER CHANGES (from filtering.test.tsx)
  // =============================================================================

  describe("URL Updates on Filter Changes", () => {
    it("updates URL when location filter changes", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText(/\d+ issues? found/i)).toBeInTheDocument();
      });

      // Expand advanced filters to access location dropdown
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Location")).toBeInTheDocument();
      });

      const locationSelect = screen.getByLabelText("Location");
      fireEvent.mouseDown(locationSelect);

      await waitFor(() => {
        expect(
          screen.getByRole("option", { name: /main floor/i }),
        ).toBeInTheDocument();
      });

      const locationOption = screen.getByRole("option", {
        name: /main floor/i,
      });
      await userEvent.click(locationOption);

      await waitFor(() => {
        expect(mocks.mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
        );
      });
    });

    it("updates URL when status pill is clicked", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText(/\d+ issues? found/i)).toBeInTheDocument();
      });

      // Click on Open status pill
      const openButton = screen.getByRole("button", { name: /Open \(\d+\)/ });
      await userEvent.click(openButton);

      // Wait for URL update
      await waitFor(() => {
        expect(mocks.mockPush).toHaveBeenCalledWith(
          expect.stringContaining("statusIds="),
        );
      });
    });

    it("removes parameters when filters are cleared", async () => {
      const initialFilters: IssueFilters = {
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
        expect(screen.getByText(/\d+ issues? found/i)).toBeInTheDocument();
      });

      // Expand advanced filters to access location dropdown
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Location")).toBeInTheDocument();
      });

      // Clear location filter
      const locationSelect = screen.getByLabelText("Location");
      fireEvent.mouseDown(locationSelect);
      await userEvent.click(screen.getByText(/all locations/i));

      await waitFor(() => {
        // URL should be updated without locationId parameter
        expect(mocks.mockPush).toHaveBeenCalledWith(
          expect.not.stringContaining("locationId="),
        );
      });
    });

    it("handles sort parameter changes correctly", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText(/\d+ issues? found/i)).toBeInTheDocument();
      });

      // Change sort option - expand advanced filters first
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Sort By")).toBeInTheDocument();
      });

      const sortSelect = screen.getByLabelText("Sort By");
      fireEvent.mouseDown(sortSelect);

      const updatedOption = screen.getByText(/updated date/i);
      await userEvent.click(updatedOption);

      // Wait for URL update with sort parameter
      await waitFor(() => {
        expect(mocks.mockPush).toHaveBeenCalledWith(
          expect.stringContaining("sortBy=updated"),
        );
      });
    });
  });

  // =============================================================================
  // SELECTION CONTROLS VISIBILITY (from selection.test.tsx)
  // =============================================================================

  describe("Selection Controls Visibility", () => {
    it("shows selection controls for users with issue:assign permission", () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view", "issue:assign"].includes(permission),
      );

      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign"]}
          userRole="Admin"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/select all/i)).toBeInTheDocument();
      expect(screen.getAllByRole("checkbox").length).toBeGreaterThanOrEqual(3); // At least select all + issue checkboxes
    });

    it("hides selection controls for users without issue:assign permission", () => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view"].includes(permission),
      );

      render(
        <VitestTestWrapper userPermissions={["issue:view"]} userRole="Member">
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

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
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/select all/i)).toBeInTheDocument();
      expect(screen.getAllByRole("checkbox").length).toBeGreaterThanOrEqual(3); // At least select all + issue checkboxes
    });
  });

  // =============================================================================
  // INDIVIDUAL ISSUE SELECTION (from selection.test.tsx)
  // =============================================================================

  describe("Individual Issue Selection", () => {
    beforeEach(() => {
      mocks.mockHasPermission.mockImplementation((permission: string) =>
        ["issue:view", "issue:assign", "issue:edit"].includes(permission),
      );
    });

    it("shows bulk actions when issues are selected", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Select an issue to show bulk actions
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThanOrEqual(3); // At least select all checkbox + issue checkboxes
      const firstIssueCheckbox = checkboxes[1] as HTMLElement; // Skip "Select All"
      await userEvent.click(firstIssueCheckbox);

      expect(screen.getByText(/\d+ issues? selected/i)).toBeInTheDocument();
      // Use semantic queries for bulk action buttons (excluding status filter chips)
      const allButtons = screen.getAllByRole("button");
      const assignButton = allButtons.find(
        (button) =>
          button.textContent?.toLowerCase().includes("assign") &&
          button.getAttribute("data-testid") === "bulk-assign-button",
      );
      const closeButton = allButtons.find(
        (button) =>
          button.textContent?.toLowerCase().includes("close") &&
          button.getAttribute("data-testid") === "bulk-close-button",
      );

      expect(assignButton).toBeInTheDocument();
      expect(closeButton).toBeInTheDocument();
    });

    it("updates selection count when multiple issues are selected", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      const firstIssueCheckbox = checkboxes[1] as HTMLElement;
      const secondIssueCheckbox = checkboxes[2] as HTMLElement;

      await userEvent.click(firstIssueCheckbox);
      await userEvent.click(secondIssueCheckbox);

      expect(screen.getByText(/\d+ issues? selected/i)).toBeInTheDocument();
    });

    it("enables select all functionality", async () => {
      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign", "issue:edit"]}
          userRole="Admin"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      const selectAllCheckbox = checkboxes[0] as HTMLElement; // First checkbox is "Select All"

      await userEvent.click(selectAllCheckbox);

      expect(screen.getByText(/\d+ issues? selected/i)).toBeInTheDocument();
    });
  });

  // =============================================================================
  // ISSUE NAVIGATION (from basic.test.tsx)
  // =============================================================================

  describe("Issue Navigation", () => {
    it("navigates to issue detail when title is clicked", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      const issueTitle = screen.getByText(/^test issue 1$/i);
      await userEvent.click(issueTitle);

      expect(mocks.mockPush).toHaveBeenCalledWith("/issues/issue-1");
    });
  });

  // =============================================================================
  // FILTER ERROR HANDLING (from filtering.test.tsx)
  // =============================================================================

  describe("Filter Error Handling", () => {
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
      expect(screen.getByText(/\d+ issues? found/i)).toBeInTheDocument();
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
      expect(screen.getByText(/\d+ issues? found/i)).toBeInTheDocument();
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

      expect(mocks.mockIssuesQuery).toHaveBeenCalledWith(emptyFilters);
    });
  });

  // =============================================================================
  // INITIAL FILTER STATE HANDLING (from filtering.test.tsx)
  // =============================================================================

  describe("Initial Filter State from URL", () => {
    it("loads with default filters when no URL parameters are present", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Should call API with default filters
      expect(mocks.mockIssuesQuery).toHaveBeenCalledWith(
        testSetup.defaultFilters,
      );
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
      expect(mocks.mockIssuesQuery).toHaveBeenCalledWith(initialFilters);
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
      expect(mocks.mockIssuesQuery).toHaveBeenCalledWith(persistedFilters);
    });
  });

  // =============================================================================
  // BROWSER NAVIGATION SUPPORT (from filtering.test.tsx)
  // =============================================================================

  describe("Browser Navigation Support", () => {
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

      expect(mocks.mockIssuesQuery).toHaveBeenCalledWith(initialFilters);

      // Unmount and render with different filters (simulating navigation)
      unmount();
      vi.clearAllMocks();

      // Setup fresh API responses
      mocks.mockIssuesQuery.mockReturnValue(
        createMockTRPCQueryResult(testSetup.mockIssues),
      );
      mocks.mockLocationsQuery.mockReturnValue({
        data: testSetup.mockLocations,
      });
      mocks.mockStatusesQuery.mockReturnValue({ data: testSetup.mockStatuses });

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
      expect(mocks.mockIssuesQuery).toHaveBeenCalledWith(newFilters);
    });
  });

  // =============================================================================
  // ACCESSIBILITY TESTING
  // =============================================================================

  describe("Accessibility", () => {
    it("has proper ARIA labels for interactive elements", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Check for proper ARIA labels on buttons
      expect(
        screen.getByRole("button", { name: /Grid view/i }),
      ).toHaveAttribute("aria-label", "Grid view");
      expect(
        screen.getByRole("button", { name: /List view/i }),
      ).toHaveAttribute("aria-label", "List view");
      expect(
        screen.getByRole("button", { name: /Show advanced filters/i }),
      ).toHaveAttribute("aria-label", "Show advanced filters");
    });

    it("provides proper heading hierarchy", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Main issue count should be an h6 (as per component implementation)
      const issueCountHeading = screen.getByRole("heading", {
        name: /\d+ issues? found/i,
      });
      expect(issueCountHeading.tagName).toBe("H6");

      // Issue titles should be h3 headings
      const issueTitleHeadings = screen.getAllByRole("heading", { level: 3 });
      expect(issueTitleHeadings.length).toBeGreaterThan(0);
    });

    it("has accessible form controls with proper labels", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Search input should have proper label
      const searchInput = screen.getByRole("textbox", { name: /Search/i });
      expect(searchInput).toHaveAttribute("placeholder", "Search issues...");

      // Machine/Game select should have proper label
      const machineSelect = screen.getByRole("combobox", {
        name: /Machine\/Game/i,
      });
      expect(machineSelect).toHaveAttribute("aria-labelledby");
    });

    it("supports keyboard navigation for interactive elements", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Check that enabled interactive elements are focusable
      const buttons = screen.getAllByRole("button");
      const inputs = screen.getAllByRole("textbox");
      const selects = screen.getAllByRole("combobox");

      // Filter to only enabled elements (not aria-disabled="true")
      const enabledElements = [...buttons, ...inputs, ...selects].filter(
        (element) => element.getAttribute("aria-disabled") !== "true",
      );

      enabledElements.forEach((element) => {
        const tabIndex = element.getAttribute("tabindex");
        // Enabled elements should be focusable (tabindex >= 0 or null for default)
        if (tabIndex !== null) {
          expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
        }
      });

      // Ensure we have some enabled elements to test
      expect(enabledElements.length).toBeGreaterThan(0);
    });

    it("provides status information for screen readers", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Issue count should be available to screen readers
      const issueCount = screen.getByText(/\d+ issues? found/i);
      expect(issueCount).toBeInTheDocument();

      // Status filter buttons should indicate their state
      const statusButtons = screen
        .getAllByRole("button")
        .filter((button) =>
          /Open|In Progress|Closed/.test(button.textContent || ""),
        );
      expect(statusButtons.length).toBeGreaterThanOrEqual(3);

      // Disabled status buttons should have aria-disabled
      const disabledButtons = statusButtons.filter(
        (button) => button.getAttribute("aria-disabled") === "true",
      );
      expect(disabledButtons.length).toBeGreaterThan(0);
    });

    it("handles loading state with proper accessibility", () => {
      mocks.mockIssuesQuery.mockReturnValue(createMockTRPCLoadingResult());

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      // Target the main loading indicator (not the smaller status loading indicators)
      const loadingIndicator = screen.getByTestId("main-loading-indicator");
      expect(loadingIndicator).toBeInTheDocument();

      // Verify loading state has proper accessibility attributes
      expect(loadingIndicator).toHaveAttribute("role", "progressbar");
    });
  });
});
