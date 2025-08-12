/**
 * Integration Test Seed Functions
 * 
 * Adapted from scripts/seed/ for PGlite integration testing.
 * Provides minimal but realistic test data without auth dependencies.
 * 
 * Key Features:
 * - Works with any Drizzle database instance (PGlite, PostgreSQL)
 * - No Supabase Auth dependencies (PostgreSQL-only)
 * - Minimal data set for fast test execution
 * - Deterministic IDs for predictable testing
 * - Reuses proven seed logic patterns
 */

import { eq, and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { drizzle } from "drizzle-orm/pglite";

import * as schema from "~/server/db/schema";
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  SYSTEM_ROLES,
  ROLE_TEMPLATES,
  UNAUTHENTICATED_PERMISSIONS,
} from "~/server/auth/permissions.constants";

type TestDatabase = ReturnType<typeof drizzle>;

/**
 * Standard test data IDs - deterministic and consistent across tests
 */
export const TEST_IDS = {
  organization: "test-org-1",
  location: "test-location-1", 
  model: "test-model-1",
  machine: "test-machine-1",
  priority: "test-priority-1",
  status: "test-status-1",
  issue: "test-issue-1",
  admin_role: "test-admin-role",
  member_role: "test-member-role",
} as const;

export interface TestOrganization {
  id: string;
  name: string;
  subdomain: string;
}

/**
 * Create global permissions (adapted from scripts/seed/shared/infrastructure.ts)
 */
async function createGlobalPermissions(db: TestDatabase): Promise<void> {
  // Get existing permissions
  const existingPermissions = await db
    .select({ name: schema.permissions.name })
    .from(schema.permissions);

  const existingSet = new Set(existingPermissions.map((p) => p.name));

  // Find permissions that need to be created
  const permissionsToCreate = ALL_PERMISSIONS.filter(
    (permName) => !existingSet.has(permName),
  ).map((permName) => ({
    id: nanoid(),
    name: permName,
    description: PERMISSION_DESCRIPTIONS[permName] ?? `Permission: ${permName}`,
  }));

  // Batch create all missing permissions
  if (permissionsToCreate.length > 0) {
    await db.insert(schema.permissions).values(permissionsToCreate);
  }
}

/**
 * Create system roles (adapted from scripts/seed/shared/infrastructure.ts)
 */
async function createSystemRoles(db: TestDatabase): Promise<void> {
  // Create Admin role
  const adminRoleId = TEST_IDS.admin_role;
  await db.insert(schema.roles).values({
    id: adminRoleId,
    name: SYSTEM_ROLES.ADMIN,
    organizationId: TEST_IDS.organization,
    isSystem: true,
    isDefault: false,
  }).onConflictDoNothing();

  // Create Unauthenticated role  
  const unauthRoleId = TEST_IDS.member_role; // Reusing member_role ID for Unauthenticated
  await db.insert(schema.roles).values({
    id: unauthRoleId,
    name: SYSTEM_ROLES.UNAUTHENTICATED,
    organizationId: TEST_IDS.organization,
    isSystem: true,
    isDefault: false,
  }).onConflictDoNothing();

  // Assign ALL permissions to Admin role
  const allPermissions = await db
    .select({ id: schema.permissions.id })
    .from(schema.permissions);

  if (allPermissions.length > 0) {
    const adminRolePermissions = allPermissions.map((permission) => ({
      id: nanoid(),
      roleId: adminRoleId,
      permissionId: permission.id,
    }));
    await db.insert(schema.rolePermissions).values(adminRolePermissions).onConflictDoNothing();
  }

  // Assign limited permissions to Unauthenticated role
  const unauthPermissions = await db
    .select({ id: schema.permissions.id })
    .from(schema.permissions)
    .where(inArray(schema.permissions.name, UNAUTHENTICATED_PERMISSIONS));

  if (unauthPermissions.length > 0) {
    const unauthRolePermissions = unauthPermissions.map((permission) => ({
      id: nanoid(), 
      roleId: unauthRoleId,
      permissionId: permission.id,
    }));
    await db.insert(schema.rolePermissions).values(unauthRolePermissions).onConflictDoNothing();
  }
}

/**
 * Create priorities and issue statuses (adapted from scripts/seed/shared/infrastructure.ts)
 */
async function createPrioritiesAndStatuses(db: TestDatabase): Promise<void> {
  // Create priorities
  const prioritiesData = [
    { id: TEST_IDS.priority, name: "Medium", order: 2, organizationId: TEST_IDS.organization },
  ];

  await db.insert(schema.priorities).values(prioritiesData).onConflictDoNothing();

  // Create issue statuses
  const statusesData = [
    { 
      id: TEST_IDS.status, 
      name: "Open", 
      category: "NEW" as const,
      organizationId: TEST_IDS.organization 
    },
  ];

  await db.insert(schema.issueStatuses).values(statusesData).onConflictDoNothing();
}

/**
 * Create minimal sample data (adapted from scripts/seed/shared/sample-data.ts)
 */
async function createSampleData(db: TestDatabase, organizationId: string): Promise<void> {
  // Create a test location
  const locationData = {
    id: TEST_IDS.location,
    name: "Test Arcade",
    address: "123 Test St",
    organizationId,
  };

  await db.insert(schema.locations).values(locationData).onConflictDoNothing();

  // Create a test model
  const modelData = {
    id: TEST_IDS.model,
    name: "Medieval Madness",
    manufacturer: "Williams",
    year: 1997,
    organizationId,
  };

  await db.insert(schema.models).values(modelData).onConflictDoNothing();

  // Create a test machine
  const machineData = {
    id: TEST_IDS.machine,
    name: "Test Machine #1",
    modelId: TEST_IDS.model,
    locationId: TEST_IDS.location,
    organizationId,
    qrCodeId: "test-qr-code-1",
  };

  await db.insert(schema.machines).values(machineData).onConflictDoNothing();

  // Create a test issue
  const issueData = {
    id: TEST_IDS.issue,
    title: "Left flipper sticking",
    description: "The left flipper occasionally sticks in the up position",
    machineId: TEST_IDS.machine,
    priorityId: TEST_IDS.priority,
    statusId: TEST_IDS.status,
    organizationId,
  };

  await db.insert(schema.issues).values(issueData).onConflictDoNothing();
}

/**
 * Seed infrastructure for testing (organizations, permissions, roles, priorities, statuses)
 * Adapted from scripts/seed/shared/infrastructure.ts
 */
export async function seedTestInfrastructure(db: TestDatabase): Promise<TestOrganization> {
  // Create test organization
  const organizationData = {
    id: TEST_IDS.organization,
    name: "Test Organization", 
    subdomain: "test-org",
  };

  await db.insert(schema.organizations).values(organizationData).onConflictDoNothing();

  // Create permissions, roles, priorities, and statuses
  await createGlobalPermissions(db);
  await createSystemRoles(db);
  await createPrioritiesAndStatuses(db);

  return organizationData;
}

/**
 * Seed minimal sample data for testing
 * Adapted from scripts/seed/shared/sample-data.ts but without auth dependencies
 */
export async function seedTestSampleData(
  db: TestDatabase, 
  organizationId: string
): Promise<void> {
  await createSampleData(db, organizationId);
}

/**
 * Complete test data setup - combines infrastructure and sample data
 * This is the main entry point for test setup
 */
export async function seedCompleteTestData(db: TestDatabase): Promise<TestOrganization> {
  const organization = await seedTestInfrastructure(db);
  await seedTestSampleData(db, organization.id);
  return organization;
}