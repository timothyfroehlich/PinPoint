import { renderHook, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { useCurrentUser } from "../use-current-user";
import { api } from "~/trpc/react";

// Mock dependencies
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("~/trpc/react", () => ({
  api: {
    user: {
      getCurrentMembership: {
        useQuery: jest.fn(),
      },
      getProfile: {
        useQuery: jest.fn(),
      },
    },
  },
}));

const mockUseSession = useSession as jest.Mock;
const mockGetCurrentMembership = api.user.getCurrentMembership.useQuery as jest.Mock;
const mockGetProfile = api.user.getProfile.useQuery as jest.Mock;

describe("Authentication Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Complete Authentication Flow", () => {
    it("should handle complete authentication flow from unauthenticated to authenticated", async () => {
      // Start unauthenticated
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      mockGetCurrentMembership.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      mockGetProfile.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      const { result, rerender } = renderHook(() => useCurrentUser());

      // Should be unauthenticated initially
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBe(null);

      // Simulate authentication loading state
      mockUseSession.mockReturnValue({
        data: null,
        status: "loading",
      });

      rerender();

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);

      // Simulate successful authentication
      const mockSession = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          image: "/avatar.jpg",
          role: "admin",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      // Mock membership and profile data
      const mockMembership = {
        id: "membership-123",
        role: "admin",
        userId: "user-123",
        organizationId: "org-123",
      };

      const mockProfile = {
        id: "user-123",
        name: "Test User",
        email: "test@example.com",
        bio: "Test bio",
        profilePicture: "/avatar.jpg",
        _count: {
          issues: 5,
          comments: 10,
          ownedGameInstances: 3,
        },
      };

      mockGetCurrentMembership.mockReturnValue({
        data: mockMembership,
        isLoading: false,
        error: null,
      });

      mockGetProfile.mockReturnValue({
        data: mockProfile,
        isLoading: false,
        error: null,
      });

      rerender();

      // Should now be authenticated with complete user data
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.user).toEqual(mockSession.user);
        expect(result.current.membership).toEqual(mockMembership);
        expect(result.current.profile).toEqual(mockProfile);
      });
    });

    it("should handle authentication with missing membership", async () => {
      const mockSession = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      // No membership found
      mockGetCurrentMembership.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("FORBIDDEN"),
      });

      mockGetProfile.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("UNAUTHORIZED"),
      });

      const { result } = renderHook(() => useCurrentUser());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true); // Still authenticated via session
        expect(result.current.user).toEqual(mockSession.user);
        expect(result.current.membership).toBe(null);
        expect(result.current.profile).toBe(null);
        expect(result.current.hasValidMembership).toBe(false);
      });
    });

    it("should handle session with profile loading states", async () => {
      const mockSession = {
        user: {
          id: "user-123",
          name: "Test User", 
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      // Profile still loading
      mockGetCurrentMembership.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      mockGetProfile.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      const { result } = renderHook(() => useCurrentUser());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.isLoading).toBe(true); // Still loading profile data
    });
  });

  describe("Authentication State Synchronization", () => {
    it("should synchronize NextAuth session with tRPC queries", async () => {
      const mockSession = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com", 
          role: "admin",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      const mockMembership = {
        id: "membership-123",
        role: "admin",
        userId: "user-123", 
        organizationId: "org-123",
      };

      mockGetCurrentMembership.mockReturnValue({
        data: mockMembership,
        isLoading: false,
        error: null,
      });

      mockGetProfile.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      renderHook(() => useCurrentUser());

      // Verify tRPC queries are enabled when session is authenticated
      expect(mockGetCurrentMembership).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          enabled: true,
          retry: false,
        })
      );

      expect(mockGetProfile).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          enabled: true,
          retry: false,
        })
      );
    });

    it("should disable tRPC queries when not authenticated", () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      mockGetCurrentMembership.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      mockGetProfile.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      renderHook(() => useCurrentUser());

      // Verify tRPC queries are disabled when not authenticated
      expect(mockGetCurrentMembership).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          enabled: false,
          retry: false,
        })
      );

      expect(mockGetProfile).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          enabled: false,
          retry: false,
        })
      );
    });

    it("should handle session expiration gracefully", async () => {
      // Start authenticated
      const mockSession = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      mockGetCurrentMembership.mockReturnValue({
        data: { id: "membership-123", role: "member" },
        isLoading: false,
        error: null,
      });

      mockGetProfile.mockReturnValue({
        data: { id: "user-123", name: "Test User" },
        isLoading: false,
        error: null,
      });

      const { result, rerender } = renderHook(() => useCurrentUser());

      // Should be authenticated initially
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Simulate session expiration
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      mockGetCurrentMembership.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      mockGetProfile.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      });

      rerender();

      // Should now be unauthenticated
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
      expect(result.current.membership).toBe(null);
      expect(result.current.profile).toBe(null);
    });
  });

  describe("Error Handling", () => {
    it("should handle tRPC authentication errors gracefully", async () => {
      const mockSession = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      // Simulate UNAUTHORIZED error from tRPC
      mockGetCurrentMembership.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { code: "UNAUTHORIZED" },
      });

      mockGetProfile.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { code: "UNAUTHORIZED" },
      });

      const { result } = renderHook(() => useCurrentUser());

      // Should still show as authenticated (session is valid) but without membership/profile
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.membership).toBe(null);
      expect(result.current.profile).toBe(null);
      expect(result.current.hasValidMembership).toBe(false);
    });

    it("should handle network errors in tRPC queries", async () => {
      const mockSession = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      // Simulate network error
      mockGetCurrentMembership.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Network error"),
      });

      mockGetProfile.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Network error"),
      });

      const { result } = renderHook(() => useCurrentUser());

      // Should handle errors gracefully
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.membership).toBe(null);
      expect(result.current.profile).toBe(null);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Multi-Organization Authentication", () => {
    it("should handle user with multiple organization memberships", async () => {
      const mockSession = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "admin",
          organizationId: "org-123", // Current organization context
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: "authenticated",
      });

      // Membership in current organization
      const mockMembership = {
        id: "membership-123",
        role: "admin",
        userId: "user-123",
        organizationId: "org-123",
      };

      mockGetCurrentMembership.mockReturnValue({
        data: mockMembership,
        isLoading: false,
        error: null,
      });

      mockGetProfile.mockReturnValue({
        data: {
          id: "user-123",
          name: "Test User",
          memberships: [
            {
              organization: { id: "org-123", name: "Org A" },
              role: "admin",
            },
            {
              organization: { id: "org-456", name: "Org B" },
              role: "member",
            },
          ],
        },
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useCurrentUser());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.membership).toEqual(mockMembership);
        expect(result.current.hasValidMembership).toBe(true);
        // User has access to current organization as admin
        expect(result.current.user?.role).toBe("admin");
      });
    });
  });
});