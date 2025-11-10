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

import { PERMISSIONS, SYSTEM_ROLES } from "~/server/auth/permissions.constants";
import {
  VitestTestWrapper,
  VITEST_PERMISSION_SCENARIOS,
  VITEST_ROLE_MAPPING,
} from "~/test/VitestTestWrapper";

// Mock useRouter - needs to be hoisted
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Create a wrapper function for renderHook with dependency injection
const createWrapper = (
  options: {
    userPermissions?: string[];
    userRole?: string;
    session?: any;
    injectPermissionDeps?: boolean;
    queryOptions?: { isLoading?: boolean; isError?: boolean; error?: any };
  } = {},
) => {
  return ({ children }: { children: ReactNode }) => {
    const wrapperProps: any = {
      userPermissions: options.userPermissions,
      session: options.session,
      injectPermissionDeps: options.injectPermissionDeps ?? true,
      queryOptions: options.queryOptions,
    };

    // Only add userRole if it's defined (exactOptionalPropertyTypes compliance)
    if (options.userRole !== undefined) {
      wrapperProps.userRole = options.userRole;
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
      expect(
        result.current.hasPermission(PERMISSIONS.ORGANIZATION_MANAGE),
      ).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.ISSUE_CREATE)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.MACHINE_DELETE)).toBe(
        true,
      );
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
      expect(result.current.hasPermission(PERMISSIONS.ISSUE_VIEW)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.ISSUE_CREATE)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.MACHINE_VIEW)).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.ISSUE_DELETE)).toBe(
        false,
      );
      expect(
        result.current.hasPermission(PERMISSIONS.ORGANIZATION_MANAGE),
      ).toBe(false);
    });

    it("should return false for all permissions for unauthenticated user", async () => {
      const wrapper = createWrapper({ session: null });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(result.current.hasPermission(PERMISSIONS.ISSUE_VIEW)).toBe(false);
      expect(
        result.current.hasPermission(PERMISSIONS.ORGANIZATION_MANAGE),
      ).toBe(false);
      expect(result.current.permissions).toHaveLength(0);
    });

    it("should handle empty permissions array", () => {
      const wrapper = createWrapper({
        userPermissions: [...VITEST_PERMISSION_SCENARIOS.PUBLIC],
        userRole: "Public",
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.hasPermission(PERMISSIONS.ISSUE_VIEW)).toBe(false);
      expect(result.current.hasPermission("any:permission")).toBe(false);
      expect(result.current.permissions).toHaveLength(0);
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
        permissions: expect.arrayContaining([
          PERMISSIONS.ISSUE_VIEW,
          PERMISSIONS.ISSUE_EDIT,
        ]),
        isAuthenticated: true,
        isLoading: false,
        isError: false,
        roleName: expect.stringMatching(/manager/i),
        isAdmin: false,
      });
      expect(result.current.permissions).toHaveLength(2);
    });

    it("should return isAdmin true for Admin role", () => {
      const wrapper = createWrapper({
        userPermissions: [...VITEST_PERMISSION_SCENARIOS.ADMIN],
        userRole: "Admin",
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.roleName).toBe(SYSTEM_ROLES.ADMIN);
    });

    it("should return isAdmin false for non-admin roles", () => {
      const wrapper = createWrapper({
        userPermissions: [...VITEST_PERMISSION_SCENARIOS.MEMBER],
        userRole: "Member",
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.roleName).toBe(VITEST_ROLE_MAPPING.MEMBER);
    });
  });

  describe("Loading States", () => {
    it("should handle loading state correctly", () => {
      // Test loading state with dependency injection by using sessionLoading
      const wrapper = createWrapper({
        userPermissions: ["issue:view"],
        queryOptions: { isLoading: true },
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Should show loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.isAuthenticated).toBe(true); // User exists but still loading
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

      rerender();

      const secondHasPermission = result.current.hasPermission;
      expect(firstHasPermission).toBe(secondHasPermission);
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
      expect(result.current.permissions).toHaveLength(0);
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
      expect(result.current.permissions).toHaveLength(0);
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

    const redirectPath = "/unauthorized";
    const { result } = renderHook(
      () => useRequiredPermission("admin:view", redirectPath),
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

    const redirectPath = "/unauthorized";
    renderHook(() => useRequiredPermission("admin:view", redirectPath), {
      wrapper,
    });

    expect(mockPush).toHaveBeenCalledWith(redirectPath);
  });

  it("should use default redirect path when not specified", () => {
    const wrapper = createWrapper({
      userPermissions: [],
      userRole: "Member",
    });

    renderHook(() => useRequiredPermission("admin:view"), { wrapper });

    // Should redirect to root path when no redirect specified
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/$|^\/$/));
  });
});

describe("usePermissionTooltip", () => {
  it("should return tooltip text for known permissions", () => {
    const { result } = renderHook(() => usePermissionTooltip("issue:edit"));

    expect(typeof result.current).toBe("string");
    expect(result.current).toBeTruthy();
    expect(result.current.trim()).not.toBe("");
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
      expect(result.current).toBeTruthy();
      expect(result.current.trim()).not.toBe("");
    });
  });
});
