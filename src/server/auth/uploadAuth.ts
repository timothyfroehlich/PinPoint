import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { type NextRequest } from "next/server";

import { getSupabaseUser } from "./supabase";
import { isValidOrganization, isValidMembership } from "./types";

import type { PinPointSupabaseUser } from "~/lib/supabase/types";
import type { DrizzleClient } from "~/server/db/drizzle";

import { env } from "~/env";
import { organizations, memberships } from "~/server/db/schema";

export interface UploadAuthContext {
  user: PinPointSupabaseUser;
  organization: {
    id: string;
    name: string;
    subdomain: string;
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
  drizzle: DrizzleClient,
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

  const organizationResult = await drizzle.query.organizations.findFirst({
    where: eq(organizations.subdomain, subdomain),
  });

  if (!isValidOrganization(organizationResult)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Organization with subdomain "${subdomain}" not found`,
    });
  }

  // 3. Get user's membership and permissions
  const membershipResult = await drizzle.query.memberships.findFirst({
    where: and(
      eq(memberships.organizationId, organizationResult.id),
      eq(memberships.userId, user.id),
    ),
    with: {
      role: {
        with: {
          rolePermissions: {
            with: {
              permission: true,
            },
          },
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
    userPermissions: membershipResult.role.rolePermissions.map(
      (rp) => rp.permission.name,
    ),
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
  _drizzle: DrizzleClient,
  _sessionId?: string,
  _organizationId?: string,
): void {
  // This function is a placeholder for now, but it will be used in the future
  // to validate uploads without a full request object.
  return;
}
