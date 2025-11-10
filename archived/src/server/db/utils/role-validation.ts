import { TRPCError } from "@trpc/server";
import { eq, and, count } from "drizzle-orm";

import type { DrizzleClient } from "~/server/db/drizzle";

import { SYSTEM_ROLES } from "~/server/auth/permissions.constants";
import { roles, memberships } from "~/server/db/schema";

/**
 * Ensure organization has at least one admin member.
 * Throws error if no admin role exists or no members assigned to admin role.
 */
export async function ensureAtLeastOneAdmin(
  drizzle: DrizzleClient,
  organizationId: string,
): Promise<void> {
  // Get admin role for the organization
  const [adminRole] = await drizzle
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(
      and(
        eq(roles.organization_id, organizationId),
        eq(roles.name, SYSTEM_ROLES.ADMIN),
      ),
    )
    .limit(1);

  if (!adminRole) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Admin role not found for organization",
    });
  }

  // Count memberships for the admin role
  const [adminMemberCount] = await drizzle
    .select({ count: count() })
    .from(memberships)
    .where(eq(memberships.role_id, adminRole.id));

  if (!adminMemberCount || adminMemberCount.count === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Cannot complete operation: Organization must have at least one admin",
    });
  }
}
