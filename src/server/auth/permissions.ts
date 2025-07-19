import { TRPCError } from "@trpc/server";
import { type ExtendedPrismaClient } from "../db";
import { type PrismaRole, type PrismaPermission } from "./types";

interface MembershipInput {
  roleId: string;
}

interface RoleWithPermissions extends PrismaRole {
  permissions: PrismaPermission[];
}

export async function hasPermission(
  membership: MembershipInput,
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

  if (roleResult?.permissions) {
    return roleResult.permissions.length > 0;
  }

  return false;
}

export async function requirePermission(
  membership: MembershipInput,
  permission: string,
  prisma: ExtendedPrismaClient,
): Promise<void> {
  const hasPerm = await hasPermission(membership, permission, prisma);
  if (!hasPerm) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Permission required: ${permission}`,
    });
  }
}

export async function getUserPermissions(
  membership: MembershipInput,
  prisma: ExtendedPrismaClient,
): Promise<string[]> {
  const roleResult = (await prisma.role.findUnique({
    where: { id: membership.roleId },
    include: { permissions: true },
  })) as RoleWithPermissions | null;

  if (roleResult?.permissions) {
    return roleResult.permissions.map((p) => p.name);
  }

  return [];
}
