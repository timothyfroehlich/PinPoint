import { TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";

import type { Session } from "next-auth";
import type { ExtendedPrismaClient } from "~/server/db";

import { env } from "~/env";
import { auth } from "~/server/auth";

export interface UploadAuthContext {
  session: Session;
  organization: {
    id: string;
    name: string;
    subdomain: string | null;
  };
  membership: {
    id: string;
    userId: string;
    organizationId: string;
    roleId: string;
    role: {
      id: string;
      name: string;
      permissions: { name: string }[];
    };
  };
  userPermissions: string[];
}

export async function getUploadAuthContext(
  req: NextRequest,
  db: ExtendedPrismaClient,
): Promise<UploadAuthContext> {
  // 1. Verify authentication
  const session = await auth();
  if (!session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  // 2. Resolve organization from subdomain
  let subdomain = req.headers.get("x-subdomain");
  subdomain ??= env.DEFAULT_ORG_SUBDOMAIN;

  const organization = await db.organization.findUnique({
    where: { subdomain },
  });

  if (!organization) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Organization with subdomain "${subdomain}" not found`,
    });
  }

  // 3. Get user's membership and permissions
  const membership = await db.membership.findFirst({
    where: {
      organizationId: organization.id,
      userId: session.user.id,
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is not a member of this organization",
    });
  }

  return {
    session,
    organization,
    membership,
    userPermissions: membership.role.permissions.map((p) => p.name),
  };
}

export function requireUploadPermission(
  ctx: UploadAuthContext,
  permission: string,
): void {
  if (!ctx.userPermissions.includes(permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Permission required: ${permission}`,
    });
  }
}

export function validateUploadAuth(
  _db: ExtendedPrismaClient,
  _sessionId?: string,
  _organizationId?: string,
): void {
  // This function is a placeholder for now, but it will be used in the future
  // to validate uploads without a full request object.
  return;
}
