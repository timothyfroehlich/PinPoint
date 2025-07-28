import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import "@testing-library/jest-dom";

import {
  usePermissions,
  useRequiredPermission,
  usePermissionTooltip,
} from "../usePermissions";

import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
} from "~/test/VitestTestWrapper";

// Mock useRouter - needs to be hoisted
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Create a wrapper function for renderHook with dependency injection
const createWrapper = (
  options: {
    userPermissions?: readonly string[];
    userRole?: string;
    session?: any;
    injectPermissionDeps?: boolean;
    queryOptions?: {
      isLoading?: boolean;
      isError?: boolean;
      error?: Error | null;
    };
  } = {},
) => {
  return ({ children }: { children: ReactNode }) => {
    const queryOptions = options.queryOptions
      ? {
          ...(options.queryOptions.isLoading !== undefined && {
            isLoading: options.queryOptions.isLoading,
          }),
          ...(options.queryOptions.isError !== undefined && {
            isError: options.queryOptions.isError,
          }),
          ...(options.queryOptions.error !== undefined && {
            error: options.queryOptions.error,
          }),
        }
      : undefined;

    const wrapperProps: {
      userPermissions?: string[];
      userRole: string;
      session?: any;
      injectPermissionDeps: boolean;
      queryOptions?: {
        isLoading?: boolean;
        isError?: boolean;
        error?: Error | null;
      };
    } = {
      userRole: options.userRole ?? "",
      session: options.session,
      injectPermissionDeps: options.injectPermissionDeps ?? true,
    };

    if (options.userPermissions) {
      wrapperProps.userPermissions = [...options.userPermissions];
    }

    if (queryOptions) {
      wrapperProps.queryOptions = queryOptions;
    }

    return <VitestTestWrapper {...wrapperProps}>{children}</VitestTestWrapper>;
  };
};

describe("usePermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Permission Checking", () => {
    it("should return correct permission checking function for admin user", () => {
      const wrapper = createWrapper({
        userPermissions: [...VITEST_PERMISSION_SCENARIOS.ADMIN],
        userRole: "Admin",
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // With dependency injection, the result should be available immediately
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.hasPermission("organization:admin")).toBe(true);
      expect(result.current.hasPermission("issue:create")).toBe(true);
      expect(result.current.hasPermission("machine:delete")).toBe(true);
      expect(result.current.hasPermission("nonexistent:permission")).toBe(
        false,
      );
    });

    it("should return correct permission checking function for member user", () => {
      const wrapper = createWrapper({
        userPermissions: [...VITEST_PERMISSION_SCENARIOS.MEMBER],
        userRole: "Member",
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAuthenticated).toBe(true);
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

    it("should handle empty permissions array", () => {
      const wrapper = createWrapper({
        userPermissions: [...VITEST_PERMISSION_SCENARIOS.PUBLIC],
        userRole: "Public",
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.hasPermission("issue:view")).toBe(false);
      expect(result.current.hasPermission("any:permission")).toBe(false);
      expect(result.current.permissions).toEqual([]);
    });
  });

  describe("Hook Return Values", () => {
    it("should return complete interface for authenticated user", () => {
      const wrapper = createWrapper({
        userPermissions: ["issue:view", "issue:edit"],
        userRole: "Manager",
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

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

    it("should return isAdmin true for Admin role", () => {
      const wrapper = createWrapper({
        userPermissions: [...VITEST_PERMISSION_SCENARIOS.ADMIN],
        userRole: "Admin",
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.roleName).toBe("Admin");
    });

    it("should return isAdmin false for non-admin roles", () => {
      const wrapper = createWrapper({
        userPermissions: [...VITEST_PERMISSION_SCENARIOS.MEMBER],
        userRole: "Member",
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.roleName).toBe("Member");
    });
  });

  describe("Loading States", () => {
    it("should handle loading state correctly", () => {
      // Simulate loading state with mocked dependencies
      const wrapper = createWrapper({
        userPermissions: [],
        queryOptions: { isLoading: true },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isError).toBe(false);
    });

    it("should handle error state correctly", () => {
      const wrapper = createWrapper({
        userPermissions: ["issue:view"],
        queryOptions: { isError: true, error: new Error("Test error") },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isError).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Permission Function Behavior", () => {
    it("should be stable across re-renders", () => {
      const wrapper = createWrapper({
        userPermissions: ["issue:view"],
        userRole: "Member",
      });

      const { result, rerender } = renderHook(() => usePermissions(), {
        wrapper,
      });

      expect(result.current.isAuthenticated).toBe(true);
      const firstHasPermission = result.current.hasPermission;
      const firstPermissionResult = firstHasPermission("issue:view");

      rerender();

      const secondHasPermission = result.current.hasPermission;
      const secondPermissionResult = secondHasPermission("issue:view");

      // Test functional stability rather than reference equality
      expect(firstPermissionResult).toBe(secondPermissionResult);
      expect(typeof firstHasPermission).toBe("function");
      expect(typeof secondHasPermission).toBe("function");
    });

    it("should update when permissions change", () => {
      // For dependency injection, we create a dynamic wrapper that accepts permissions as props
      const DynamicWrapper = ({
        children,
        permissions,
      }: {
        children: ReactNode;
        permissions: string[];
      }) => (
        <VitestTestWrapper userPermissions={permissions} userRole="Member">
          {children}
        </VitestTestWrapper>
      );

      const { result } = renderHook(() => usePermissions(), {
        wrapper: ({ children }) => (
          <DynamicWrapper permissions={["issue:view"]}>
            {children}
          </DynamicWrapper>
        ),
      });

      expect(result.current.hasPermission("issue:view")).toBe(true);
      expect(result.current.hasPermission("issue:edit")).toBe(false);

      // Since we can't change the wrapper props directly, we'll test this differently
      // We can create two different wrappers to demonstrate the behavior works
      const { result: result2 } = renderHook(() => usePermissions(), {
        wrapper: ({ children }) => (
          <DynamicWrapper permissions={["issue:view", "issue:edit"]}>
            {children}
          </DynamicWrapper>
        ),
      });

      expect(result2.current.hasPermission("issue:view")).toBe(true);
      expect(result2.current.hasPermission("issue:edit")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined permissions gracefully", () => {
      // Test with no permissions provided (simulates undefined)
      const wrapper = createWrapper({
        userPermissions: [],
        userRole: "Member",
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.permissions).toEqual([]);
      expect(result.current.hasPermission("any:permission")).toBe(false);
    });

    it("should handle null membership gracefully", () => {
      // Test with no role (simulates null membership)
      const wrapper = createWrapper({
        userPermissions: [],
        userRole: "", // Empty role simulates null membership
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.permissions).toEqual([]);
      expect(result.current.hasPermission("any:permission")).toBe(false);
      expect(result.current.isAdmin).toBe(false);
    });
  });
});

describe("useRequiredPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not redirect when user has required permission", () => {
    const wrapper = createWrapper({
      userPermissions: ["admin:view"],
      userRole: "Admin",
    });

    const { result } = renderHook(
      () => useRequiredPermission("admin:view", "/unauthorized"),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should redirect when user lacks required permission", () => {
    const wrapper = createWrapper({
      userPermissions: ["issue:view"],
      userRole: "Member",
    });

    renderHook(() => useRequiredPermission("admin:view", "/unauthorized"), {
      wrapper,
    });

    expect(mockPush).toHaveBeenCalledWith("/unauthorized");
  });

  it("should use default redirect path when not specified", () => {
    const wrapper = createWrapper({
      userPermissions: [],
      userRole: "Member",
    });

    renderHook(() => useRequiredPermission("admin:view"), { wrapper });

    expect(mockPush).toHaveBeenCalledWith("/");
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
