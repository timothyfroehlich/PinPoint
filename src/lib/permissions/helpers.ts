/**
 * Permission Helper Utilities
 *
 * Functions to check permissions against the matrix,
 * handling ownership context for conditional permissions.
 */

import {
  type AccessLevel,
  type PermissionValue,
  getPermission,
  PERMISSIONS_BY_ID,
} from "./matrix";

/**
 * Context for ownership-based permission checks.
 */
export interface OwnershipContext {
  /** The current user's ID (undefined if unauthenticated) */
  userId?: string | undefined;
  /** For issue permissions: the ID of the user who reported the issue */
  reporterId?: string | null | undefined;
  /** For machine permissions: the ID of the machine owner */
  machineOwnerId?: string | null | undefined;
}

/**
 * Determine the access level for a user based on their role.
 * Returns 'unauthenticated' if no user/role provided.
 */
export function getAccessLevel(
  role: "guest" | "member" | "technician" | "admin" | undefined | null
): AccessLevel {
  if (!role) return "unauthenticated";
  return role;
}

/**
 * Check if a user has a specific permission.
 *
 * Handles conditional permissions:
 * - 'own': Requires userId === reporterId
 * - 'owner': Requires userId === machineOwnerId
 *
 * @param permissionId - The permission to check (e.g., 'issues.update.status')
 * @param accessLevel - The user's access level
 * @param context - Optional ownership context for conditional permissions
 * @returns true if permission is granted, false otherwise
 */
export function checkPermission(
  permissionId: string,
  accessLevel: AccessLevel,
  context?: OwnershipContext
): boolean {
  const value = getPermission(permissionId, accessLevel);

  // Simple boolean permissions
  if (value === true) return true;
  if (value === false) return false;

  // Conditional permissions require context
  if (!context?.userId) return false;

  // At this point, value is either "own" or "owner"
  if (value === "own") {
    return context.userId === context.reporterId;
  }

  // value === "owner"
  return context.userId === context.machineOwnerId;
}

/**
 * Get the permission state for UI rendering.
 *
 * Returns more detailed info for rendering disabled states with tooltips.
 */
export type PermissionState =
  | { allowed: true }
  | { allowed: false; reason: "unauthenticated" | "role" | "ownership" };

export function getPermissionState(
  permissionId: string,
  accessLevel: AccessLevel,
  context?: OwnershipContext
): PermissionState {
  const value = getPermission(permissionId, accessLevel);

  if (value === true) {
    return { allowed: true };
  }

  if (value === false) {
    if (accessLevel === "unauthenticated") {
      return { allowed: false, reason: "unauthenticated" };
    }
    return { allowed: false, reason: "role" };
  }

  // Conditional permission
  if (!context?.userId) {
    return { allowed: false, reason: "unauthenticated" };
  }

  const isOwner =
    value === "own"
      ? context.userId === context.reporterId
      : context.userId === context.machineOwnerId;

  if (isOwner) {
    return { allowed: true };
  }

  return { allowed: false, reason: "ownership" };
}

/**
 * Get a human-readable reason for why a permission is denied.
 * Useful for tooltip text on disabled controls.
 */
export function getPermissionDeniedReason(
  permissionId: string,
  accessLevel: AccessLevel,
  context?: OwnershipContext
): string | null {
  const state = getPermissionState(permissionId, accessLevel, context);

  if (state.allowed) return null;

  switch (state.reason) {
    case "unauthenticated":
      return "Log in to perform this action";
    case "role":
      if (accessLevel === "guest") {
        return "Members can perform this action";
      }
      if (accessLevel === "member") {
        return "Technicians or admins can perform this action";
      }
      if (accessLevel === "technician") {
        return "Only admins can perform this action";
      }
      return "You don't have permission to perform this action";
    case "ownership":
      return "Only the owner can perform this action";
  }
}

/**
 * Check multiple permissions at once.
 * Returns true only if ALL permissions are granted.
 */
export function checkPermissions(
  permissionIds: string[],
  accessLevel: AccessLevel,
  context?: OwnershipContext
): boolean {
  return permissionIds.every((id) => checkPermission(id, accessLevel, context));
}

/**
 * Check if ANY of the given permissions are granted.
 */
export function checkAnyPermission(
  permissionIds: string[],
  accessLevel: AccessLevel,
  context?: OwnershipContext
): boolean {
  return permissionIds.some((id) => checkPermission(id, accessLevel, context));
}

/**
 * Get all granted permissions for a user.
 * Useful for debugging and comprehensive permission checks.
 */
export function getGrantedPermissions(
  accessLevel: AccessLevel,
  context?: OwnershipContext
): string[] {
  return Object.keys(PERMISSIONS_BY_ID).filter((id) =>
    checkPermission(id, accessLevel, context)
  );
}

/**
 * Permission value for raw access without ownership resolution.
 * Useful when you need to know if a permission is conditional.
 */
export function getRawPermissionValue(
  permissionId: string,
  accessLevel: AccessLevel
): PermissionValue {
  return getPermission(permissionId, accessLevel);
}

/**
 * Check if a permission is conditional (requires ownership check).
 */
export function isConditionalPermission(
  permissionId: string,
  accessLevel: AccessLevel
): boolean {
  const value = getPermission(permissionId, accessLevel);
  return value === "own" || value === "owner";
}
