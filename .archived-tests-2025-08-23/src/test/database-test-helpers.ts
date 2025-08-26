/**
 * Database Test Helpers
 *
 * Centralized utilities for database integration testing with comprehensive
 * cleanup, factory functions, and multi-tenant data creation patterns.
 *
 * @see docs/testing/test-utilities-guide.md for usage examples
 */

import { eq, sql } from "drizzle-orm";

import type { DrizzleClient } from "~/server/db/drizzle";

import * as schema from "~/server/db/schema";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// =================================
// TYPES & INTERFACES
// =================================

/**
 * Test data identifier tracking for comprehensive cleanup
 */
export interface TestDataIds {
  /** Organization IDs to clean up */
  orgIds?: string[];
  /** User IDs to clean up */
  userIds?: string[];
  /** Issue ID to clean up */
  issueId?: string;
  /** Machine ID to clean up */
  machineId?: string;
  /** Location ID to clean up */
  locationId?: string;
  /** Model ID to clean up */
  modelId?: string;
  /** Role IDs to clean up */
  roleIds?: string[];
  /** Membership IDs to clean up */
  membershipIds?: string[];
}

/**
 * Extracted database table types from Drizzle schema
 */
type Organization = typeof schema.organizations.$inferInsert;
type User = typeof schema.users.$inferInsert;
type Machine = typeof schema.machines.$inferInsert;
type Location = typeof schema.locations.$inferInsert;
type Model = typeof schema.models.$inferInsert;
type Issue = typeof schema.issues.$inferInsert;
type Priority = typeof schema.priorities.$inferInsert;
type IssueStatus = typeof schema.issueStatuses.$inferInsert;
type Role = typeof schema.roles.$inferInsert;
type Membership = typeof schema.memberships.$inferInsert;

// =================================
// CLEANUP UTILITIES
// =================================

/**
 * Comprehensive test data cleanup utility with proper dependency order.
 *
 * Cleans up test data in reverse dependency order to prevent foreign key violations.
 * This is the most critical utility for eliminating test isolation issues.
 *
 * @param db - Drizzle client instance
 * @param testIds - Object containing arrays of IDs to clean up
 *
 * @example
 * ```typescript
 * afterEach(async () => {
 *   await cleanupTestData(db, {
 *     orgIds: [testOrg1Id, testOrg2Id],
 *     userIds: [testUser1Id, testUser2Id],
 *     issueId: testIssueId,
 *     machineId: testMachineId
 *   });
 * });
 * ```
 */
export async function cleanupTestData(
  db: DrizzleClient,
  testIds: TestDataIds,
): Promise<void> {
  // Input validation - db is required for cleanup operations

  try {
    // Clean up in reverse dependency order to avoid foreign key violations

    // Step 1: Clean up upvotes (references issues)
    if (testIds.issueId) {
      await db
        .delete(schema.upvotes)
        .where(eq(schema.upvotes.issueId, testIds.issueId));
    }

    // Step 2: Clean up issue history (references issues and organizations)
    if (testIds.orgIds?.length) {
      await db
        .delete(schema.issueHistory)
        .where(
          sql`${schema.issueHistory.organizationId} = ANY(${testIds.orgIds})`,
        );
    }

    // Step 3: Clean up attachments (references issues and organizations)
    if (testIds.orgIds?.length) {
      await db
        .delete(schema.attachments)
        .where(
          sql`${schema.attachments.organizationId} = ANY(${testIds.orgIds})`,
        );
    }

    // Step 4: Clean up comments (references issues)
    if (testIds.issueId) {
      await db
        .delete(schema.comments)
        .where(eq(schema.comments.issueId, testIds.issueId));
    }

    // Step 5: Clean up issues (references machines, organizations, etc.)
    if (testIds.orgIds?.length) {
      await db
        .delete(schema.issues)
        .where(sql`${schema.issues.organizationId} = ANY(${testIds.orgIds})`);
    }
    if (testIds.issueId) {
      await db
        .delete(schema.issues)
        .where(eq(schema.issues.id, testIds.issueId));
    }

    // Step 6: Clean up machines (references organizations, locations, models)
    if (testIds.orgIds?.length) {
      await db
        .delete(schema.machines)
        .where(sql`${schema.machines.organizationId} = ANY(${testIds.orgIds})`);
    }
    if (testIds.machineId) {
      await db
        .delete(schema.machines)
        .where(eq(schema.machines.id, testIds.machineId));
    }

    // Step 7: Clean up locations (references organizations)
    if (testIds.orgIds?.length) {
      await db
        .delete(schema.locations)
        .where(
          sql`${schema.locations.organizationId} = ANY(${testIds.orgIds})`,
        );
    }
    if (testIds.locationId) {
      await db
        .delete(schema.locations)
        .where(eq(schema.locations.id, testIds.locationId));
    }

    // Step 8: Clean up priorities (references organizations)
    if (testIds.orgIds?.length) {
      await db
        .delete(schema.priorities)
        .where(
          sql`${schema.priorities.organizationId} = ANY(${testIds.orgIds})`,
        );
    }

    // Step 9: Clean up issue statuses (references organizations)
    if (testIds.orgIds?.length) {
      await db
        .delete(schema.issueStatuses)
        .where(
          sql`${schema.issueStatuses.organizationId} = ANY(${testIds.orgIds})`,
        );
    }

    // Step 10: Clean up role permissions (references roles)
    if (testIds.roleIds?.length) {
      await db
        .delete(schema.rolePermissions)
        .where(sql`${schema.rolePermissions.roleId} = ANY(${testIds.roleIds})`);
    }

    // Step 11: Clean up memberships (references users, organizations, roles)
    if (testIds.orgIds?.length) {
      await db
        .delete(schema.memberships)
        .where(
          sql`${schema.memberships.organizationId} = ANY(${testIds.orgIds})`,
        );
    }
    if (testIds.membershipIds?.length) {
      await db
        .delete(schema.memberships)
        .where(sql`${schema.memberships.id} = ANY(${testIds.membershipIds})`);
    }

    // Step 12: Clean up roles (references organizations)
    if (testIds.orgIds?.length) {
      await db
        .delete(schema.roles)
        .where(sql`${schema.roles.organizationId} = ANY(${testIds.orgIds})`);
    }
    if (testIds.roleIds?.length) {
      await db
        .delete(schema.roles)
        .where(sql`${schema.roles.id} = ANY(${testIds.roleIds})`);
    }

    // Step 13: Clean up organizations (minimal dependencies)
    if (testIds.orgIds?.length) {
      await db
        .delete(schema.organizations)
        .where(sql`${schema.organizations.id} = ANY(${testIds.orgIds})`);
    }

    // Step 14: Clean up users (global entities)
    if (testIds.userIds?.length) {
      await db
        .delete(schema.users)
        .where(sql`${schema.users.id} = ANY(${testIds.userIds})`);
    }

    // Step 15: Clean up models (global entities, independent of organizations)
    if (testIds.modelId) {
      await db
        .delete(schema.models)
        .where(eq(schema.models.id, testIds.modelId));
    }
  } catch (error) {
    // Cleanup errors are not critical for test results but should be logged
    console.warn("Database cleanup error (non-fatal):", error);
  }
}

// =================================
// TEST DATA FACTORIES
// =================================

/**
 * Get a seeded test organization (prefer using SEED_TEST_IDS directly)
 *
 * @param db - Drizzle client instance
 * @param orgType - Which seeded organization to use
 * @returns Promise<Organization> - Seeded organization record
 *
 * @example
 * ```typescript
 * const testOrg = await createTestOrganization(db, "primary");
 * // Or better, use directly:
 * // const orgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
 * ```
 */
export async function createTestOrganization(
  db: DrizzleClient,
  orgType: "primary" | "competitor" = "primary",
): Promise<Organization> {
  const orgId =
    orgType === "primary"
      ? SEED_TEST_IDS.ORGANIZATIONS.primary
      : SEED_TEST_IDS.ORGANIZATIONS.competitor;

  const organization = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, orgId),
  });

  if (!organization) {
    throw new Error(
      `Seeded organization ${orgType} not found. Ensure seed data is loaded.`,
    );
  }

  return organization;
}

/**
 * Creates a test user with realistic data and unique identifiers.
 *
 * @param db - Drizzle client instance
 * @param overrides - Optional partial user data to override defaults
 * @returns Promise<User> - Created user record
 *
 * @example
 * ```typescript
 * const testUser = await createTestUser(db, {
 *   email: "admin@testorg.com",
 *   name: "Test Admin"
 * });
 * ```
 */
export async function createTestUser(
  db: DrizzleClient,
  overrides: Partial<User> = {},
): Promise<User> {
  const timestamp = Date.now();
  const uniqueId = `test-user-${timestamp.toString()}`;

  const userData: User = {
    id: uniqueId,
    name: "Test User",
    email: `test-${timestamp.toString()}@example.com`,
    emailVerified: null,
    image: null,
    bio: null,
    notificationFrequency: "IMMEDIATE",
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const [user] = await db.insert(schema.users).values(userData).returning();

  // User should be created successfully
  return user;
}

/**
 * Creates a test user with membership and role in an organization.
 *
 * This is a comprehensive factory that creates the complete user-organization
 * relationship with proper role and permission setup.
 *
 * @param db - Drizzle client instance
 * @param organizationId - ID of the organization for membership
 * @param roleType - Type of role to create ('admin', 'manager', or 'member')
 * @param overrides - Optional partial user data to override defaults
 * @returns Promise with user, membership, and role records
 *
 * @example
 * ```typescript
 * const { user, membership, role } = await createTestUserWithMembership(
 *   db,
 *   testOrgId,
 *   'admin',
 *   { name: "Test Admin User" }
 * );
 * ```
 */
export async function createTestUserWithMembership(
  db: DrizzleClient,
  organizationId: string,
  roleType: "admin" | "manager" | "member" = "member",
  overrides: Partial<User> = {},
): Promise<{ user: User; membership: Membership; role: Role }> {
  const timestamp = Date.now();

  // Create user first
  const user = await createTestUser(db, overrides);

  // Create appropriate role
  const roleData: Role = {
    id: `test-role-${timestamp.toString()}`,
    name: roleType.charAt(0).toUpperCase() + roleType.slice(1),
    organizationId,
    isDefault: roleType === "member",
    isSystem: roleType === "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [role] = await db.insert(schema.roles).values(roleData).returning();

  // Role should be created successfully

  // Create membership linking user to organization with role
  const membershipData: Membership = {
    id: `test-membership-${timestamp.toString()}`,
    userId: user.id,
    organizationId,
    roleId: role.id,
  };

  const [membership] = await db
    .insert(schema.memberships)
    .values(membershipData)
    .returning();

  // Membership should be created successfully

  return { user, membership, role };
}

/**
 * Creates a test machine with all required dependencies (location, model).
 *
 * This factory creates a complete machine setup including location and model
 * dependencies, with proper organizational scoping.
 *
 * @param db - Drizzle client instance
 * @param organizationId - ID of the organization that owns the machine
 * @param overrides - Optional partial machine data to override defaults
 * @returns Promise with machine, location, and model records
 *
 * @example
 * ```typescript
 * const { machine, location, model } = await createTestMachine(
 *   db,
 *   testOrgId,
 *   { name: "Medieval Madness" }
 * );
 * ```
 */
export async function createTestMachine(
  db: DrizzleClient,
  organizationId: string,
  overrides: Partial<Machine> = {},
): Promise<{ machine: Machine; location: Location; model: Model }> {
  const timestamp = Date.now();

  // Create location first (dependency)
  const locationData: Location = {
    id: `test-location-${timestamp.toString()}`,
    name: "Test Location",
    address: null,
    city: null,
    state: null,
    zipCode: null,
    country: null,
    latitude: null,
    longitude: null,
    organizationId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [location] = await db
    .insert(schema.locations)
    .values(locationData)
    .returning();

  // Location should be created successfully

  // Create model (global entity)
  const modelData: Model = {
    id: `test-model-${timestamp.toString()}`,
    name: "Test Pinball Model",
    manufacturer: "Test Manufacturer",
    year: 2024,
    isCustom: false,
    opdbId: null,
  };

  const [model] = await db.insert(schema.models).values(modelData).returning();

  // Model should be created successfully

  // Create machine with dependencies
  const machineData: Machine = {
    id: `test-machine-${timestamp.toString()}`,
    name: "Test Machine",
    organizationId,
    locationId: location.id,
    modelId: model.id,
    qrCodeId: `test-qr-${timestamp.toString()}`,
    ownerId: null,
    isActive: true,
    serialNumber: null,
    assetTag: null,
    acquisitionDate: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const [machine] = await db
    .insert(schema.machines)
    .values(machineData)
    .returning();

  // Machine should be created successfully

  return { machine, location, model };
}

/**
 * Creates a test issue with all required dependencies (priority, status).
 *
 * This factory creates a complete issue with proper organizational context
 * and all required status/priority dependencies.
 *
 * @param db - Drizzle client instance
 * @param machineId - ID of the machine this issue belongs to
 * @param organizationId - ID of the organization that owns the issue
 * @param overrides - Optional partial issue data to override defaults
 * @returns Promise with issue, priority, and status records
 *
 * @example
 * ```typescript
 * const { issue, priority, status } = await createTestIssue(
 *   db,
 *   testMachineId,
 *   testOrgId,
 *   { title: "Flipper sticking", severity: "HIGH" }
 * );
 * ```
 */
export async function createTestIssue(
  db: DrizzleClient,
  machineId: string,
  organizationId: string,
  overrides: Partial<Issue> = {},
): Promise<{ issue: Issue; priority: Priority; status: IssueStatus }> {
  const timestamp = Date.now();

  // Create priority (dependency)
  const priorityData: Priority = {
    id: `test-priority-${timestamp.toString()}`,
    name: "High",
    order: 1,
    organizationId,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [priority] = await db
    .insert(schema.priorities)
    .values(priorityData)
    .returning();

  // Priority should be created successfully

  // Create status (dependency)
  const statusData: IssueStatus = {
    id: `test-status-${timestamp.toString()}`,
    name: "Open",
    category: "NEW",
    organizationId,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const [status] = await db
    .insert(schema.issueStatuses)
    .values(statusData)
    .returning();

  // Status should be created successfully

  // Create issue with dependencies
  const issueData: Issue = {
    id: `test-issue-${timestamp.toString()}`,
    title: "Test Issue",
    description: "This is a test issue for database testing",
    organizationId,
    machineId,
    statusId: status.id,
    priorityId: priority.id,
    createdById: null,
    assignedToId: null,
    reporterEmail: null,
    resolvedAt: null,
    checklist: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const [issue] = await db.insert(schema.issues).values(issueData).returning();

  // Issue should be created successfully

  return { issue, priority, status };
}

// =================================
// QUERY HELPERS
// =================================

/**
 * Verifies that data is properly isolated by organization.
 *
 * This helper function validates that query results only contain records
 * belonging to the expected organization, ensuring multi-tenant isolation.
 *
 * @param results - Array of records to validate
 * @param expectedOrgId - Organization ID that all records should belong to
 * @param fieldName - Name of the organization ID field (default: 'organizationId')
 * @throws Error if any record belongs to a different organization
 *
 * @example
 * ```typescript
 * const issues = await db.select().from(schema.issues).where(...);
 * verifyOrganizationIsolation(issues, testOrgId);
 * ```
 */
export function verifyOrganizationIsolation<T extends Record<string, unknown>>(
  results: T[],
  expectedOrgId: string,
  fieldName: keyof T = "organizationId" as keyof T,
): void {
  const violatingRecords = results.filter(
    (record) => record[fieldName] !== expectedOrgId,
  );

  if (violatingRecords.length > 0) {
    throw new Error(
      `Organization isolation violation: Found ${violatingRecords.length.toString()} records belonging to other organizations. Expected organizationId: ${expectedOrgId}`,
    );
  }
}

/**
 * Creates a standardized test environment with multiple organizations and users.
 *
 * This utility creates a complete multi-tenant test scenario with two organizations,
 * each having users with different roles. Useful for testing cross-tenant isolation.
 *
 * @param db - Drizzle client instance
 * @returns Promise with complete test environment data
 *
 * @example
 * ```typescript
 * const testEnv = await createMultiTenantTestEnvironment(db);
 * // testEnv.org1, testEnv.org2, testEnv.users, etc.
 * ```
 */
export async function createMultiTenantTestEnvironment(
  db: DrizzleClient,
): Promise<{
  org1: Organization;
  org2: Organization;
  users: {
    org1Admin: { user: User; membership: Membership; role: Role };
    org1Member: { user: User; membership: Membership; role: Role };
    org2Admin: { user: User; membership: Membership; role: Role };
    org2Member: { user: User; membership: Membership; role: Role };
  };
}> {
  const timestamp = Date.now();

  // Get two seeded organizations
  const org1 = await createTestOrganization(db, "primary");

  const org2 = await createTestOrganization(db, "competitor");

  // Create users with memberships for each org
  const org1Admin = await createTestUserWithMembership(db, org1.id, "admin", {
    name: "Org 1 Admin",
    email: `org1-admin-${timestamp.toString()}@example.com`,
  });

  const org1Member = await createTestUserWithMembership(db, org1.id, "member", {
    name: "Org 1 Member",
    email: `org1-member-${timestamp.toString()}@example.com`,
  });

  const org2Admin = await createTestUserWithMembership(db, org2.id, "admin", {
    name: "Org 2 Admin",
    email: `org2-admin-${timestamp.toString()}@example.com`,
  });

  const org2Member = await createTestUserWithMembership(db, org2.id, "member", {
    name: "Org 2 Member",
    email: `org2-member-${timestamp.toString()}@example.com`,
  });

  return {
    org1,
    org2,
    users: {
      org1Admin,
      org1Member,
      org2Admin,
      org2Member,
    },
  };
}
