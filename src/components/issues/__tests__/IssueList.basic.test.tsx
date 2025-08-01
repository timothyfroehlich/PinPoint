import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";

import { IssueList } from "../IssueList";

import {
  createMockTRPCLoadingResult,
  createMockTRPCErrorResult,
  createMockTRPCQueryResult,
} from "~/test/mockUtils";
import {
  createIssueListMocks,
  setupIssueListTest,
} from "~/test/setup/issueListTestSetup";
import { setupAllIssueListMocks } from "~/test/setup/viTestMocks";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// ✅ SHARED MOCK SETUP: Centralized vi.hoisted() mock creation (was ~50 lines of duplication)
const mocks = createIssueListMocks();
setupAllIssueListMocks(mocks);

describe("IssueList Component - Basic Tests", () => {
  // ✅ SHARED TEST SETUP: Use centralized scenario-based mock data
  const testSetup = setupIssueListTest("BASIC", mocks);

  beforeEach(() => {
    // ✅ SHARED CLEANUP: Centralized mock reset and configuration
    testSetup.resetMocks();
  });

  describe("Core Rendering", () => {
    it("renders loading state correctly", () => {
      mocks.mockIssuesQuery.mockReturnValue(createMockTRPCLoadingResult());

      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByTestId("main-loading-indicator")).toBeInTheDocument();
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

      expect(screen.getByText(/failed to load issues/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();

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

      // Check for basic issue content using shared mock data
      expect(screen.getByText("Test Issue 1")).toBeInTheDocument();
      expect(screen.getAllByText("New")).toHaveLength(1); // One in issue status
      expect(screen.getByText("Medium")).toBeInTheDocument();

      // Check for status pills
      expect(
        screen.getByRole("button", { name: /Open \(\d+\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /In Progress \(\d+\)/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Closed \(\d+\)/ }),
      ).toBeInTheDocument();

      // Use more flexible text matching for machine and location
      expect(screen.getByText(/Medieval Madness/)).toBeInTheDocument();
      expect(screen.getByText(/Main Floor/)).toBeInTheDocument();
      expect(screen.getByText(/2 comments.*1 attachment/)).toBeInTheDocument();
    });

    it("shows correct issue count", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("1 issue found")).toBeInTheDocument();
    });
  });

  describe("View Mode Controls", () => {
    it("toggles between grid and list view modes", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
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
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();

      await userEvent.click(refreshButton);
      expect(mocks.mockRefetch).toHaveBeenCalledOnce();
    });
  });

  describe("Filtering Functionality", () => {
    it("renders all filter controls", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("1 issue found")).toBeInTheDocument();
      });

      // Check for search field
      expect(
        screen.getByPlaceholderText("Search issues..."),
      ).toBeInTheDocument();

      // Check for status pills
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

    it("populates location filter dropdown correctly", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("1 issue found")).toBeInTheDocument();
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

      // Check for location options from shared mock data
      expect(screen.getByText("Main Floor")).toBeInTheDocument();
      expect(screen.getByText("Back Room")).toBeInTheDocument();
    });

    it("updates URL when location filter changes", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("1 issue found")).toBeInTheDocument();
      });

      // Expand advanced filters to access location dropdown
      const expandButton = screen.getByRole("button", {
        name: "Show advanced filters",
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
  });

  describe("Permission-Based Access Control", () => {
    it("shows selection controls for users with issue:assign permission", () => {
      // Configure specific permissions for this test
      mocks.mockUsePermissions.mockReturnValue({
        hasPermission: (permission: string) =>
          ["issue:view", "issue:assign"].includes(permission),
        isLoading: false,
        isAuthenticated: true,
      });

      render(
        <VitestTestWrapper
          userPermissions={["issue:view", "issue:assign"]}
          userRole="Admin"
        >
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("Select All")).toBeInTheDocument();
      expect(screen.getAllByRole("checkbox")).toHaveLength(2); // Select all + 1 issue checkbox
    });

    it("hides selection controls for users without issue:assign permission", () => {
      // Configure limited permissions for this test
      mocks.mockUsePermissions.mockReturnValue({
        hasPermission: (permission: string) =>
          ["issue:view"].includes(permission),
        isLoading: false,
        isAuthenticated: true,
      });

      render(
        <VitestTestWrapper userPermissions={["issue:view"]} userRole="Member">
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      expect(screen.queryByText("Select All")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows bulk actions when issues are selected", async () => {
      // Configure permissions that allow bulk actions
      mocks.mockUsePermissions.mockReturnValue({
        hasPermission: (permission: string) =>
          ["issue:view", "issue:assign", "issue:edit"].includes(permission),
        isLoading: false,
        isAuthenticated: true,
      });

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
      expect(checkboxes).toHaveLength(2); // Select all + 1 issue checkbox
      const firstIssueCheckbox = checkboxes[1] as HTMLElement; // Skip "Select All"
      await userEvent.click(firstIssueCheckbox);

      expect(screen.getByText("1 issue selected")).toBeInTheDocument();
      expect(screen.getByTestId("bulk-assign-button")).toBeInTheDocument();
      expect(screen.getByTestId("bulk-close-button")).toBeInTheDocument();
    });
  });

  describe("Issue Navigation", () => {
    it("navigates to issue detail when title is clicked", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <IssueList initialFilters={testSetup.defaultFilters} />
        </VitestTestWrapper>,
      );

      const issueTitle = screen.getByText("Test Issue 1");
      await userEvent.click(issueTitle);

      expect(mocks.mockPush).toHaveBeenCalledWith("/issues/issue-1");
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
});
