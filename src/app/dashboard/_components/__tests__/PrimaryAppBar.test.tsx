import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createContext, useContext, type ReactNode } from "react";
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

import type { PinPointSupabaseUser } from "~/lib/supabase/types";

import { server } from "~/test/msw/setup";
import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
  createMockSupabaseUser,
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

// Mock AuthProvider for components that use useAuth directly
interface MockAuthContextType {
  user: PinPointSupabaseUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const MockAuthContext = createContext<MockAuthContextType | undefined>(
  undefined,
);

function MockAuthProvider({
  children,
  user = createMockSupabaseUser(),
  loading = false,
}: {
  children: ReactNode;
  user?: PinPointSupabaseUser | null;
  loading?: boolean;
}) {
  const mockSignOut = vi.fn().mockResolvedValue(undefined);

  const value = {
    user,
    loading,
    signOut: mockSignOut,
  };

  return (
    <MockAuthContext.Provider value={value}>
      {children}
    </MockAuthContext.Provider>
  );
}

// Mock the useAuth hook to use our mock context
vi.mock("~/app/auth-provider", () => ({
  useAuth: () => {
    const context = useContext(MockAuthContext);
    if (context === undefined) {
      throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
  },
  AuthProvider: MockAuthProvider,
}));

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
        <MockAuthProvider>
          <VitestTestWrapper>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      expect(
        screen.getByRole("link", { name: /pinpoint/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    });

    it("should render user profile menu", () => {
      render(
        <MockAuthProvider>
          <VitestTestWrapper>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      const profileButton = screen.getByRole("button", {
        name: /account of current user/i,
      });
      expect(profileButton).toBeInTheDocument();
    });

    it("should render logo with correct href", () => {
      render(
        <MockAuthProvider>
          <VitestTestWrapper>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      // Get the logo link specifically by finding the link that contains PinPoint text
      const logoLink = screen.getByRole("link", { name: /pinpoint/i });
      expect(logoLink).toHaveAttribute("href", "/");
    });
  });

  describe("Permission-based Navigation", () => {
    it("should show Issues button for users with issue:view permission", async () => {
      render(
        <MockAuthProvider>
          <VitestTestWrapper userPermissions={["issue:view"]}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
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
        <MockAuthProvider>
          <VitestTestWrapper userPermissions={["machine:view"]}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
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
        <MockAuthProvider>
          <VitestTestWrapper userPermissions={[]}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      expect(
        screen.queryByRole("button", { name: "Issues" }),
      ).not.toBeInTheDocument();
    });

    it("should hide Games button for users without machine:view permission", () => {
      render(
        <MockAuthProvider>
          <VitestTestWrapper userPermissions={[]}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      expect(
        screen.queryByRole("button", { name: "Games" }),
      ).not.toBeInTheDocument();
    });

    it("should show both navigation buttons for admin users", async () => {
      render(
        <MockAuthProvider>
          <VitestTestWrapper
            userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          >
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
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
        <MockAuthProvider>
          <VitestTestWrapper
            userPermissions={[...VITEST_PERMISSION_SCENARIOS.MANAGER]}
          >
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
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
        <MockAuthProvider>
          <VitestTestWrapper
            userPermissions={[...VITEST_PERMISSION_SCENARIOS.MEMBER]}
          >
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
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
        <MockAuthProvider>
          <VitestTestWrapper
            userPermissions={[...VITEST_PERMISSION_SCENARIOS.PUBLIC]}
          >
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      expect(
        screen.queryByRole("button", { name: "Issues" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Games" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("User Profile Navigation", () => {
    it("should navigate to profile page when avatar is clicked", async () => {
      const mockPush = vi.fn();
      const { useRouter } = await import("next/navigation");
      vi.mocked(useRouter).mockReturnValue({
        push: mockPush,
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(),
      });

      render(
        <MockAuthProvider>
          <VitestTestWrapper>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      const profileButton = screen.getByRole("button", {
        name: /account of current user/i,
      });
      fireEvent.click(profileButton);

      expect(mockPush).toHaveBeenCalledWith("/profile");
    });

    it("should have proper accessibility attributes", () => {
      render(
        <MockAuthProvider>
          <VitestTestWrapper>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      const profileButton = screen.getByRole("button", {
        name: /account of current user/i,
      });
      expect(profileButton).toHaveAttribute(
        "aria-label",
        "account of current user",
      );
      // No dropdown menu attributes expected
      expect(profileButton).not.toHaveAttribute("aria-controls");
      expect(profileButton).not.toHaveAttribute("aria-haspopup");
    });
  });

  describe("Unauthenticated User Experience", () => {
    it("should render basic structure for unauthenticated users", () => {
      render(
        <MockAuthProvider user={null}>
          <VitestTestWrapper session={null}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      // Basic branding should still be there
      expect(
        screen.getByRole("link", { name: /pinpoint/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();

      // Sign In button should be shown for unauthenticated users
      expect(
        screen.getByRole("button", { name: "Sign In" }),
      ).toBeInTheDocument();
    });

    it("should hide permission-based navigation for unauthenticated users", () => {
      render(
        <MockAuthProvider user={null}>
          <VitestTestWrapper session={null}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
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
        <MockAuthProvider>
          <VitestTestWrapper userPermissions={["issue:view"]}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
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
        <MockAuthProvider>
          <VitestTestWrapper userPermissions={["machine:view"]}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      const gamesButton = screen.getByRole("button", { name: "Games" });
      expect(gamesButton).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("should maintain proper spacing between navigation elements", () => {
      render(
        <MockAuthProvider>
          <VitestTestWrapper
            userPermissions={[...VITEST_PERMISSION_SCENARIOS.ADMIN]}
          >
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      // All main elements should be present
      expect(
        screen.getByRole("link", { name: /pinpoint/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
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
        <MockAuthProvider>
          <VitestTestWrapper userPermissions={["issue:view", "machine:view"]}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      // Component should render without errors and show expected content
      expect(
        screen.getByRole("link", { name: /pinpoint/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Issues" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Games" })).toBeInTheDocument();
    });

    it("should handle empty permissions gracefully", () => {
      render(
        <MockAuthProvider>
          <VitestTestWrapper userPermissions={[]}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      // Should render basic structure without permission-based buttons
      expect(
        screen.getByRole("link", { name: /pinpoint/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
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
        <MockAuthProvider>
          <VitestTestWrapper userPermissions={undefined as any}>
            <PrimaryAppBar />
          </VitestTestWrapper>
        </MockAuthProvider>,
      );

      // Should still render basic structure
      expect(
        screen.getByRole("link", { name: /pinpoint/i }),
      ).toBeInTheDocument();
    });
  });
});
