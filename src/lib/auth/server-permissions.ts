/**
 * Server Component Permission Utilities
 *
 * Provides convenient helpers for checking permissions in Server Components
 * that use the getRequestAuthContext pattern.
 */

import { cache } from "react";
import type { AuthContext } from "~/server/auth/context";
import { hasPermission, getUserPermissions } from "~/server/auth/permissions";
import { db } from "~/lib/dal/shared";

/**
 * Extract the authorized variant from AuthContext discriminated union
 */
type AuthorizedContext = Extract<AuthContext, { kind: "authorized" }>;

/**
 * Check if the current authorized user has a specific permission
 *
 * @param authContext - The authorized auth context from getRequestAuthContext()
 * @param permission - Permission constant to check (e.g., PERMISSIONS.USER_MANAGE)
 * @returns Promise<boolean> - Whether the user has the permission
 *
 * @example
 * ```ts
 * const authContext = await getRequestAuthContext();
 * if (authContext.kind !== "authorized") return;
 *
 * const canManageUsers = await checkPermission(authContext, PERMISSIONS.USER_MANAGE);
 * ```
 */
export const checkPermission = cache(async (
  authContext: AuthorizedContext,
  permission: string,
): Promise<boolean> => {
  return hasPermission(
    { roleId: authContext.membership.role.id },
    permission,
    db,
  );
});

/**
 * Get all permissions for the current authorized user
 *
 * @param authContext - The authorized auth context from getRequestAuthContext()
 * @returns Promise<string[]> - Array of permission strings
 *
 * @example
 * ```ts
 * const authContext = await getRequestAuthContext();
 * if (authContext.kind !== "authorized") return;
 *
 * const permissions = await getAuthPermissions(authContext);
 * const canManageUsers = permissions.includes(PERMISSIONS.USER_MANAGE);
 * ```
 */
export const getAuthPermissions = cache(async (
  authContext: AuthorizedContext,
): Promise<string[]> => {
  return getUserPermissions(
    { roleId: authContext.membership.role.id },
    db,
  );
});

/**
 * Check multiple permissions at once
 * Returns an object mapping permission names to boolean values
 *
 * @param authContext - The authorized auth context from getRequestAuthContext()
 * @param permissions - Array of permission constants to check
 * @returns Promise<Record<string, boolean>> - Map of permission to boolean
 *
 * @example
 * ```ts
 * const authContext = await getRequestAuthContext();
 * if (authContext.kind !== "authorized") return;
 *
 * const perms = await checkMultiplePermissions(authContext, [
 *   PERMISSIONS.USER_MANAGE,
 *   PERMISSIONS.ORGANIZATION_MANAGE,
 * ]);
 *
 * const canManageUsers = perms[PERMISSIONS.USER_MANAGE];
 * const canManageOrg = perms[PERMISSIONS.ORGANIZATION_MANAGE];
 * ```
 */
export const checkMultiplePermissions = cache(async (
  authContext: AuthorizedContext,
  permissions: string[],
): Promise<Record<string, boolean>> => {
  const userPermissions = await getUserPermissions(
    { roleId: authContext.membership.role.id },
    db,
  );

  const result: Record<string, boolean> = {};
  for (const permission of permissions) {
    // eslint-disable-next-line security/detect-object-injection
    result[permission] = userPermissions.includes(permission);
  }

  return result;
});
