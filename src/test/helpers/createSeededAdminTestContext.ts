/**
 * Shared Seeded TRPC Context Helper for Admin Tests
 *
 * Creates standardized TRPC context for admin-related integration tests.
 * Uses seeded test data to ensure consistent relationships and reduce
 * duplicated context construction logic across admin, role, and router tests.
 *
 * Key Features:
 * - Uses seeded test data with static SEED_TEST_IDS constants
 * - Standardized service mocks for admin operations
 * - Proper organizational scoping
 * - Real membership relationships with admin permissions
 * - Consistent user permissions for admin operations
 * - Handles both admin router (direct DB) and role router (RoleService) patterns
 */

import { eq, and } from "drizzle-orm";
import { vi } from "vitest";

import { type TestDatabase } from "~/test/helpers/pglite-test-setup";
import { memberships } from "~/server/db/schema";

export interface SeededAdminTestContext {
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
    createNotificationService: any;
    createCollectionService: any;
    createIssueActivityService: any;
  };
  headers: Headers;
  userPermissions: string[];
  supabase: any; // Mocked Supabase client
  logger: any; // Complete logger mock
}

export interface AdminContextOptions {
  permissions?: string[];
  userName?: string;
  userEmail?: string;
}

/**
 * Creates standardized TRPC context for admin-related tests using seeded data
 *
 * @param txDb - Transaction database instance
 * @param organizationId - Organization ID (typically from seeded data)
 * @param userId - User ID (typically from seeded test users)
 * @param options - Optional overrides for permissions, name, email
 * @returns Standardized test context for admin/role TRPC procedures
 */
export async function createSeededAdminTestContext(
  txDb: TestDatabase,
  organizationId: string,
  userId: string,
  options: AdminContextOptions = {},
): Promise<SeededAdminTestContext> {
  // Query membership and expect it to exist in seeded data with permissions
  const membership = await txDb.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, organizationId),
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

  if (!membership) {
    throw new Error(
      `Membership not found in seeded data for user ${userId} in organization ${organizationId}. Ensure your test database includes proper seeded memberships with admin roles.`,
    );
  }

  // Set up minimal service mocks for admin operations
  const services = {
    createNotificationService: vi.fn(() => ({
      notifyUserInvited: vi.fn(),
      notifyUserRoleChanged: vi.fn(),
      notifyUserRemoved: vi.fn(),
      notifyMachineOwnerOfIssue: vi.fn(),
      notifyMachineOwnerOfStatusChange: vi.fn(),
    })),
    createCollectionService: vi.fn(() => ({
      getCollection: vi.fn(),
      updateCollection: vi.fn(),
      deleteCollection: vi.fn(),
    })),
    createIssueActivityService: vi.fn(() => ({
      recordUserInvited: vi.fn(),
      recordUserRoleChanged: vi.fn(),
      recordUserRemoved: vi.fn(),
      getIssueTimeline: vi.fn(),
    })),
  };

  // Create complete logger mock with all required methods
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => logger), // Return self for chaining
    withRequest: vi.fn(() => logger),
    withUser: vi.fn(() => logger),
    withOrganization: vi.fn(() => logger),
    withContext: vi.fn(() => logger),
  };

  // Create mocked Supabase client
  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
  };

  // Default admin permissions
  const defaultPermissions = [
    "user:manage",
    "role:manage",
    "organization:manage",
    "admin:view",
    "issue:view",
    "issue:create",
    "issue:edit",
    "issue:delete",
    "machine:view",
    "machine:create",
    "machine:edit",
    "location:view",
    "location:create",
    "location:edit",
  ];

  const userPermissions = options.permissions ?? defaultPermissions;
  const userName = options.userName ?? "Test Admin User";
  const userEmail = options.userEmail ?? "admin@test.com";

  return {
    db: txDb,
    user: {
      id: userId,
      email: userEmail,
      user_metadata: { name: userName },
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
        email: userEmail,
        name: userName,
        image: null,
      },
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    },
    services,
    headers: new Headers(),
    userPermissions,
    supabase,
    logger,
  };
}
