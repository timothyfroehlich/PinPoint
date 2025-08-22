/**
 * Seeded Location Test Context Helper
 *
 * Creates a ready-to-use TRPCContext for location router tests using seeded data.
 * Replaces manual test data creation with consistent seeded entities.
 *
 * Features:
 * - Uses SEED_TEST_IDS for predictable organization and user data
 * - Automatically ensures membership exists for the user
 * - Mocks external services (PinballMap, Notification, Collection, etc.)
 * - Returns fully configured context for location routers
 * - Supports custom options for test customization
 */

import { vi } from "vitest";
import { eq, and } from "drizzle-orm";

import type { TRPCContext } from "~/server/api/trpc.base";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import * as schema from "~/server/db/schema";

interface CreateSeededLocationTestContextOptions {
  /**
   * Override default user permissions
   * @default ["location:edit", "location:delete", "organization:manage"]
   */
  userPermissions?: string[];

  /**
   * Custom logger implementation
   */
  customLogger?: any;

  /**
   * Additional user metadata
   */
  userMetadata?: Record<string, any>;

  /**
   * Additional app metadata
   */
  appMetadata?: Record<string, any>;
}

/**
 * Creates a TRPCContext using seeded data for location router tests
 *
 * @param db - PGlite test database instance
 * @param organizationId - Organization ID (use SEED_TEST_IDS.ORGANIZATIONS.primary or .competitor)
 * @param userId - User ID (use SEED_TEST_IDS.USERS.ADMIN, .MEMBER1, or .MEMBER2)
 * @param options - Optional customization options
 * @returns Complete TRPCContext ready for location router testing
 */
export async function createSeededLocationTestContext(
  db: TestDatabase,
  organizationId: string,
  userId: string,
  options: CreateSeededLocationTestContextOptions = {},
): Promise<TRPCContext> {
  // Fetch the organization from seeded data
  const organization = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error(`Organization not found in seeded data: ${organizationId}`);
  }

  // Fetch the user from seeded data
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    throw new Error(`User not found in seeded data: ${userId}`);
  }

  // Check if membership exists, create if needed
  let membership = await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.userId, userId),
      eq(schema.memberships.organizationId, organizationId),
    ),
    with: {
      role: true,
    },
  });

  if (!membership) {
    // Find an admin role in the organization to assign
    const adminRole = await db.query.roles.findFirst({
      where: and(
        eq(schema.roles.organizationId, organizationId),
        eq(schema.roles.name, "Admin"),
      ),
    });

    if (!adminRole) {
      throw new Error(`No admin role found in organization: ${organizationId}`);
    }

    // Create the membership
    const [newMembership] = await db
      .insert(schema.memberships)
      .values({
        id: `membership-${userId}-${organizationId}`,
        userId,
        organizationId,
        roleId: adminRole.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Refetch with role information
    membership = await db.query.memberships.findFirst({
      where: eq(schema.memberships.id, newMembership.id),
      with: {
        role: true,
      },
    });
  }

  if (!membership) {
    throw new Error("Failed to create or find membership");
  }

  // Default user permissions for location operations
  const defaultPermissions = [
    "location:edit",
    "location:delete",
    "organization:manage",
  ];

  // Create mock service factories for location-related services
  const mockServices = {
    createPinballMapService: vi.fn(() => ({
      syncLocation: vi.fn().mockResolvedValue({
        success: true,
        data: { synced: true, machinesUpdated: 2 },
      }),
    })),
    createNotificationService: vi.fn(() => ({
      notifyLocationUpdate: vi.fn(),
      notifyLocationCreated: vi.fn(),
    })),
    createCollectionService: vi.fn(),
    createIssueActivityService: vi.fn(() => ({
      recordActivity: vi.fn(),
    })),
    createCommentCleanupService: vi.fn(),
    createQRCodeService: vi.fn(() => ({
      generateQRCode: vi.fn().mockResolvedValue({
        id: "mock-qr-id",
        url: "https://mock-qr-url.com",
        generatedAt: new Date(),
      }),
      updateQRCode: vi.fn(),
    })),
  };

  // Create default logger if not provided
  const defaultLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => defaultLogger),
    withRequest: vi.fn(() => defaultLogger),
    withUser: vi.fn(() => defaultLogger),
    withOrganization: vi.fn(() => defaultLogger),
    withContext: vi.fn(() => defaultLogger),
  };

  // Build the TRPCContext
  const context: TRPCContext = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      user_metadata: {
        name: user.name,
        ...options.userMetadata,
      },
      app_metadata: {
        organization_id: organizationId,
        role: membership.role.name,
        ...options.appMetadata,
      },
    },
    organization: {
      id: organization.id,
      name: organization.name,
      subdomain: organization.subdomain,
    },
    organizationId: organizationId, // Required for orgScopedProcedure
    db: db,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as any,
    services: mockServices,
    headers: new Headers(),
    logger: options.customLogger || defaultLogger,
    userPermissions: options.userPermissions || defaultPermissions,
  } as any;

  return context;
}

/**
 * Creates a context for the primary test organization with admin user
 */
export async function createPrimaryAdminContext(
  db: TestDatabase,
  options?: CreateSeededLocationTestContextOptions,
): Promise<TRPCContext> {
  return createSeededLocationTestContext(
    db,
    SEED_TEST_IDS.ORGANIZATIONS.primary,
    SEED_TEST_IDS.USERS.ADMIN,
    options,
  );
}

/**
 * Creates a context for the competitor organization with admin user
 */
export async function createCompetitorAdminContext(
  db: TestDatabase,
  options?: CreateSeededLocationTestContextOptions,
): Promise<TRPCContext> {
  return createSeededLocationTestContext(
    db,
    SEED_TEST_IDS.ORGANIZATIONS.competitor,
    SEED_TEST_IDS.USERS.ADMIN,
    options,
  );
}

/**
 * Creates a context for a member user in the primary organization
 */
export async function createPrimaryMemberContext(
  db: TestDatabase,
  memberNumber: 1 | 2 = 1,
  options?: CreateSeededLocationTestContextOptions,
): Promise<TRPCContext> {
  const userId =
    memberNumber === 1
      ? SEED_TEST_IDS.USERS.MEMBER1
      : SEED_TEST_IDS.USERS.MEMBER2;

  return createSeededLocationTestContext(
    db,
    SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId,
    options,
  );
}
