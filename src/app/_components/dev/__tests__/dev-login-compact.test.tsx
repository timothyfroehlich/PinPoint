import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DevLoginCompact } from "../dev-login-compact";
import { api } from "~/trpc/react";

// Mock dependencies
jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("~/trpc/react", () => ({
  api: {
    dev: {
      getUsers: {
        useQuery: jest.fn(),
      },
    },
  },
}));

const mockSignIn = signIn as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockApiQuery = (api.dev.getUsers.useQuery as jest.Mock);

describe("DevLoginCompact", () => {
  const mockRouter = {
    push: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  };

  const mockUsers = [
    {
      id: "user-1",
      name: "Roger Sharpe",
      email: "roger.sharpe@testaccount.dev",
      role: "admin",
      profilePicture: "/avatar1.jpg",
    },
    {
      id: "user-2", 
      name: "Gary Stern",
      email: "gary.stern@testaccount.dev",
      role: "member",
      profilePicture: "/avatar2.jpg",
    },
    {
      id: "user-3",
      name: "Escher Lefkoff", 
      email: "escher.lefkoff@testaccount.dev",
      role: "player",
      profilePicture: "/avatar3.jpg",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);
    
    // Mock successful API response by default
    mockApiQuery.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      error: null,
    });
    
    // Mock successful sign-in by default
    mockSignIn.mockResolvedValue({ ok: true });

    // Reset NODE_ENV to development for dev login to show
    process.env.NODE_ENV = "development";
  });

  describe("Rendering", () => {
    it("should render dev login panel in development", () => {
      render(<DevLoginCompact />);
      
      expect(screen.getByText("Dev Quick Login")).toBeInTheDocument();
    });

    it("should not render in production", () => {
      process.env.NODE_ENV = "production";
      
      render(<DevLoginCompact />);
      
      expect(screen.queryByText("Dev Quick Login")).not.toBeInTheDocument();
    });

    it("should show loading state when fetching users", () => {
      mockApiQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<DevLoginCompact />);
      
      // Click to expand
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      expect(screen.getByText("Loading users...")).toBeInTheDocument();
    });

    it("should show error state when fetch fails", () => {
      mockApiQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Failed to fetch"),
      });

      render(<DevLoginCompact />);
      
      // Click to expand
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      expect(screen.getByText(/Error loading users/)).toBeInTheDocument();
    });

    it("should display all test users when expanded", () => {
      render(<DevLoginCompact />);
      
      // Click to expand
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      expect(screen.getByRole("button", { name: /Roger Sharpe/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Gary Stern/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Escher Lefkoff/ })).toBeInTheDocument();
    });

    it("should display role indicators for users", () => {
      render(<DevLoginCompact />);
      
      // Click to expand
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      // Check for role indicators (A = admin, M = member, P = player)
      expect(screen.getByText("A")).toBeInTheDocument(); // Admin
      expect(screen.getByText("M")).toBeInTheDocument(); // Member  
      expect(screen.getByText("P")).toBeInTheDocument(); // Player
    });
  });

  describe("Authentication Flow", () => {
    it("should call signIn with correct credentials when user clicked", async () => {
      render(<DevLoginCompact />);
      
      // Expand panel
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      // Click on Roger Sharpe
      const rogerButton = screen.getByRole("button", { name: /Roger Sharpe/ });
      fireEvent.click(rogerButton);
      
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("credentials", {
          email: "roger.sharpe@testaccount.dev",
          redirect: false,
        });
      });
    });

    it("should refresh router after successful sign-in", async () => {
      mockSignIn.mockResolvedValue({ ok: true });
      
      render(<DevLoginCompact />);
      
      // Expand and click user
      fireEvent.click(screen.getByText("Dev Quick Login"));
      fireEvent.click(screen.getByRole("button", { name: /Gary Stern/ }));
      
      await waitFor(() => {
        expect(mockRouter.refresh).toHaveBeenCalled();
      });
    });

    it("should handle sign-in failure gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockSignIn.mockResolvedValue({ ok: false, error: "Authentication failed" });
      
      render(<DevLoginCompact />);
      
      // Expand and click user
      fireEvent.click(screen.getByText("Dev Quick Login"));
      fireEvent.click(screen.getByRole("button", { name: /Escher Lefkoff/ }));
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith("Sign-in failed:", "Authentication failed");
      });
      
      expect(mockRouter.refresh).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("should handle sign-in exception gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("Network error");
      mockSignIn.mockRejectedValue(error);
      
      render(<DevLoginCompact />);
      
      // Expand and click user
      fireEvent.click(screen.getByText("Dev Quick Login"));
      fireEvent.click(screen.getByRole("button", { name: /Roger Sharpe/ }));
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith("Login failed:", error);
      });
      
      expect(mockRouter.refresh).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("should show loading state during authentication", async () => {
      // Make signIn take some time
      let resolveSignIn: (value: any) => void;
      const signInPromise = new Promise((resolve) => {
        resolveSignIn = resolve;
      });
      mockSignIn.mockReturnValue(signInPromise);
      
      render(<DevLoginCompact />);
      
      // Expand and click user
      fireEvent.click(screen.getByText("Dev Quick Login"));
      const rogerButton = screen.getByRole("button", { name: /Roger Sharpe/ });
      fireEvent.click(rogerButton);
      
      // Should show loading state (button disabled)
      expect(rogerButton).toBeDisabled();
      
      // Resolve sign-in
      resolveSignIn!({ ok: true });
      
      await waitFor(() => {
        expect(rogerButton).not.toBeDisabled();
      });
    });
  });

  describe("User Interface", () => {
    it("should toggle expanded state when clicked", () => {
      render(<DevLoginCompact />);
      
      // Initially collapsed - users not visible
      expect(screen.queryByRole("button", { name: /Roger Sharpe/ })).not.toBeInTheDocument();
      
      // Click to expand
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      // Now users should be visible
      expect(screen.getByRole("button", { name: /Roger Sharpe/ })).toBeInTheDocument();
      
      // Click to collapse
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      // Users should be hidden again
      expect(screen.queryByRole("button", { name: /Roger Sharpe/ })).not.toBeInTheDocument();
    });

    it("should display user avatars", () => {
      render(<DevLoginCompact />);
      
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      // Check that avatar images are rendered
      const avatars = screen.getAllByRole("img");
      expect(avatars).toHaveLength(mockUsers.length);
      expect(avatars[0]).toHaveAttribute("src", expect.stringContaining("/avatar1.jpg"));
    });

    it("should handle users without profile pictures", () => {
      const usersWithoutAvatars = mockUsers.map(user => ({
        ...user,
        profilePicture: null,
      }));
      
      mockApiQuery.mockReturnValue({
        data: { users: usersWithoutAvatars },
        isLoading: false,
        error: null,
      });
      
      render(<DevLoginCompact />);
      
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      // Should still render user buttons without images
      expect(screen.getByRole("button", { name: /Roger Sharpe/ })).toBeInTheDocument();
    });

    it("should handle empty user list", () => {
      mockApiQuery.mockReturnValue({
        data: { users: [] },
        isLoading: false,
        error: null,
      });
      
      render(<DevLoginCompact />);
      
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      expect(screen.getByText("No test users available")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<DevLoginCompact />);
      
      const expandButton = screen.getByRole("button", { name: /Dev Quick Login/ });
      expect(expandButton).toHaveAttribute("aria-expanded", "false");
      
      fireEvent.click(expandButton);
      
      expect(expandButton).toHaveAttribute("aria-expanded", "true");
    });

    it("should have proper button roles for user login buttons", () => {
      render(<DevLoginCompact />);
      
      fireEvent.click(screen.getByText("Dev Quick Login"));
      
      const userButtons = screen.getAllByRole("button");
      // First button is the expand/collapse button, rest are user buttons
      expect(userButtons).toHaveLength(mockUsers.length + 1);
      
      userButtons.slice(1).forEach((button, index) => {
        expect(button).toHaveAttribute("type", "button");
        expect(button).toHaveTextContent(mockUsers[index]!.name);
      });
    });

    it("should be keyboard navigable", () => {
      render(<DevLoginCompact />);
      
      const expandButton = screen.getByRole("button", { name: /Dev Quick Login/ });
      
      // Should be focusable
      expandButton.focus();
      expect(expandButton).toHaveFocus();
      
      // Should expand on Enter key
      fireEvent.keyDown(expandButton, { key: "Enter" });
      
      expect(screen.getByRole("button", { name: /Roger Sharpe/ })).toBeInTheDocument();
    });
  });
});