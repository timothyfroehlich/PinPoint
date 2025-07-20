import { TRPCError } from "@trpc/server";

import { type ExtendedPrismaClient } from "../db";

export async function hasPermission(
  membership: { roleId: string },
  permission: string,
  prisma: ExtendedPrismaClient,
): Promise<boolean> {
  const roleResult = await prisma.role.findUnique({
    where: { id: membership.roleId },
    include: {
      permissions: {
        where: { name: permission },
      },
    },
  });

  if (
    roleResult &&
    typeof roleResult === "object" &&
    "permissions" in roleResult &&
    Array.isArray(roleResult.permissions)
  ) {
    return roleResult.permissions.length > 0;
  }

  return false;
}

export async function requirePermission(
  membership: { roleId: string },
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

export async function getUserPermissions(
  membership: { roleId: string },
  prisma: ExtendedPrismaClient,
): Promise<string[]> {
  const roleResult = await prisma.role.findUnique({
    where: { id: membership.roleId },
    include: { permissions: true },
  });

  if (
    roleResult &&
    typeof roleResult === "object" &&
    "permissions" in roleResult &&
    Array.isArray(roleResult.permissions)
  ) {
    return roleResult.permissions.map((p) => p.name);
  }

  return [];
}
