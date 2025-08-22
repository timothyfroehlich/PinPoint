import { eq } from "drizzle-orm";
import { vi } from "vitest";
import { type TestDatabase } from "./pglite-test-setup";
import { memberships, roles } from "../../server/db/schema";
import type { TRPCContext } from "../../server/api/trpc.base";
import { ServiceFactory } from "../../server/services/factory";
import { generateTestId } from "./test-id-generator";

export interface CreateSeededNotificationTestContextOptions {
  permissions?: string[];
}

/**
 * Creates a reusable TRPC context for notification-related tests using seeded data
 */
export async function createSeededNotificationTestContext(
  txDb: TestDatabase,
  organizationId: string,
  userId: string,
  options?: CreateSeededNotificationTestContextOptions,
): Promise<TRPCContext> {
  // Validate that required seeded data exists
  const organization = await txDb.query.organizations.findFirst({
    where: (organizations, { eq }) => eq(organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error(
      `Organization with ID ${organizationId} not found in seeded data`,
    );
  }

  const dbUser = await txDb.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
  });

  if (!dbUser) {
    throw new Error(`User with ID ${userId} not found in seeded data`);
  }

  // Query or create membership record for the user in the organization
  let membership = await txDb.query.memberships.findFirst({
    where: (memberships, { and, eq }) =>
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId),
      ),
  });

  // If no membership exists, create one within the transaction
  if (!membership) {
    // Get the admin role for the organization
    const adminRole = await txDb.query.roles.findFirst({
      where: (roles, { and, eq }) =>
        and(eq(roles.organizationId, organizationId), eq(roles.name, "admin")),
    });

    if (!adminRole) {
      throw new Error(
        `Admin role not found for organization ${organizationId}`,
      );
    }

    // Create the membership
    await txDb.insert(memberships).values({
      id: generateTestId("membership"),
      userId,
      organizationId,
      roleId: adminRole.id,
    });

    // Re-query the membership
    membership = await txDb.query.memberships.findFirst({
      where: (memberships, { and, eq }) =>
        and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, organizationId),
        ),
    });
  }
  if (!membership) {
    throw new Error(
      `Failed to create or find membership for user ${userId} in organization ${organizationId}`,
    );
  }

  // Create proper user object with organization metadata
  const user = {
    id: userId,
    email: dbUser.email,
    name: dbUser.email.split("@")[0], // Create name from email
    user_metadata: {},
    app_metadata: {
      organization_id: organizationId,
    },
  };

  // Set up permissions (use provided permissions or default notification permissions)
  const userPermissions = options?.permissions || [
    "notification:read",
    "notification:edit",
  ];

  // Configure logger with all required methods
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(),
    }),
    withRequest: vi.fn().mockReturnThis(),
    withUser: vi.fn().mockReturnThis(),
    withOrganization: vi.fn().mockReturnThis(),
    withContext: vi.fn().mockReturnThis(),
  };

  // Create TRPC context following the exact pattern from notification.test.ts
  const ctx: TRPCContext = {
    db: txDb,
    user,
    organization: {
      id: organizationId,
      name: organization.name,
      subdomain: organization.subdomain || "test",
    },
    organizationId,
    supabase: {} as any, // Not used in notification router
    headers: new Headers(),
    services: new ServiceFactory(txDb),
    logger: logger as any,
  };

  return ctx;
}
