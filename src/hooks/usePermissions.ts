"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useMemo } from "react";

import { getPermissionDescription } from "~/lib/permissions/descriptions";
import { api } from "~/trpc/react";

/**
 * Permission check function type
 */
export type HasPermissionFunction = (permission: string) => boolean;

/**
 * Return type for usePermissions hook
 */
export interface UsePermissionsReturn {
  /** Function to check if the user has a specific permission */
  hasPermission: HasPermissionFunction;
  /** Array of all permissions the user has */
  permissions: string[];
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether permission data is loading */
  isLoading: boolean;
  /** Whether there was an error loading permissions */
  isError: boolean;
  /** The current user's role name */
  roleName?: string;
  /** Whether the user is an admin */
  isAdmin: boolean;
}

/**
 * Hook to get current user's permissions and provide permission checking functions
 *
 * This hook centralizes permission checking logic and integrates with the tRPC
 * organization context to provide real-time permission information.
 *
 * @example Basic usage
 * ```tsx
 * function MyComponent() {
 *   const { hasPermission, permissions, isLoading } = usePermissions();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       {hasPermission('issue:edit') && <EditButton />}
 *       <p>You have {permissions.length} permissions</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With permission-based components
 * ```tsx
 * function IssueActions({ issue }) {
 *   const { hasPermission } = usePermissions();
 *
 *   return (
 *     <div>
 *       <PermissionButton
 *         permission="issue:edit"
 *         hasPermission={hasPermission}
 *         onClick={handleEdit}
 *       >
 *         Edit Issue
 *       </PermissionButton>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePermissions(): UsePermissionsReturn {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && !!session;

  // Get current membership and permissions (only if authenticated)
  const {
    data: membership,
    isLoading,
    isError,
  } = api.user.getCurrentMembership.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Memoize the permissions array
  const permissions = useMemo(() => {
    if (!membership?.permissions) return [];
    return membership.permissions;
  }, [membership?.permissions]);

  // Create the hasPermission function
  const hasPermission: HasPermissionFunction = useCallback(
    (permission: string) => {
      if (!isAuthenticated) return false;
      if (!permissions.length) return false;
      return permissions.includes(permission);
    },
    [isAuthenticated, permissions],
  );

  // Check if user is admin
  const isAdmin = useMemo(() => {
    return membership?.role === "Admin";
  }, [membership?.role]);

  return {
    hasPermission,
    permissions,
    isAuthenticated,
    isLoading: status === "loading" || isLoading,
    isError,
    roleName: membership?.role,
    isAdmin,
  };
}

/**
 * Hook to require a specific permission and redirect if not available
 *
 * This hook is useful for pages or components that should only be accessible
 * with certain permissions. It will redirect to a specified path if the
 * permission is not available.
 *
 * @param permission - The required permission
 * @param redirectTo - Path to redirect to if permission is missing (default: "/")
 *
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const { isLoading } = useRequiredPermission("admin:view_analytics", "/dashboard");
 *
 *   if (isLoading) return <div>Checking permissions...</div>;
 *
 *   return <div>Admin content here</div>;
 * }
 * ```
 */
export function useRequiredPermission(
  permission: string,
  redirectTo = "/",
): { isLoading: boolean } {
  const router = useRouter();
  const { hasPermission, isAuthenticated, isLoading } = usePermissions();

  // Check permission once loading is complete
  useMemo(() => {
    if (!isLoading && isAuthenticated && !hasPermission(permission)) {
      router.push(redirectTo);
    }
  }, [
    isLoading,
    isAuthenticated,
    hasPermission,
    permission,
    redirectTo,
    router,
  ]);

  return { isLoading };
}

/**
 * Hook to get a tooltip message for a permission
 *
 * This hook provides human-readable messages explaining what a permission allows,
 * useful for tooltips on disabled buttons.
 *
 * @param permission - The permission to get tooltip text for
 * @returns Human-readable description of the permission
 *
 * @example
 * ```tsx
 * function ActionButton() {
 *   const { hasPermission } = usePermissions();
 *   const tooltipText = usePermissionTooltip("issue:edit");
 *
 *   return (
 *     <Tooltip title={!hasPermission("issue:edit") ? tooltipText : ""}>
 *       <Button disabled={!hasPermission("issue:edit")}>
 *         Edit Issue
 *       </Button>
 *     </Tooltip>
 *   );
 * }
 * ```
 */
export function usePermissionTooltip(permission: string): string {
  return useMemo(() => {
    // Use client-safe permission descriptions
    return getPermissionDescription(permission);
  }, [permission]);
}
