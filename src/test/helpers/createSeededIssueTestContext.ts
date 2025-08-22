/**
 * Shared Seeded TRPC Context Helper
 *
 * Creates standardized TRPC context for issue-related integration tests.
 * Uses seeded test data to ensure consistent relationships and reduce
 * duplicated context construction logic across tests.
 *
 * Key Features:
 * - Uses seeded test data with static SEED_TEST_IDS constants
 * - Standardized service mocks
 * - Proper organizational scoping
 * - Real membership relationships
 * - Consistent user permissions
 */

import { eq, and } from "drizzle-orm";
import { vi } from "vitest";
import { type TestDatabase } from "~/test/helpers/pglite-test-setup";
import { memberships } from "~/server/db/schema";
import { ServiceFactory } from "~/server/services/factory";

export interface SeededIssueTestContext {
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
    createIssueActivityService: any;
    createNotificationService: any;
    createCommentCleanupService?: any;
  };
  headers: Headers;
  userPermissions: string[];
}

/**
 * Creates standardized TRPC context for issue-related tests using seeded data
 *
 * @param txDb - Transaction database instance
 * @param organizationId - Organization ID (typically from SEED_TEST_IDS.ORGANIZATIONS)
 * @param userId - User ID (typically from seeded test data)
 * @returns Standardized test context for TRPC procedures
 */
export async function createSeededIssueTestContext(
  txDb: TestDatabase,
  organizationId: string,
  userId: string,
): Promise<SeededIssueTestContext> {
  // Query real membership from database for integration tests
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

  // Create real service instances for integration tests
  const serviceFactory = new ServiceFactory(txDb);
  const services = {
    createIssueActivityService: () =>
      serviceFactory.createIssueActivityService(),
    createNotificationService: () => serviceFactory.createNotificationService(),
    createCommentCleanupService: () =>
      serviceFactory.createCommentCleanupService(),
  };

  return {
    db: txDb,
    user: {
      id: userId,
      email: "test@example.com",
      user_metadata: { name: "Test User" },
      app_metadata: { organization_id: organizationId },
    },
    organizationId, // Add the missing organizationId property for TRPC context
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
    userPermissions: [
      "issue:view",
      "issue:create",
      "issue:edit",
      "issue:delete",
      "comment:create",
      "comment:edit",
      "comment:delete",
      "timeline:view",
      "admin:view",
      "organization:manage",
    ],
  };
}
