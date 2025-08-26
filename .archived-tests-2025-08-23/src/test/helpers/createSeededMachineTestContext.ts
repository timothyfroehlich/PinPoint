/**
 * Seeded Machine Test Context Helper
 *
 * Creates a ready-to-use TRPCContext for machine router tests using seeded data.
 * Replaces manual test data creation with consistent seeded entities.
 *
 * Features:
 * - Uses SEED_TEST_IDS for predictable organization and user data
 * - Automatically ensures membership exists for the user
 * - Mocks external services (Notification, QRCode, PinballMap)
 * - Returns fully configured context for machine routers
 * - Supports custom options for test customization
 */

import { vi } from "vitest";
import { eq } from "drizzle-orm";

import type { TRPCContext } from "~/server/api/trpc.base";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import * as schema from "~/server/db/schema";

interface CreateSeededMachineTestContextOptions {
  /**
   * Override default user permissions
   * @default ["machine:edit", "machine:delete", "organization:manage"]
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
 * Creates a TRPCContext using seeded data for machine router tests
 *
 * @param db - PGlite test database instance
 * @param organizationId - Organization ID (use SEED_TEST_IDS.ORGANIZATIONS.primary or .competitor)
 * @param userId - User ID (use SEED_TEST_IDS.USERS.ADMIN, .MEMBER1, or .MEMBER2)
 * @param options - Optional customization options
 * @returns Complete TRPCContext ready for machine router testing
 */
export async function createSeededMachineTestContext(
  db: TestDatabase,
  organizationId: string,
  userId: string,
  options: CreateSeededMachineTestContextOptions = {},
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

  // Check membership exists in seeded data and fail fast if missing
  const membership = await db.query.memberships.findFirst({
    where:
      eq(schema.memberships.userId, userId) &&
      eq(schema.memberships.organizationId, organizationId),
    with: {
      role: true,
    },
  });

  if (!membership) {
    throw new Error(
      `Membership not found in seeded data for user ${userId} in organization ${organizationId}. Ensure your test database includes proper seeded memberships.`,
    );
  }

  // Default user permissions for machine operations
  const defaultPermissions = [
    "machine:edit",
    "machine:delete",
    "organization:manage",
  ];

  // Create mock service factories for Drizzle-only services
  const mockServices = {
    createPinballMapService: vi.fn(),
    createNotificationService: vi.fn(() => ({
      notifyMachineOwnerOfIssue: vi.fn(),
      notifyMachineOwnerOfStatusChange: vi.fn(),
      notifyMachineOwnerOfComment: vi.fn(),
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
  options?: CreateSeededMachineTestContextOptions,
): Promise<TRPCContext> {
  return createSeededMachineTestContext(
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
  options?: CreateSeededMachineTestContextOptions,
): Promise<TRPCContext> {
  return createSeededMachineTestContext(
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
  options?: CreateSeededMachineTestContextOptions,
): Promise<TRPCContext> {
  const userId =
    memberNumber === 1
      ? SEED_TEST_IDS.USERS.MEMBER1
      : SEED_TEST_IDS.USERS.MEMBER2;

  return createSeededMachineTestContext(
    db,
    SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId,
    options,
  );
}
