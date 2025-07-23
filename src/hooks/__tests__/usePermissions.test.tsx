/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { type ReactNode } from "react";

import {
  usePermissions,
  useRequiredPermission,
  usePermissionTooltip,
} from "../usePermissions";

import { server } from "~/test/msw/setup";
import { handlers } from "~/test/msw/handlers";
import { TestWrapper, PERMISSION_SCENARIOS } from "~/test/TestWrapper";

// Create a wrapper function for renderHook
const createWrapper = (
  options: {
    userPermissions?: string[];
    session?: any;
  } = {},
) => {
  return ({ children }: { children: ReactNode }) => (
    <TestWrapper {...options}>{children}</TestWrapper>
  );
};

describe("usePermissions", () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe("Basic Permission Checking", () => {
    it("should return correct permission checking function for admin user", async () => {
      const wrapper = createWrapper({
        userPermissions: PERMISSION_SCENARIOS.ADMIN,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.hasPermission("organization:admin")).toBe(true);
      expect(result.current.hasPermission("issue:create")).toBe(true);
      expect(result.current.hasPermission("machine:delete")).toBe(true);
      expect(result.current.hasPermission("nonexistent:permission")).toBe(
        false,
      );
    });

    it("should return correct permission checking function for member user", async () => {
      const wrapper = createWrapper({
        userPermissions: PERMISSION_SCENARIOS.MEMBER,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.hasPermission("issue:view")).toBe(true);
      expect(result.current.hasPermission("issue:create")).toBe(true);
      expect(result.current.hasPermission("machine:view")).toBe(true);
      expect(result.current.hasPermission("issue:delete")).toBe(false);
      expect(result.current.hasPermission("organization:admin")).toBe(false);
    });

    it("should return false for all permissions for unauthenticated user", async () => {
      const wrapper = createWrapper({ session: null });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(result.current.hasPermission("issue:view")).toBe(false);
      expect(result.current.hasPermission("organization:admin")).toBe(false);
      expect(result.current.permissions).toEqual([]);
    });

    it("should handle empty permissions array", async () => {
      const wrapper = createWrapper({
        userPermissions: PERMISSION_SCENARIOS.PUBLIC,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.hasPermission("issue:view")).toBe(false);
      expect(result.current.hasPermission("any:permission")).toBe(false);
      expect(result.current.permissions).toEqual([]);
    });
  });

  describe("Hook Return Values", () => {
    it("should return complete interface for authenticated user", async () => {
      server.use(
        handlers.userGetCurrentMembership({
          permissions: ["issue:view", "issue:edit"],
          role: "Manager",
        }),
      );

      const wrapper = createWrapper({
        userPermissions: ["issue:view", "issue:edit"],
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toMatchObject({
        hasPermission: expect.any(Function),
        permissions: ["issue:view", "issue:edit"],
        isAuthenticated: true,
        isLoading: false,
        isError: false,
        roleName: "Manager",
        isAdmin: false,
      });
    });

    it("should return isAdmin true for Admin role", async () => {
      server.use(
        handlers.userGetCurrentMembership({
          permissions: PERMISSION_SCENARIOS.ADMIN,
          role: "Admin",
        }),
      );

      const wrapper = createWrapper({
        userPermissions: PERMISSION_SCENARIOS.ADMIN,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true);
      });

      expect(result.current.roleName).toBe("Admin");
    });

    it("should return isAdmin false for non-admin roles", async () => {
      server.use(
        handlers.userGetCurrentMembership({
          permissions: PERMISSION_SCENARIOS.MEMBER,
          role: "Member",
        }),
      );

      const wrapper = createWrapper({
        userPermissions: PERMISSION_SCENARIOS.MEMBER,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(false);
      });

      expect(result.current.roleName).toBe("Member");
    });
  });

  describe("Loading States", () => {
    it("should handle loading state correctly", () => {
      const wrapper = createWrapper({
        userPermissions: ["issue:view"],
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Initial loading state should be true
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isError).toBe(false);
    });

    it("should handle error state correctly", async () => {
      server.use(handlers.errorUnauthorized());

      const wrapper = createWrapper({
        userPermissions: ["issue:view"],
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Permission Function Behavior", () => {
    it("should be stable across re-renders", async () => {
      const wrapper = createWrapper({
        userPermissions: ["issue:view"],
      });

      const { result, rerender } = renderHook(() => usePermissions(), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      const firstHasPermission = result.current.hasPermission;

      rerender();

      const secondHasPermission = result.current.hasPermission;

      expect(firstHasPermission).toBe(secondHasPermission);
    });

    it("should update when permissions change", async () => {
      server.use(
        handlers.userGetCurrentMembership({
          permissions: ["issue:view"],
          role: "Member",
        }),
      );

      const wrapper = createWrapper({
        userPermissions: ["issue:view"],
      });

      const { result, rerender } = renderHook(() => usePermissions(), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.hasPermission("issue:view")).toBe(true);
      });

      expect(result.current.hasPermission("issue:edit")).toBe(false);

      // Simulate permission update by changing the handler
      server.use(
        handlers.userGetCurrentMembership({
          permissions: ["issue:view", "issue:edit"],
          role: "Member",
        }),
      );

      rerender();

      await waitFor(() => {
        expect(result.current.hasPermission("issue:edit")).toBe(true);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined permissions gracefully", async () => {
      server.use(
        handlers.userGetCurrentMembership({
          permissions: undefined,
          role: "Member",
        }),
      );

      const wrapper = createWrapper({});

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.permissions).toEqual([]);
      expect(result.current.hasPermission("any:permission")).toBe(false);
    });

    it("should handle null membership gracefully", async () => {
      server.use(
        handlers.userGetCurrentMembership({
          permissions: [],
          role: undefined,
        }),
      );

      const wrapper = createWrapper({});

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.permissions).toEqual([]);
      expect(result.current.hasPermission("any:permission")).toBe(false);
      expect(result.current.roleName).toBeUndefined();
      expect(result.current.isAdmin).toBe(false);
    });
  });
});

describe("useRequiredPermission", () => {
  // Mock useRouter
  const mockPush = jest.fn();
  jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not redirect when user has required permission", async () => {
    const wrapper = createWrapper({
      userPermissions: ["admin:view"],
    });

    const { result } = renderHook(
      () => useRequiredPermission("admin:view", "/unauthorized"),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should redirect when user lacks required permission", async () => {
    const wrapper = createWrapper({
      userPermissions: ["issue:view"],
    });

    renderHook(() => useRequiredPermission("admin:view", "/unauthorized"), {
      wrapper,
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/unauthorized");
    });
  });

  it("should use default redirect path when not specified", async () => {
    const wrapper = createWrapper({
      userPermissions: [],
    });

    renderHook(() => useRequiredPermission("admin:view"), { wrapper });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });
});

describe("usePermissionTooltip", () => {
  it("should return tooltip text for known permissions", () => {
    const { result } = renderHook(() => usePermissionTooltip("issue:edit"));

    expect(typeof result.current).toBe("string");
    expect(result.current.length).toBeGreaterThan(0);
  });

  it("should handle unknown permissions gracefully", () => {
    const { result } = renderHook(() =>
      usePermissionTooltip("unknown:permission"),
    );

    expect(typeof result.current).toBe("string");
    // Should return some default text, not crash
  });

  it("should return stable results across re-renders", () => {
    const { result, rerender } = renderHook(() =>
      usePermissionTooltip("issue:edit"),
    );

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
  });

  it("should handle different permission formats", () => {
    const permissions = [
      "issue:view",
      "issue:edit",
      "issue:create",
      "issue:delete",
      "organization:admin",
      "machine:view",
      "machine:edit",
    ];

    permissions.forEach((permission) => {
      const { result } = renderHook(() => usePermissionTooltip(permission));
      expect(typeof result.current).toBe("string");
      expect(result.current.length).toBeGreaterThan(0);
    });
  });
});
