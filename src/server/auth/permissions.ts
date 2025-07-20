import { type PrismaClient } from "@prisma/client";
import { type Session } from "next-auth";
import { TRPCError } from "@trpc/server";
import { PermissionService } from "../services/permissionService";
import { SYSTEM_ROLES } from "./permissions.constants";

/**
 * Session-based Permission Functions
 * 
 * Use these for new code that works with user sessions.
 */

import { type ExtendedPrismaClient } from "../db";

export async function hasPermission(
  session: Session | null,
  permission: string,
  prisma: PrismaClient,
  organizationId?: string,
): Promise<boolean> {
  const permissionService = new PermissionService(prisma);
  return permissionService.hasPermission(session, permission, organizationId);
}

export async function requirePermission(
  session: Session | null,
  permission: string,
  prisma: PrismaClient,
  organizationId?: string,
): Promise<void> {
  const permissionService = new PermissionService(prisma);
  return permissionService.requirePermission(session, permission, organizationId);
}

export async function getUserPermissions(
  session: Session | null,
  prisma: PrismaClient,
  organizationId?: string,
): Promise<string[]> {
  const permissionService = new PermissionService(prisma);
  return permissionService.getUserPermissions(session, organizationId);
}

/**
 * Legacy Membership-based Permission Functions
 * 
 * Maintained for backward compatibility. Use session-based functions for new code.
 */

export async function hasPermissionLegacy(
  membership: { roleId: string },
  permission: string,
  prisma: ExtendedPrismaClient,
): Promise<boolean> {
  const role = await prisma.role.findUnique({
    where: { id: membership.roleId },
    include: {
      permissions: true,
    },
  });

  if (!role) {
    return false;
  }

  // Admin role has all permissions
  if (role.name === SYSTEM_ROLES.ADMIN) {
    return true;
  }

  // Check if role has the specific permission (with dependency resolution)
  const permissionService = new PermissionService(prisma);
  const rolePermissions = role.permissions.map(p => p.name);
  const expandedPermissions = permissionService.expandPermissionsWithDependencies(rolePermissions);
  
  return expandedPermissions.includes(permission);
}

export async function requirePermissionLegacy(
  membership: { roleId: string },
  permission: string,
  prisma: ExtendedPrismaClient,
): Promise<void> {
  if (!(await hasPermissionLegacy(membership, permission, prisma))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Permission required: ${permission}`,
    });
  }
}

export async function getUserPermissionsLegacy(
  membership: { roleId: string },
  prisma: ExtendedPrismaClient,
): Promise<string[]> {
  const role = await prisma.role.findUnique({
    where: { id: membership.roleId },
    include: { permissions: true },
  });

  if (!role) {
    return [];
  }

  // Expand permissions with dependencies
  const permissionService = new PermissionService(prisma);
  const rolePermissions = role.permissions.map(p => p.name);
  return permissionService.expandPermissionsWithDependencies(rolePermissions);
}
