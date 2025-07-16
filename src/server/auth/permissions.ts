import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export async function hasPermission(
  membership: { roleId: string },
  permission: string,
  prisma: PrismaClient,
): Promise<boolean> {
  const role = await prisma.role.findUnique({
    where: { id: membership.roleId },
    include: {
      permissions: {
        where: { name: permission },
      },
    },
  });

  return (role?.permissions.length ?? 0) > 0;
}

export async function requirePermission(
  membership: { roleId: string },
  permission: string,
  prisma: PrismaClient,
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
  prisma: PrismaClient,
): Promise<string[]> {
  const role = await prisma.role.findUnique({
    where: { id: membership.roleId },
    include: { permissions: true },
  });

  return role?.permissions.map((p) => p.name) ?? [];
}
