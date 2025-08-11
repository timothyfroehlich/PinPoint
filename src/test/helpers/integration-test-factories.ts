/**
 * Integration Test Data Factories
 *
 * Provides standardized test data creation functions for integration tests.
 * Uses deterministic IDs and consistent data structures across all tests.
 */

import type { drizzle } from "drizzle-orm/pglite";

import * as schema from "~/server/db/schema";

/**
 * Standard test data IDs - deterministic and consistent across tests
 */
export const TEST_IDS = {
  organization: "test-org-1",
  user: "test-user-1",
  location: "test-location-1",
  machine: "test-machine-1",
  model: "test-model-1",
  priority: "test-priority-1",
  status: "test-status-1",
  issue: "test-issue-1",
} as const;

/**
 * Create a standard test organization
 */
export async function createTestOrganization(
  db: ReturnType<typeof drizzle>,
  overrides: Partial<{
    id: string;
    name: string;
    subdomain: string;
    logoUrl?: string;
  }> = {},
): Promise<typeof schema.organizations.$inferSelect> {
  const orgData = {
    id: TEST_IDS.organization,
    name: "Test Organization",
    subdomain: "test-org",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const [organization] = await db
    .insert(schema.organizations)
    .values(orgData)
    .returning();

  return organization;
}

/**
 * Create a standard test user
 */
export async function createTestUser(
  db: ReturnType<typeof drizzle>,
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
    profilePicture?: string;
  }> = {},
): Promise<typeof schema.users.$inferSelect> {
  const userData = {
    id: TEST_IDS.user,
    email: "test@example.com",
    name: "Test User",
    profilePicture: "https://example.com/avatar.jpg",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const [user] = await db.insert(schema.users).values(userData).returning();

  return user;
}

/**
 * Create a standard test pinball model
 */
export async function createTestModel(
  db: ReturnType<typeof drizzle>,
  overrides: Partial<{
    id: string;
    name: string;
    manufacturer?: string;
    year?: number;
  }> = {},
): Promise<typeof schema.models.$inferSelect> {
  const modelData = {
    id: TEST_IDS.model,
    name: "Medieval Madness",
    manufacturer: "Williams",
    year: 1997,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const [model] = await db.insert(schema.models).values(modelData).returning();

  return model;
}

/**
 * Create a standard test location
 */
export async function createTestLocation(
  db: ReturnType<typeof drizzle>,
  organizationId: string = TEST_IDS.organization,
  overrides: Partial<{
    id: string;
    name: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  }> = {},
): Promise<typeof schema.locations.$inferSelect> {
  const locationData = {
    id: TEST_IDS.location,
    name: "Test Arcade",
    organizationId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const [location] = await db
    .insert(schema.locations)
    .values(locationData)
    .returning();

  return location;
}

/**
 * Create a standard test priority for issues
 */
export async function createTestPriority(
  db: ReturnType<typeof drizzle>,
  organizationId: string = TEST_IDS.organization,
  overrides: Partial<{
    id: string;
    name: string;
    order: number;
    isDefault?: boolean;
  }> = {},
): Promise<typeof schema.priorities.$inferSelect> {
  const priorityData = {
    id: TEST_IDS.priority,
    name: "High",
    organizationId,
    order: 1,
    isDefault: false,
    ...overrides,
  };

  const [priority] = await db
    .insert(schema.priorities)
    .values(priorityData)
    .returning();

  return priority;
}

/**
 * Create a standard test issue status
 */
export async function createTestIssueStatus(
  db: ReturnType<typeof drizzle>,
  organizationId: string = TEST_IDS.organization,
  overrides: Partial<{
    id: string;
    name: string;
    category: "NEW" | "IN_PROGRESS" | "RESOLVED";
    isDefault?: boolean;
  }> = {},
): Promise<typeof schema.issueStatuses.$inferSelect> {
  const statusData = {
    id: TEST_IDS.status,
    name: "Open",
    category: "NEW" as const,
    organizationId,
    isDefault: false,
    ...overrides,
  };

  const [status] = await db
    .insert(schema.issueStatuses)
    .values(statusData)
    .returning();

  return status;
}

/**
 * Create a standard test machine with all relationships
 */
export async function createTestMachine(
  db: ReturnType<typeof drizzle>,
  dependencies: {
    organizationId?: string;
    locationId?: string;
    modelId?: string;
    ownerId?: string;
  } = {},
  overrides: Partial<{
    id: string;
    name: string;
    qrCodeId: string;
  }> = {},
): Promise<typeof schema.machines.$inferSelect> {
  const machineData = {
    id: TEST_IDS.machine,
    name: "MM #001",
    qrCodeId: "qr-test-123",
    organizationId: dependencies.organizationId ?? TEST_IDS.organization,
    locationId: dependencies.locationId ?? TEST_IDS.location,
    modelId: dependencies.modelId ?? TEST_IDS.model,
    ownerId: dependencies.ownerId ?? TEST_IDS.user,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const [machine] = await db
    .insert(schema.machines)
    .values(machineData)
    .returning();

  return machine;
}

/**
 * Create a standard test issue
 */
export async function createTestIssue(
  db: ReturnType<typeof drizzle>,
  dependencies: {
    organizationId?: string;
    machineId?: string;
    statusId?: string;
    priorityId?: string;
    createdById?: string;
  } = {},
  overrides: Partial<{
    id: string;
    title: string;
    description?: string;
  }> = {},
): Promise<typeof schema.issues.$inferSelect> {
  const issueData = {
    id: TEST_IDS.issue,
    title: "Test Issue",
    organizationId: dependencies.organizationId ?? TEST_IDS.organization,
    machineId: dependencies.machineId ?? TEST_IDS.machine,
    statusId: dependencies.statusId ?? TEST_IDS.status,
    priorityId: dependencies.priorityId ?? TEST_IDS.priority,
    createdById: dependencies.createdById ?? TEST_IDS.user,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const [issue] = await db.insert(schema.issues).values(issueData).returning();

  return issue;
}

/**
 * Create a complete test data set with all basic entities and relationships
 * This is useful for tests that need a full working environment
 */
export async function createCompleteTestDataSet(
  db: ReturnType<typeof drizzle>,
  organizationId?: string,
): Promise<{
  organization: typeof schema.organizations.$inferSelect;
  user: typeof schema.users.$inferSelect;
  model: typeof schema.models.$inferSelect;
  priority: typeof schema.priorities.$inferSelect;
  status: typeof schema.issueStatuses.$inferSelect;
  location: typeof schema.locations.$inferSelect;
  machine: typeof schema.machines.$inferSelect;
  issue: typeof schema.issues.$inferSelect;
}> {
  const orgId = organizationId ?? TEST_IDS.organization;

  // Create all base entities
  const organization = await createTestOrganization(db, { id: orgId });
  const user = await createTestUser(db);
  const model = await createTestModel(db);
  const priority = await createTestPriority(db, orgId);
  const status = await createTestIssueStatus(db, orgId);
  const location = await createTestLocation(db, orgId);

  // Create entities with dependencies
  const machine = await createTestMachine(db, {
    organizationId: orgId,
    locationId: location.id,
    modelId: model.id,
    ownerId: user.id,
  });

  const issue = await createTestIssue(db, {
    organizationId: orgId,
    machineId: machine.id,
    statusId: status.id,
    priorityId: priority.id,
    createdById: user.id,
  });

  return {
    organization,
    user,
    model,
    priority,
    status,
    location,
    machine,
    issue,
  };
}

/**
 * Generate unique test IDs for scenarios requiring multiple entities
 */
export function generateTestId(prefix: string, suffix?: string): string {
  const timestamp = Date.now().toString();
  return suffix ? `${prefix}-${suffix}-${timestamp}` : `${prefix}-${timestamp}`;
}
