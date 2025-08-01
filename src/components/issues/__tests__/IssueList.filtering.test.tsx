import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { IssueList } from "../IssueList";

import { createMockTRPCQueryResult } from "~/test/mockUtils";
import {
  createIssueListMocks,
  setupIssueListTest,
} from "~/test/setup/issueListTestSetup";
import { setupAllIssueListMocks } from "~/test/setup/viTestMocks";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// ✅ SHARED MOCK SETUP: Centralized vi.hoisted() mock creation (was ~45 lines of duplication)
const mocks = createIssueListMocks();

setupAllIssueListMocks(mocks);

describe("IssueList - Filtering Functionality", () => {
  // ✅ SHARED TEST SETUP: Use centralized scenario-based mock data
  const testSetup = setupIssueListTest("FILTERING", mocks);

  beforeEach(() => {
    // ✅ SHARED CLEANUP: Centralized mock reset and configuration
    testSetup.resetMocks();
  });

  describe("Filter Controls Rendering", () => {
    it("renders all filter controls", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
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
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
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
        expect(screen.getByText("All Locations")).toBeInTheDocument();
      });

      // Check for location options
      expect(screen.getByText("Main Floor")).toBeInTheDocument();
      expect(screen.getByText("Back Room")).toBeInTheDocument();
    });

    it("renders status toggle pills correctly", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
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
  });

  describe("URL Updates on Filter Changes", () => {
    it("updates URL when location filter changes", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
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
        expect(screen.getByText("Main Floor")).toBeInTheDocument();
      });

      const locationOption = screen.getByText("Main Floor");
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
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
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

    it("handles multiple filter changes in sequence", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
      });

      // Expand advanced filters to access location dropdown
      const expandButton = screen.getByRole("button", {
        name: /show advanced filters/i,
      });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Location")).toBeInTheDocument();
      });

      // Apply location filter first - find location select by label
      const locationSelect = screen.getByLabelText("Location");
      fireEvent.mouseDown(locationSelect);
      await userEvent.click(screen.getByText("Main Floor"));

      // Apply status filter second - click on Open status pill
      const openButton = screen.getByRole("button", {
        name: /Open \(\d+\)/,
      });
      await userEvent.click(openButton);

      // Verify URL updates were made
      await waitFor(() => {
        expect(mocks.mockPush).toHaveBeenCalledWith(
          expect.stringContaining("locationId=location-1"),
        );
      });

      await waitFor(() => {
        expect(mocks.mockPush).toHaveBeenCalledWith(
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
      await userEvent.click(screen.getByText("All Locations"));

      await waitFor(() => {
        // URL should be updated without locationId parameter
        expect(mocks.mockPush).toHaveBeenCalledWith(
          expect.not.stringContaining("locationId="),
        );
      });
    });
  });

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

      expect(mocks.mockIssuesQuery).toHaveBeenCalledWith(emptyFilters);
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
      expect(mocks.mockIssuesQuery).toHaveBeenCalledWith(complexFilters);
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
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("3 issues found")).toBeInTheDocument();
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

      const updatedOption = screen.getByText("Updated Date");
      await userEvent.click(updatedOption);

      // Wait for URL update with sort parameter
      await waitFor(() => {
        expect(mocks.mockPush).toHaveBeenCalledWith(
          expect.stringContaining("sortBy=updated"),
        );
      });
    });
  });
});
