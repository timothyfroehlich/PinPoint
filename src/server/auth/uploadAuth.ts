import { TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";

import { getSupabaseUser } from "./supabase";
import { isValidOrganization, isValidMembership } from "./types";

import type { PinPointSupabaseUser } from "../../../lib/supabase/types";
import type { ExtendedPrismaClient } from "~/server/db";

import { env } from "~/env";

export interface UploadAuthContext {
  user: PinPointSupabaseUser;
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
  const user = await getSupabaseUser();
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  // 2. Resolve organization from subdomain
  let subdomain = req.headers.get("x-subdomain");
  subdomain ??= env.DEFAULT_ORG_SUBDOMAIN;

  const organizationResult = await db.organization.findUnique({
    where: { subdomain },
  });

  if (!isValidOrganization(organizationResult)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Organization with subdomain "${subdomain}" not found`,
    });
  }

  // 3. Get user's membership and permissions
  const membershipResult = await db.membership.findFirst({
    where: {
      organizationId: organizationResult.id,
      userId: user.id,
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!isValidMembership(membershipResult)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User is not a member of this organization",
    });
  }

  return {
    user,
    organization: organizationResult,
    membership: membershipResult,
    userPermissions: membershipResult.role.permissions.map((p) => p.name),
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
