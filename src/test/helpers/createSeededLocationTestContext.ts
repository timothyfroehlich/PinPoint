/**
 * Shared Seeded TRPC Context Helper for Location Tests
 *
 * Creates standardized TRPC context for location-related integration tests.
 * Uses seeded test data to ensure consistent relationships and reduce
 * duplicated context construction logic across tests.
 *
 * Key Features:
 * - Uses seeded test data from getSeededTestData()
 * - Standardized service mocks (including PinballMapService)
 * - Proper organizational scoping
 * - Real membership relationships
 * - Consistent user permissions for location operations
 */

import { eq, and } from "drizzle-orm";
import { vi } from "vitest";
import { type TestDatabase } from "~/test/helpers/pglite-test-setup";
import { memberships } from "~/server/db/schema";

export interface SeededLocationTestContext {
  db: TestDatabase;
  user: {
    id: string;
    email: string;
    user_metadata: { name: string };
    app_metadata: { organization_id: string };
  };
  organization: {
    id: string;
    name: string;
    subdomain: string;
  };
  membership?: any; // Real membership from database
  session: {
    user: {
      id: string;
      email: string;
      name: string;
      image: null;
    };
    expires: string;
  };
  services: {
    createPinballMapService: any;
    createNotificationService: any;
    createCollectionService?: any;
    createIssueActivityService?: any;
    createCommentCleanupService?: any;
    createQRCodeService?: any;
  };
  headers: Headers;
  userPermissions: string[];
  logger: {
    info: any;
    error: any;
    warn: any;
    debug: any;
    trace: any;
    child: any;
    withRequest: any;
    withUser: any;
    withOrganization: any;
    withContext: any;
  };
  supabase: any; // Mocked Supabase client
}

/**
 * Creates standardized TRPC context for location-related tests using seeded data
 *
 * @param txDb - Transaction database instance
 * @param organizationId - Organization ID (typically from SEED_TEST_IDS.ORGANIZATIONS)
 * @param userId - User ID (typically from seeded test data)
 * @param options - Optional permission overrides and context customization
 * @returns Standardized test context for TRPC procedures
 */
export async function createSeededLocationTestContext(
  txDb: TestDatabase,
  organizationId: string,
  userId: string,
  options?: {
    permissions?: string[];
    skipMembershipValidation?: boolean;
  },
): Promise<SeededLocationTestContext> {
  // Validate that required seeded data exists
  if (!organizationId || !userId) {
    throw new Error(
      "Organization ID and User ID are required for context creation",
    );
  }

  // Query or create membership record for the user in the organization
  let membership = await txDb.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, organizationId),
    ),
    with: {
      role: {
        with: {
          permissions: true,
        },
      },
    },
  });

  // If membership doesn't exist and not skipping validation, create one within transaction
  if (!membership && !options?.skipMembershipValidation) {
    // Get or create a default role for the organization
    const defaultRole = await txDb.query.roles.findFirst({
      where: eq(roles.organizationId, organizationId),
      with: {
        permissions: true,
      },
    });

    if (defaultRole) {
      // Create membership within transaction
      const [newMembership] = await txDb
        .insert(memberships)
        .values({
          id: `test-membership-${userId}-${organizationId}`,
          userId,
          organizationId,
          roleId: defaultRole.id,
        })
        .returning();

      // Re-query with relationships
      membership = await txDb.query.memberships.findFirst({
        where: eq(memberships.id, newMembership.id),
        with: {
          role: {
            with: {
              permissions: true,
            },
          },
        },
      });
    }
  }

  // Create standardized service mocks for location operations
  const services = {
    createPinballMapService: vi.fn(() => ({
      syncLocation: vi.fn().mockResolvedValue({
        success: true,
        data: {
          synced: true,
          machinesUpdated: 2,
        },
      }),
      syncMachine: vi.fn().mockResolvedValue({
        success: true,
        data: {
          synced: true,
        },
      }),
      getLocationData: vi.fn().mockResolvedValue({
        id: "test-pinballmap-location",
        name: "Test Arcade",
        machines: [],
      }),
    })),
    createNotificationService: vi.fn(() => ({
      notifyLocationUpdate: vi.fn(),
      notifyMachineAdded: vi.fn(),
      notifyMachineRemoved: vi.fn(),
    })),
    createCollectionService: vi.fn(() => ({
      getCollectionsForLocation: vi.fn(),
      updateCollectionLocations: vi.fn(),
    })),
    createIssueActivityService: vi.fn(() => ({
      recordLocationUpdate: vi.fn(),
      getLocationHistory: vi.fn(),
    })),
    createCommentCleanupService: vi.fn(() => ({
      getCleanupStats: vi.fn(),
      performCleanup: vi.fn(),
    })),
    createQRCodeService: vi.fn(() => ({
      generateLocationQRCode: vi.fn(),
      generateMachineQRCode: vi.fn(),
    })),
  };

  // Create comprehensive logger mock
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => logger),
    withRequest: vi.fn(() => logger),
    withUser: vi.fn(() => logger),
    withOrganization: vi.fn(() => logger),
    withContext: vi.fn(() => logger),
  };

  // Create mocked Supabase client
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: "test@example.com",
            user_metadata: { name: "Test User" },
            app_metadata: { organization_id: organizationId },
          },
        },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };

  // Set default permissions for location operations
  const defaultPermissions = [
    "location:view",
    "location:create",
    "location:edit",
    "location:delete",
    "machine:view",
    "machine:create",
    "machine:edit",
    "machine:delete",
    "organization:manage",
    "issue:view",
    "issue:create",
  ];

  return {
    db: txDb,
    user: {
      id: userId,
      email: "test@example.com",
      user_metadata: { name: "Test User" },
      app_metadata: { organization_id: organizationId },
    },
    organization: {
      id: organizationId,
      name: "Test Organization",
      subdomain: "test-org",
    },
    membership,
    session: {
      user: {
        id: userId,
        email: "test@example.com",
        name: "Test User",
        image: null,
      },
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    },
    services,
    headers: new Headers(),
    userPermissions: options?.permissions || defaultPermissions,
    logger,
    supabase,
  };
}
