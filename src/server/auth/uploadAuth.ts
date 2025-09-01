import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { type NextRequest } from "next/server";

import { getSupabaseUser } from "./supabase";
import { isValidOrganization, isValidMembership } from "./types";
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";

import type { PinPointSupabaseUser } from "~/lib/supabase/types";
import type { DrizzleClient } from "~/server/db/drizzle";

import { organizations, memberships } from "~/server/db/schema";
import { extractTrustedSubdomain, parseSubdomainFromHost } from "~/lib/subdomain-verification";

export interface UploadAuthContext {
  user: PinPointSupabaseUser;
  organization: {
    id: string;
    name: string;
    subdomain: string;
  };
  membership: {
    id: string;
    user_id: string;
    organization_id: string;
    role_id: string;
    role: {
      id: string;
      name: string;
      permissions: { name: string }[];
    };
  };
  userPermissions: string[];
}

/**
 * Transforms upload auth context from database snake_case to API camelCase
 * @param ctx Raw database context with snake_case fields
 * @returns Transformed context with camelCase fields for API consumption
 */
function transformUploadAuthContext(ctx: unknown): unknown {
  return transformKeysToCamelCase(ctx) as UploadAuthContext;
}

/**
 * Gets upload authentication context with camelCase data for API consumption.
 * Database operations use snake_case, but results are transformed to camelCase
 * for TypeScript interface compatibility.
 */
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

  // 2. Resolve organization from subdomain: verified header, else fallback to Host parsing
  const host = req.headers.get("host") ?? "";
  const subdomain =
    extractTrustedSubdomain(req.headers as unknown as Headers) ??
    parseSubdomainFromHost(host);
  if (!subdomain) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid subdomain - organization context required",
    });
  }

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
      eq(memberships.organization_id, organizationResult.id),
      eq(memberships.user_id, user.id),
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

  // Transform database results to camelCase for API compatibility
  const transformedOrganization = transformKeysToCamelCase(
    organizationResult,
  ) as UploadAuthContext["organization"];
  const transformedMembership = transformKeysToCamelCase(
    membershipResult,
  ) as UploadAuthContext["membership"];

  return transformUploadAuthContext({
    user,
    organization: transformedOrganization,
    membership: transformedMembership,
    userPermissions: membershipResult.role.permissions.map((p) => p.name),
  }) as UploadAuthContext;
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
