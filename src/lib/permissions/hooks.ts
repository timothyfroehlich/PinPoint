"use client";

/**
 * React hooks for permission checking in UI components.
 */

import { useMemo } from "react";

import type { UserRole } from "~/lib/types/user";

import { type AccessLevel, type PermissionValue } from "./matrix";
import {
  type OwnershipContext,
  checkPermission,
  getAccessLevel,
  getPermissionDeniedReason,
  getPermissionState,
  getRawPermissionValue,
  isConditionalPermission,
} from "./helpers";

/**
 * User context for permission hooks.
 */
export interface PermissionUser {
  id: string;
  role: UserRole;
}

/**
 * Issue context for permission checks.
 */
export interface IssueContext {
  reportedBy: string | null;
}

/**
 * Machine context for permission checks.
 */
export interface MachineContext {
  ownerId: string | null;
}

/**
 * Hook to check a single permission.
 *
 * @example
 * ```tsx
 * const canComment = usePermission('comments.add', user);
 * if (!canComment) return <LoginPrompt />;
 * ```
 */
export function usePermission(
  permissionId: string,
  user: PermissionUser | null | undefined,
  context?: { issue?: IssueContext; machine?: MachineContext }
): boolean {
  return useMemo(() => {
    const accessLevel = getAccessLevel(user?.role);
    const ownershipContext: OwnershipContext = {
      userId: user?.id,
      reporterId: context?.issue?.reportedBy,
      machineOwnerId: context?.machine?.ownerId,
    };
    return checkPermission(permissionId, accessLevel, ownershipContext);
  }, [
    permissionId,
    user?.id,
    user?.role,
    context?.issue?.reportedBy,
    context?.machine?.ownerId,
  ]);
}

/**
 * Hook that returns permission state with reason for denial.
 * Useful for rendering disabled controls with tooltips.
 *
 * @example
 * ```tsx
 * const { allowed, reason } = usePermissionState('issues.update.priority', user);
 * return (
 *   <Select disabled={!allowed} title={reason}>
 *     ...
 *   </Select>
 * );
 * ```
 */
export function usePermissionState(
  permissionId: string,
  user: PermissionUser | null | undefined,
  context?: { issue?: IssueContext; machine?: MachineContext }
): { allowed: boolean; reason: string | null } {
  return useMemo(() => {
    const accessLevel = getAccessLevel(user?.role);
    const ownershipContext: OwnershipContext = {
      userId: user?.id,
      reporterId: context?.issue?.reportedBy,
      machineOwnerId: context?.machine?.ownerId,
    };
    const state = getPermissionState(
      permissionId,
      accessLevel,
      ownershipContext
    );
    const reason = state.allowed
      ? null
      : getPermissionDeniedReason(permissionId, accessLevel, ownershipContext);
    return { allowed: state.allowed, reason };
  }, [
    permissionId,
    user?.id,
    user?.role,
    context?.issue?.reportedBy,
    context?.machine?.ownerId,
  ]);
}

/**
 * Hook to check multiple permissions at once.
 * Returns an object mapping permission IDs to their granted status.
 *
 * @example
 * ```tsx
 * const perms = usePermissions(
 *   ['issues.update.status', 'issues.update.priority'],
 *   user,
 *   { issue }
 * );
 * // perms = { 'issues.update.status': true, 'issues.update.priority': false }
 * ```
 */
export function usePermissions(
  permissionIds: string[],
  user: PermissionUser | null | undefined,
  context?: { issue?: IssueContext; machine?: MachineContext }
): Record<string, boolean> {
  return useMemo(() => {
    const accessLevel = getAccessLevel(user?.role);
    const ownershipContext: OwnershipContext = {
      userId: user?.id,
      reporterId: context?.issue?.reportedBy,
      machineOwnerId: context?.machine?.ownerId,
    };

    const result: Record<string, boolean> = {};
    for (const id of permissionIds) {
      result[id] = checkPermission(id, accessLevel, ownershipContext);
    }
    return result;
  }, [
    // Stringify the array for stable dependency
    permissionIds.join(","),
    user?.id,
    user?.role,
    context?.issue?.reportedBy,
    context?.machine?.ownerId,
  ]);
}

/**
 * Hook to get permission states for multiple permissions.
 * Returns detailed state including denial reasons.
 *
 * @example
 * ```tsx
 * const states = usePermissionStates(
 *   ['issues.update.status', 'issues.update.priority'],
 *   user,
 *   { issue }
 * );
 * // states['issues.update.priority'].reason = 'Members can perform this action'
 * ```
 */
export function usePermissionStates(
  permissionIds: string[],
  user: PermissionUser | null | undefined,
  context?: { issue?: IssueContext; machine?: MachineContext }
): Record<string, { allowed: boolean; reason: string | null }> {
  return useMemo(() => {
    const accessLevel = getAccessLevel(user?.role);
    const ownershipContext: OwnershipContext = {
      userId: user?.id,
      reporterId: context?.issue?.reportedBy,
      machineOwnerId: context?.machine?.ownerId,
    };

    const result: Record<string, { allowed: boolean; reason: string | null }> =
      {};
    for (const id of permissionIds) {
      const state = getPermissionState(id, accessLevel, ownershipContext);
      const reason = state.allowed
        ? null
        : getPermissionDeniedReason(id, accessLevel, ownershipContext);
      result[id] = { allowed: state.allowed, reason };
    }
    return result;
  }, [
    permissionIds.join(","),
    user?.id,
    user?.role,
    context?.issue?.reportedBy,
    context?.machine?.ownerId,
  ]);
}

/**
 * Hook to get the user's access level.
 * Useful for conditional rendering based on authentication state.
 */
export function useAccessLevel(
  user: PermissionUser | null | undefined
): AccessLevel {
  return useMemo(() => getAccessLevel(user?.role), [user?.role]);
}

/**
 * Hook to check if the current user is authenticated.
 */
export function useIsAuthenticated(
  user: PermissionUser | null | undefined
): boolean {
  return useMemo(() => !!user?.id, [user?.id]);
}

/**
 * Hook to check if a permission requires ownership.
 * Useful for deciding whether to show "own only" UI hints.
 */
export function useIsConditionalPermission(
  permissionId: string,
  user: PermissionUser | null | undefined
): boolean {
  return useMemo(() => {
    const accessLevel = getAccessLevel(user?.role);
    return isConditionalPermission(permissionId, accessLevel);
  }, [permissionId, user?.role]);
}

/**
 * Hook to get raw permission value (true, false, 'own', 'owner').
 * Useful for custom rendering logic.
 */
export function useRawPermission(
  permissionId: string,
  user: PermissionUser | null | undefined
): PermissionValue {
  return useMemo(() => {
    const accessLevel = getAccessLevel(user?.role);
    return getRawPermissionValue(permissionId, accessLevel);
  }, [permissionId, user?.role]);
}
