import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { PermissionService } from "../services/permissionService";

import { SYSTEM_ROLES } from "./permissions.constants";

import type { PinPointSupabaseUser } from "~/lib/supabase/types";

import { type DrizzleClient } from "~/server/db/drizzle";
import { roles } from "~/server/db/schema";

// Legacy session type for backward compatibility
type Session = {
  user: {
    id: string;
    [key: string]: unknown;
  };
} | null;

/**
 * Checks if a given membership has a specific permission.
 *
 * @param membership - The membership object, containing the roleId.
 * @param permission - The permission string to check for.
 * @param db - The Drizzle client instance.
 * @returns A boolean indicating whether the permission is granted.
 */
export async function hasPermission(
  membership: { roleId: string | null },
  permission: string,
  db: DrizzleClient,
): Promise<boolean> {
  if (!membership.roleId) {
    return false;
  }

  const role = await db.query.roles.findFirst({
    where: eq(roles.id, membership.roleId),
    columns: { name: true, isSystem: true },
    with: {
      rolePermissions: {
        with: {
          permission: {
            columns: { name: true },
          },
        },
      },
    },
  });

  if (!role) {
    return false;
  }

  if (role.isSystem && role.name === SYSTEM_ROLES.ADMIN) {
    return true;
  }

  const permissionService = new PermissionService(db);
  const rolePermissions = role.rolePermissions.map((rp) => rp.permission.name);
  const expandedPermissions =
    permissionService.expandPermissionsWithDependencies(rolePermissions);

  return expandedPermissions.includes(permission);
}

/**
 * Enforces that a given membership has a specific permission.
 * Throws a TRPCError if the permission is not granted.
 *
 * @param membership - The membership object, containing the roleId.
 * @param permission - The permission string to require.
 * @param db - The Drizzle client instance.
 */
export async function requirePermission(
  membership: { roleId: string | null },
  permission: string,
  db: DrizzleClient,
): Promise<void> {
  if (!(await hasPermission(membership, permission, db))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Permission required: ${permission}`,
    });
  }
}

/**
 * Retrieves all permissions for a given membership.
 *
 * @param membership - The membership object, containing the roleId.
 * @param db - The Drizzle client instance.
 * @returns A string array of all granted permissions.
 */
export async function getUserPermissions(
  membership: { roleId: string | null },
  db: DrizzleClient,
): Promise<string[]> {
  if (!membership.roleId) {
    return [];
  }
  const role = await db.query.roles.findFirst({
    where: eq(roles.id, membership.roleId),
    columns: { name: true, isSystem: true },
    with: {
      rolePermissions: {
        with: {
          permission: {
            columns: { name: true },
          },
        },
      },
    },
  });

  if (!role) {
    return [];
  }

  if (role.isSystem && role.name === SYSTEM_ROLES.ADMIN) {
    const allPermissions = await db.query.permissions.findMany({
      columns: { name: true },
    });
    return allPermissions.map((p) => p.name);
  }

  const permissionService = new PermissionService(db);
  const rolePermissions = role.rolePermissions.map((rp) => rp.permission.name);
  return permissionService.expandPermissionsWithDependencies(rolePermissions);
}

/**
 * Checks if a user session has a specific permission.
 *
 * Post-RLS Migration: Organization context is automatically handled by RLS policies.
 *
 * @param session - The NextAuth session object.
 * @param permission - The permission string to check for.
 * @param db - The Drizzle client instance.
 * @returns A boolean indicating whether the permission is granted.
 */
export async function hasPermissionForSession(
  session: Session | null,
  permission: string,
  db: DrizzleClient,
): Promise<boolean> {
  const permissionService = new PermissionService(db);
  return permissionService.hasPermission(session, permission);
}

/**
 * Enforces that a user session has a specific permission.
 * Throws a TRPCError if the permission is not granted.
 *
 * Post-RLS Migration: Organization context is automatically handled by RLS policies.
 *
 * @param session - The NextAuth session object.
 * @param permission - The permission string to require.
 * @param db - The Drizzle client instance.
 */
export async function requirePermissionForSession(
  session: Session | null,
  permission: string,
  db: DrizzleClient,
): Promise<void> {
  const permissionService = new PermissionService(db);
  await permissionService.requirePermission(session, permission);
}

/**
 * Retrieves all permissions for a user session.
 *
 * Post-RLS Migration: Organization context is automatically handled by RLS policies.
 *
 * @param session - The NextAuth session object.
 * @param db - The Drizzle client instance.
 * @returns A string array of all granted permissions.
 */
export async function getUserPermissionsForSession(
  session: Session | null,
  db: DrizzleClient,
): Promise<string[]> {
  const permissionService = new PermissionService(db);
  return permissionService.getUserPermissions(session);
}

/**
 * Get all permissions for a Supabase user
 *
 * Post-RLS Migration: Organization context is automatically handled by RLS policies.
 *
 * @param user - The Supabase user
 * @param db - The Drizzle client instance
 * @returns A string array of all granted permissions.
 */
export async function getUserPermissionsForSupabaseUser(
  user: PinPointSupabaseUser | null,
  db: DrizzleClient,
): Promise<string[]> {
  const permissionService = new PermissionService(db);
  return permissionService.getUserPermissionsForSupabaseUser(user);
}
