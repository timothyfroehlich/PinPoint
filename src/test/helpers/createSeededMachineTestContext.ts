/**
 * Seeded Machine Test Context Helper
 *
 * Creates reusable TRPC contexts for machine-related integration tests using the
 * established seeded data infrastructure. This helper eliminates code duplication
 * and ensures consistent context creation patterns across machine integration tests.
 *
 * Key Features:
 * - Uses seeded data infrastructure for predictable test data
 * - Queries or creates membership records for users in organizations
 * - Sets up mock services (NotificationService, QRCodeService, PinballMapService)
 * - Creates proper Supabase user objects with organization metadata
 * - Configures logger, headers, and permissions arrays
 * - Supports optional permission overrides for testing different access levels
 *
 * Usage:
 * ```typescript
 * import { createSeededMachineTestContext } from "~/test/helpers/createSeededMachineTestContext";
 * 
 * const context = await createSeededMachineTestContext(txDb, organizationId, userId);
 * const caller = machineRouter.createCaller(context);
 * ```
 */

import { eq, and } from "drizzle-orm";
import { vi } from "vitest";

import type { TRPCContext } from "~/server/api/trpc.base";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";

import * as schema from "~/server/db/schema";

/**
 * Options for customizing the test context
 */
export interface CreateSeededMachineTestContextOptions {
  /** Override default permissions for testing different access levels */
  permissions?: string[];
  /** Custom user metadata */
  userMetadata?: Record<string, unknown>;
  /** Custom app metadata */
  appMetadata?: Record<string, unknown>;
}

/**
 * Creates a TRPC context configured for machine-related tests using seeded data
 *
 * @param txDb - Transaction database instance from withIsolatedTest
 * @param organizationId - Organization ID from seeded data
 * @param userId - User ID from seeded data
 * @param options - Optional configuration overrides
 * @returns Properly configured TRPC context for machine router procedures
 */
export async function createSeededMachineTestContext(
  txDb: TestDatabase,
  organizationId: string,
  userId: string,
  options: CreateSeededMachineTestContextOptions = {},
): Promise<TRPCContext> {
  // Validate that required seeded data exists
  const organization = await txDb.query.organizations.findFirst({
    where: eq(schema.organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error(
      `Organization not found in seeded data: ${organizationId}. ` +
        "Ensure createSeededTestDatabase() was called before using this helper.",
    );
  }

  const user = await txDb.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    throw new Error(
      `User not found in seeded data: ${userId}. ` +
        "Ensure createSeededTestDatabase() was called before using this helper.",
    );
  }

  // Query or create membership record for the user in the organization
  let membership = await txDb.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.userId, userId),
      eq(schema.memberships.organizationId, organizationId),
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

  // If membership doesn't exist, create one within the transaction
  if (!membership) {
    // Get a role (prefer admin role for test flexibility)
    const adminRole = await txDb.query.roles.findFirst({
      where: and(
        eq(schema.roles.organizationId, organizationId),
        eq(schema.roles.name, "Admin"),
      ),
    });

    const memberRole = await txDb.query.roles.findFirst({
      where: and(
        eq(schema.roles.organizationId, organizationId),
        eq(schema.roles.name, "Member"),
      ),
    });

    const roleToUse = adminRole || memberRole;

    if (!roleToUse) {
      throw new Error(
        `No suitable role found for organization: ${organizationId}. ` +
          "Ensure seeded data includes Admin or Member roles.",
      );
    }

    // Create membership within the transaction
    const [createdMembership] = await txDb
      .insert(schema.memberships)
      .values({
        id: `test-membership-${userId}-${organizationId}`,
        userId,
        organizationId,
        roleId: roleToUse.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Re-query with relationships
    membership = await txDb.query.memberships.findFirst({
      where: eq(schema.memberships.id, createdMembership.id),
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

    if (!membership) {
      throw new Error("Failed to create membership for test context");
    }
  }

  // Extract permissions from membership or use provided overrides
  const permissions =
    options.permissions ||
    membership.role.rolePermissions.map((rp) => rp.permission.name) || [
      "machine:edit",
      "machine:delete",
      "organization:manage",
    ];

  // Create mock services for machine-related operations
  const mockServices = {
    createNotificationService: vi.fn(() => ({
      notifyMachineOwnerOfIssue: vi.fn(),
      notifyMachineOwnerOfStatusChange: vi.fn(),
      notifyUsersOfIssueStatusChange: vi.fn(),
      notifyUsersOfIssueComment: vi.fn(),
    })),
    createQRCodeService: vi.fn(() => ({
      generateQRCode: vi.fn(),
      generateQRCodeUrl: vi.fn(),
    })),
    createPinballMapService: vi.fn(() => ({
      searchMachines: vi.fn(),
      getMachineDetails: vi.fn(),
      syncMachineData: vi.fn(),
    })),
    createCollectionService: vi.fn(),
    createIssueActivityService: vi.fn(() => ({
      recordActivity: vi.fn(),
      recordIssueCreated: vi.fn(),
      recordIssueUpdated: vi.fn(),
    })),
    createCommentCleanupService: vi.fn(),
  };

  // Create proper Supabase user object with organization metadata
  const supabaseUser = {
    id: userId,
    email: user.email || `${userId}@test.example.com`,
    name: user.name || `Test User ${userId}`,
    user_metadata: {
      name: user.name || `Test User ${userId}`,
      ...options.userMetadata,
    },
    app_metadata: {
      organization_id: organizationId,
      role: membership.role.name,
      ...options.appMetadata,
    },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    role: "authenticated",
  } as const;

  // Create mock logger
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => mockLogger),
    withRequest: vi.fn(() => mockLogger),
    withUser: vi.fn(() => mockLogger),
    withOrganization: vi.fn(() => mockLogger),
    withContext: vi.fn(() => mockLogger),
  } as any;

  // Create the TRPC context
  const context: TRPCContext = {
    db: txDb as any, // Type assertion for Prisma compatibility
    drizzle: txDb,
    user: supabaseUser as any,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: supabaseUser },
          error: null,
        }),
      },
    } as any,
    organization: {
      id: organization.id,
      name: organization.name,
      subdomain: organization.subdomain,
    },
    organizationId: organizationId, // Add organizationId for orgScopedProcedure
    services: mockServices as any,
    headers: new Headers(),
    logger: mockLogger,
    userPermissions: permissions,
    traceId: `test-trace-${Date.now()}`,
    requestId: `test-request-${Date.now()}`,
  };

  return context;
}