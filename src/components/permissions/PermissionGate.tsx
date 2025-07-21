"use client";

import { type ReactNode } from "react";

/**
 * Props for the PermissionGate component
 */
interface PermissionGateProps {
  /** The permission string to check (e.g., "issue:edit", "machine:create") */
  permission: string;
  /** Function to check if the user has the specified permission */
  hasPermission: (permission: string) => boolean;
  /** Optional fallback content to render when permission is not granted */
  fallback?: ReactNode;
  /** Children to render when permission is granted */
  children: ReactNode;
  /**
   * Whether to render nothing (default) or the fallback when permission is denied
   * @default false - renders nothing when permission denied
   */
  showFallback?: boolean;
}

/**
 * PermissionGate - Conditionally render children based on user permissions
 *
 * This component provides a clean way to show/hide UI elements based on permissions.
 * It integrates with the existing permission system that passes hasPermission functions.
 *
 * @example
 * ```tsx
 * <PermissionGate
 *   permission="issue:edit"
 *   hasPermission={hasPermission}
 * >
 *   <EditButton />
 * </PermissionGate>
 * ```
 *
 * @example With fallback
 * ```tsx
 * <PermissionGate
 *   permission="admin:view_analytics"
 *   hasPermission={hasPermission}
 *   fallback={<div>Access denied</div>}
 *   showFallback
 * >
 *   <AnalyticsPanel />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  permission,
  hasPermission,
  fallback,
  children,
  showFallback = false,
}: PermissionGateProps): ReactNode {
  const hasRequiredPermission = hasPermission(permission);

  if (hasRequiredPermission) {
    return <>{children}</>;
  }

  if (showFallback && fallback) {
    return <>{fallback}</>;
  }

  return null;
}

export type { PermissionGateProps };
