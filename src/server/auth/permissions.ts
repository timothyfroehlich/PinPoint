import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { type Session } from "next-auth";

import { type ExtendedPrismaClient } from "../db";
import { PermissionService } from "../services/permissionService";

import { SYSTEM_ROLES } from "./permissions.constants";

/**
 * Checks if a given membership has a specific permission.
 *
 * @param membership - The membership object, containing the roleId.
 * @param permission - The permission string to check for.
 * @param prisma - The Prisma client instance.
 * @returns A boolean indicating whether the permission is granted.
 */
export async function hasPermission(
  membership: { roleId: string | null },
  permission: string,
  prisma: ExtendedPrismaClient,
): Promise<boolean> {
  if (!membership.roleId) {
    return false;
  }

  const role = await prisma.role.findUnique({
    where: { id: membership.roleId },
    select: { name: true, permissions: { select: { name: true } } },
  });

  if (!role) {
    return false;
  }

  if (role.name === SYSTEM_ROLES.ADMIN) {
    return true;
  }

  const permissionService = new PermissionService(prisma);
  const rolePermissions = role.permissions.map(p => p.name);
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
 * @param prisma - The Prisma client instance.
 */
export async function requirePermission(
  membership: { roleId: string | null },
  permission: string,
  prisma: ExtendedPrismaClient,
): Promise<void> {
  if (!(await hasPermission(membership, permission, prisma))) {
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
 * @param prisma - The Prisma client instance.
 * @returns A string array of all granted permissions.
 */
export async function getUserPermissions(
  membership: { roleId: string | null },
  prisma: ExtendedPrismaClient,
): Promise<string[]> {
  if (!membership.roleId) {
    return [];
  }
  const role = await prisma.role.findUnique({
    where: { id: membership.roleId },
    select: { name: true, permissions: { select: { name: true } } },
  });

  if (!role) {
    return [];
  }

  if (role.name === SYSTEM_ROLES.ADMIN) {
    const allPermissions = await prisma.permission.findMany({
      select: { name: true },
    });
    return allPermissions.map((p) => p.name);
  }

  const permissionService = new PermissionService(prisma);
  const rolePermissions = role.permissions.map(p => p.name);
  return permissionService.expandPermissionsWithDependencies(rolePermissions);
}

/**
 * Checks if a user session has a specific permission within an organization.
 *
 * @param session - The NextAuth session object.
 * @param permission - The permission string to check for.
 * @param prisma - The Prisma client instance.
 * @param organizationId - The ID of the organization to check against.
 * @returns A boolean indicating whether the permission is granted.
 */
export async function hasPermissionForSession(
  session: Session | null,
  permission: string,
  prisma: PrismaClient,
  organizationId: string,
): Promise<boolean> {
  const permissionService = new PermissionService(prisma);
  return permissionService.hasPermission(session, permission, organizationId);
}

/**
 * Enforces that a user session has a specific permission.
 * Throws a TRPCError if the permission is not granted.
 *
 * @param session - The NextAuth session object.
 * @param permission - The permission string to require.
 * @param prisma - The Prisma client instance.
 * @param organizationId - The ID of the organization to check against.
 */
export async function requirePermissionForSession(
  session: Session | null,
  permission: string,
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const permissionService = new PermissionService(prisma);
  await permissionService.requirePermission(
    session,
    permission,
    organizationId,
  );
}

/**
 * Retrieves all permissions for a user session in a given organization.
 *
 * @param session - The NextAuth session object.
 * @param prisma - The Prisma client instance.
 * @param organizationId - The ID of the organization.
 * @returns A string array of all granted permissions.
 */
export async function getUserPermissionsForSession(
  session: Session | null,
  prisma: PrismaClient,
  organizationId: string,
): Promise<string[]> {
  const permissionService = new PermissionService(prisma);
  return permissionService.getUserPermissions(session, organizationId);
}
