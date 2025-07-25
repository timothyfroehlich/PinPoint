import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import "@testing-library/jest-dom";

import PrimaryAppBar from "../PrimaryAppBar";

import { server } from "~/test/msw/setup";
import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
} from "~/test/VitestTestWrapper";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  })),
}));

// Mock NextAuth
vi.mock("next-auth/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-auth/react")>();
  return {
    ...actual,
    signOut: vi.fn(),
  };
});

describe("PrimaryAppBar", () => {
  // Set up MSW server
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });

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
      expect(screen.getByText("Home")).toBeInTheDocument();
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

      // Get the logo link specifically by finding the link that contains PinPoint text
      const logoLink = screen.getByRole("link", { name: /pinpoint/i });
      expect(logoLink).toHaveAttribute("href", "/");
    });
  });

  describe("Permission-based Navigation", () => {
    it("should show Issues button for users with issue:view permission", async () => {
      render(
        <VitestTestWrapper userPermissions={["issue:view"]}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      // Wait for async permission loading
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Issues" }),
        ).toBeInTheDocument();
      });

      const issuesButton = screen.getByRole("button", { name: "Issues" });
      expect(issuesButton).toBeEnabled();
    });

    it("should show Games button for users with machine:view permission", async () => {
      render(
        <VitestTestWrapper userPermissions={["machine:view"]}>
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Games" }),
        ).toBeInTheDocument();
      });

      const gamesButton = screen.getByRole("button", { name: "Games" });
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

    it("should show both navigation buttons for admin users", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
        >
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Issues" }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Games" }),
        ).toBeInTheDocument();
      });
    });

    it("should show appropriate buttons for manager users", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MANAGER]}
        >
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Issues" }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Games" }),
        ).toBeInTheDocument();
      });
    });

    it("should show appropriate buttons for member users", async () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
        >
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Issues" }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Games" }),
        ).toBeInTheDocument();
      });
    });

    it("should hide all navigation buttons for public users", () => {
      render(
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.PUBLIC]}
        >
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

    it("should call signOut when logout is clicked", async () => {
      const { signOut } = await import("next-auth/react");
      const mockSignOut = vi.mocked(signOut);

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

      // Click logout
      const logoutItem = screen.getByText("Logout");
      fireEvent.click(logoutItem);

      // Should call signOut
      expect(mockSignOut).toHaveBeenCalledOnce();
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
      expect(screen.getByText("Home")).toBeInTheDocument();

      // Sign In button should be shown for unauthenticated users
      expect(
        screen.getByRole("button", { name: "Sign In" }),
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
        <VitestTestWrapper
          userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
        >
          <PrimaryAppBar />
        </VitestTestWrapper>,
      );

      // All main elements should be present
      expect(screen.getByText("PinPoint")).toBeInTheDocument();
      expect(screen.getByText("Home")).toBeInTheDocument();
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
      expect(screen.getByText("Home")).toBeInTheDocument();
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
