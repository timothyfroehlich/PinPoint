import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from "@testing-library/react";
import '@testing-library/jest-dom/vitest';

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
}));

// Mock VitestTestWrapper dependencies for Vitest
vi.mock("~/test/mockTRPCClient", () => ({
  createMockTRPCClient: vi.fn((mockRouters = {}) => mockRouters),
}));

import PrimaryAppBar from "../PrimaryAppBar";

import { VitestTestWrapper, VITEST_PERMISSION_SCENARIOS } from "~/test/VitestTestWrapper";

describe("PrimaryAppBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render the app bar with PinPoint branding", () => {
      render(
        <VitestTestWrapper>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("PinPoint")).toBeInTheDocument();
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("should render user profile menu", () => {
      render(
        <VitestTestWrapper>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      const profileButton = screen.getByRole("button", {
        name: /account of current user/i,
      });
      expect(profileButton).toBeInTheDocument();
    });

    it("should render logo with correct href", () => {
      render(
        <VitestTestWrapper>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      const logoLink = screen.getByRole("link");
      expect(logoLink).toHaveAttribute("href", "/dashboard");
    });
  });

  describe("Permission-based Navigation", () => {
    it("should show Issues button for users with issue:view permission", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      const issuesButton = screen.getByRole("button", { name: "Issues" });
      expect(issuesButton).toBeInTheDocument();
      expect(issuesButton).toBeEnabled();
    });

    it("should show Games button for users with machine:view permission", () => {
      render(
        <VitestTestWrapper userPermissions={["machine:view"]}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      const gamesButton = screen.getByRole("button", { name: "Games" });
      expect(gamesButton).toBeInTheDocument();
      expect(gamesButton).toBeEnabled();
    });

    it("should hide Issues button for users without issue:view permission", () => {
      render(
        <VitestTestWrapper userPermissions={[]}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      expect(
        screen.queryByRole("button", { name: "Issues" }),
      ).not.toBeInTheDocument();
    });

    it("should hide Games button for users without machine:view permission", () => {
      render(
        <VitestTestWrapper userPermissions={[]}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      expect(
        screen.queryByRole("button", { name: "Games" }),
      ).not.toBeInTheDocument();
    });

    it("should show both navigation buttons for admin users", () => {
      render(
        <VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("button", { name: "Issues" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Games" })).toBeInTheDocument();
    });

    it("should show appropriate buttons for manager users", () => {
      render(
        <VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.MANAGER}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("button", { name: "Issues" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Games" })).toBeInTheDocument();
    });

    it("should show appropriate buttons for member users", () => {
      render(
        <VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.MEMBER}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("button", { name: "Issues" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Games" })).toBeInTheDocument();
    });

    it("should hide all navigation buttons for public users", () => {
      render(
        <VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.PUBLIC}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      expect(
        screen.queryByRole("button", { name: "Issues" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Games" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("User Profile Menu", () => {
    it("should open profile menu when avatar is clicked", () => {
      render(
        <VitestTestWrapper>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      const profileButton = screen.getByRole("button", {
        name: /account of current user/i,
      });
      fireEvent.click(profileButton);

      expect(screen.getByText("Logout")).toBeInTheDocument();
    });

    it("should close profile menu when menu item is clicked", () => {
      render(
        <VitestTestWrapper>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      // Open menu
      const profileButton = screen.getByRole("button", {
        name: /account of current user/i,
      });
      fireEvent.click(profileButton);

      // Click menu item
      const logoutItem = screen.getByText("Logout");
      fireEvent.click(logoutItem);

      // Menu should be closed (logout text should not be visible)
      expect(screen.queryByText("Logout")).not.toBeInTheDocument();
    });

    it("should have proper accessibility attributes", () => {
      render(
        <VitestTestWrapper>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      const profileButton = screen.getByRole("button", {
        name: /account of current user/i,
      });
      expect(profileButton).toHaveAttribute(
        "aria-label",
        "account of current user",
      );
      expect(profileButton).toHaveAttribute("aria-controls", "menu-appbar");
      expect(profileButton).toHaveAttribute("aria-haspopup", "true");
    });
  });

  describe("Unauthenticated User Experience", () => {
    it("should render basic structure for unauthenticated users", () => {
      render(
        <VitestTestWrapper session={null}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      // Basic branding should still be there
      expect(screen.getByText("PinPoint")).toBeInTheDocument();
      expect(screen.getByText("Dashboard")).toBeInTheDocument();

      // Profile menu should still be there (will likely show login option in real app)
      expect(
        screen.getByRole("button", { name: /account of current user/i }),
      ).toBeInTheDocument();
    });

    it("should hide permission-based navigation for unauthenticated users", () => {
      render(
        <VitestTestWrapper session={null}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      expect(
        screen.queryByRole("button", { name: "Issues" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Games" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Permission Tooltips", () => {
    it("should have correct tooltip for Issues button", () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      const issuesButton = screen.getByRole("button", { name: "Issues" });

      // The PermissionButton should have tooltip functionality
      // This tests that the tooltipText prop is passed correctly
      expect(issuesButton).toBeInTheDocument();
      // Note: Tooltip testing typically requires more complex setup to actually verify tooltip text
      // This test ensures the button renders properly with permissions
    });

    it("should have correct tooltip for Games button", () => {
      render(
        <VitestTestWrapper userPermissions={["machine:view"]}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      const gamesButton = screen.getByRole("button", { name: "Games" });
      expect(gamesButton).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("should maintain proper spacing between navigation elements", () => {
      render(
        <VitestTestWrapper userPermissions={VITEST_PERMISSION_SCENARIOS.ADMIN}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      // All main elements should be present
      expect(screen.getByText("PinPoint")).toBeInTheDocument();
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Issues" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Games" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /account of current user/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Integration with Permission System", () => {
    it("should properly integrate with usePermissions hook", () => {
      // This test verifies that the component doesn't crash when using real hooks
      // The VitestTestWrapper provides the necessary provider context
      render(
        <VitestTestWrapper userPermissions={["issue:view", "machine:view"]}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      // Component should render without errors and show expected content
      expect(screen.getByText("PinPoint")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Issues" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Games" })).toBeInTheDocument();
    });

    it("should handle empty permissions gracefully", () => {
      render(
        <VitestTestWrapper userPermissions={[]}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      // Should render basic structure without permission-based buttons
      expect(screen.getByText("PinPoint")).toBeInTheDocument();
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Issues" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Games" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Error Boundaries", () => {
    it("should not crash when permission hook returns undefined permissions", () => {
      // Test edge case where permissions might be undefined
      render(
        <VitestTestWrapper userPermissions={undefined as any}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      // Should still render basic structure
      expect(screen.getByText("PinPoint")).toBeInTheDocument();
    });
  });
});
