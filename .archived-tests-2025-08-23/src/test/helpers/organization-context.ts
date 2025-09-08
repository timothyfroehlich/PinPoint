/**
 * Organization Context Helper
 *
 * Provides utilities for creating and managing organizational test contexts
 * for multi-tenant testing. This module handles organization setup, user
 * membership creation, and organizational boundary testing.
 *
 * Key Features:
 * - Organization test data creation with proper relationships
 * - Multi-tenant test data creation helpers
 * - User membership and role assignment utilities
 * - Cross-organization isolation test patterns
 * - Integration with existing test factories
 *
 * Usage:
 * ```typescript
 * test("multi-org data isolation", async ({ workerDb }) => {
 *   await withIsolatedTest(workerDb, async (db) => {
 *     const { org1, org2 } = await setupMultiOrgContext(db);
 *
 *     // Create data in both organizations
 *     await createOrgData(db, org1.id);
 *     await createOrgData(db, org2.id);
 *
 *     // Verify isolation
 *     const isolation = await verifyOrgIsolation(db, org1.id, org2.id);
 *     expect(isolation.isIsolated).toBe(true);
 *   });
 * });
 * ```
 */

import { eq, and } from "drizzle-orm";
import type { TestDatabase } from "./pglite-test-setup";
import * as schema from "~/server/db/schema";

/**
 * Organization test context with related entities
 */
export interface OrgTestContext {
  organization: {
    id: string;
    name: string;
    subdomain: string;
  };
  roles: {
    admin: { id: string; name: string };
    member: { id: string; name: string };
    technician: { id: string; name: string };
  };
  users: {
    admin: { id: string; email: string; name: string };
    member: { id: string; email: string; name: string };
    technician: { id: string; email: string; name: string };
  };
  memberships: {
    admin: { id: string; userId: string; roleId: string };
    member: { id: string; userId: string; roleId: string };
    technician: { id: string; userId: string; roleId: string };
  };
  statuses: {
    new: { id: string; name: string };
    inProgress: { id: string; name: string };
    resolved: { id: string; name: string };
  };
  priorities: {
    low: { id: string; name: string; level: number };
    medium: { id: string; name: string; level: number };
    high: { id: string; name: string; level: number };
  };
}

/**
 * Create a complete organizational context for testing
 *
 * Sets up organization with users, roles, memberships, and basic infrastructure
 * needed for testing organizational boundaries and multi-tenant functionality.
 *
 * @param db - Database instance
 * @param orgSuffix - Unique suffix for organization (defaults to random)
 * @returns Complete organizational test context
 */
export async function createOrgContext(
  db: TestDatabase,
  orgSuffix: string = Math.random().toString(36).substring(7),
): Promise<OrgTestContext> {
  const orgId = `test-org-${orgSuffix}`;
  const subdomain = `test${orgSuffix}`;

  // Create organization
  const [organization] = await db
    .insert(schema.organizations)
    .values({
      id: orgId,
      name: `Test Organization ${orgSuffix.toUpperCase()}`,
      subdomain,
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!organization) {
    throw new Error("Failed to create test organization");
  }

  // Create roles
  const [adminRole] = await db
    .insert(schema.roles)
    .values({
      id: `role-admin-${orgSuffix}`,
      name: "Admin",
      organizationId: orgId,
      isSystem: true,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const [memberRole] = await db
    .insert(schema.roles)
    .values({
      id: `role-member-${orgSuffix}`,
      name: "Member",
      organizationId: orgId,
      isSystem: true,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const [techRole] = await db
    .insert(schema.roles)
    .values({
      id: `role-tech-${orgSuffix}`,
      name: "Technician",
      organizationId: orgId,
      isSystem: true,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!adminRole || !memberRole || !techRole) {
    throw new Error("Failed to create test roles");
  }

  // Create users
  const [adminUser] = await db
    .insert(schema.users)
    .values({
      id: `user-admin-${orgSuffix}`,
      email: `admin-${orgSuffix}@test.dev`,
      name: `Admin User ${orgSuffix.toUpperCase()}`,
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const [memberUser] = await db
    .insert(schema.users)
    .values({
      id: `user-member-${orgSuffix}`,
      email: `member-${orgSuffix}@test.dev`,
      name: `Member User ${orgSuffix.toUpperCase()}`,
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const [techUser] = await db
    .insert(schema.users)
    .values({
      id: `user-tech-${orgSuffix}`,
      email: `tech-${orgSuffix}@test.dev`,
      name: `Tech User ${orgSuffix.toUpperCase()}`,
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!adminUser || !memberUser || !techUser) {
    throw new Error("Failed to create test users");
  }

  // Create memberships
  const [adminMembership] = await db
    .insert(schema.memberships)
    .values({
      id: `membership-admin-${orgSuffix}`,
      userId: adminUser.id,
      organizationId: orgId,
      roleId: adminRole.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const [memberMembership] = await db
    .insert(schema.memberships)
    .values({
      id: `membership-member-${orgSuffix}`,
      userId: memberUser.id,
      organizationId: orgId,
      roleId: memberRole.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const [techMembership] = await db
    .insert(schema.memberships)
    .values({
      id: `membership-tech-${orgSuffix}`,
      userId: techUser.id,
      organizationId: orgId,
      roleId: techRole.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!adminMembership || !memberMembership || !techMembership) {
    throw new Error("Failed to create test memberships");
  }

  // Create issue statuses
  const [newStatus] = await db
    .insert(schema.issueStatuses)
    .values({
      id: `status-new-${orgSuffix}`,
      name: "New",
      category: "NEW",
      organizationId: orgId,
      isDefault: true,
    })
    .returning();

  const [inProgressStatus] = await db
    .insert(schema.issueStatuses)
    .values({
      id: `status-progress-${orgSuffix}`,
      name: "In Progress",
      category: "IN_PROGRESS",
      organizationId: orgId,
      isDefault: false,
    })
    .returning();

  const [resolvedStatus] = await db
    .insert(schema.issueStatuses)
    .values({
      id: `status-resolved-${orgSuffix}`,
      name: "Resolved",
      category: "RESOLVED",
      organizationId: orgId,
      isDefault: false,
    })
    .returning();

  if (!newStatus || !inProgressStatus || !resolvedStatus) {
    throw new Error("Failed to create test statuses");
  }

  // Create priorities
  const [lowPriority] = await db
    .insert(schema.priorities)
    .values({
      id: `priority-low-${orgSuffix}`,
      name: "Low",
      level: 1,
      order: 1,
      organizationId: orgId,
      isDefault: false,
    })
    .returning();

  const [mediumPriority] = await db
    .insert(schema.priorities)
    .values({
      id: `priority-medium-${orgSuffix}`,
      name: "Medium",
      level: 2,
      order: 2,
      organizationId: orgId,
      isDefault: true,
    })
    .returning();

  const [highPriority] = await db
    .insert(schema.priorities)
    .values({
      id: `priority-high-${orgSuffix}`,
      name: "High",
      level: 3,
      order: 3,
      organizationId: orgId,
      isDefault: false,
    })
    .returning();

  if (!lowPriority || !mediumPriority || !highPriority) {
    throw new Error("Failed to create test priorities");
  }

  // Create models (required for machines)
  const [_testModel] = await db
    .insert(schema.models)
    .values({
      id: `model-test-${orgSuffix}`,
      name: `Test Pinball Model ${orgSuffix.toUpperCase()}`,
      manufacturer: "Test Manufacturer",
      year: 2023,
    })
    .returning();

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      subdomain: organization.subdomain,
    },
    roles: {
      admin: { id: adminRole.id, name: adminRole.name },
      member: { id: memberRole.id, name: memberRole.name },
      technician: { id: techRole.id, name: techRole.name },
    },
    users: {
      admin: {
        id: adminUser.id,
        email: adminUser.email!,
        name: adminUser.name!,
      },
      member: {
        id: memberUser.id,
        email: memberUser.email!,
        name: memberUser.name!,
      },
      technician: {
        id: techUser.id,
        email: techUser.email!,
        name: techUser.name!,
      },
    },
    memberships: {
      admin: {
        id: adminMembership.id,
        userId: adminMembership.userId,
        roleId: adminMembership.roleId,
      },
      member: {
        id: memberMembership.id,
        userId: memberMembership.userId,
        roleId: memberMembership.roleId,
      },
      technician: {
        id: techMembership.id,
        userId: techMembership.userId,
        roleId: techMembership.roleId,
      },
    },
    statuses: {
      new: { id: newStatus.id, name: newStatus.name },
      inProgress: { id: inProgressStatus.id, name: inProgressStatus.name },
      resolved: { id: resolvedStatus.id, name: resolvedStatus.name },
    },
    priorities: {
      low: {
        id: lowPriority.id,
        name: lowPriority.name,
        level: lowPriority.level,
      },
      medium: {
        id: mediumPriority.id,
        name: mediumPriority.name,
        level: mediumPriority.level,
      },
      high: {
        id: highPriority.id,
        name: highPriority.name,
        level: highPriority.level,
      },
    },
  };
}

/**
 * Set up multiple organizations for cross-org testing
 *
 * @param db - Database instance
 * @param count - Number of organizations to create (default: 2)
 * @returns Array of organizational contexts
 */
export async function setupMultiOrgContext(
  db: TestDatabase,
  count = 2,
): Promise<Record<string, OrgTestContext>> {
  const orgs: Record<string, OrgTestContext> = {};

  for (let i = 1; i <= count; i++) {
    const key = `org${String(i)}`;
    orgs[key] = await createOrgContext(db, i.toString());
  }

  return orgs;
}

/**
 * Create test data within an organization context
 *
 * @param db - Database instance
 * @param orgContext - Organization context to create data in
 * @param options - Data creation options
 * @returns Created test data
 */
export async function createOrgTestData(
  db: TestDatabase,
  orgContext: OrgTestContext,
  options: {
    locationCount?: number;
    machineCount?: number;
    issueCount?: number;
  } = {},
): Promise<{
  locations: { id: string; name: string }[];
  machines: { id: string; name: string; locationId: string }[];
  issues: { id: string; title: string; machineId: string }[];
}> {
  const { locationCount = 1, machineCount = 2, issueCount = 3 } = options;

  // Create a model for machines (required)
  const [testModel] = await db
    .insert(schema.models)
    .values({
      id: `model-${orgContext.organization.id}`,
      name: `Test Model for ${orgContext.organization.name}`,
      manufacturer: "Test Manufacturer",
      year: 2023,
    })
    .returning();

  if (!testModel) {
    throw new Error("Failed to create test model");
  }

  // Create locations
  const locations = [];
  for (let i = 1; i <= locationCount; i++) {
    const [location] = await db
      .insert(schema.locations)
      .values({
        id: `location-${orgContext.organization.id}-${String(i)}`,
        name: `Test Location ${String(i)}`,
        street: `${String(i)}23 Test St`,
        city: "Test City",
        state: "TS",
        zip: "12345",
        organizationId: orgContext.organization.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (location) {
      locations.push({ id: location.id, name: location.name });
    }
  }

  // Create machines
  const machines = [];
  for (let i = 1; i <= machineCount; i++) {
    const locationId =
      locations[Math.floor((i - 1) / 2)]?.id || locations[0]?.id;
    if (!locationId) continue;

    const [machine] = await db
      .insert(schema.machines)
      .values({
        id: `machine-${orgContext.organization.id}-${String(i)}`,
        name: `Test Machine ${String(i)}`,
        organizationId: orgContext.organization.id,
        locationId: locationId,
        modelId: testModel.id,
        qrCodeId: `qr-${orgContext.organization.id}-${String(i)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (machine) {
      machines.push({
        id: machine.id,
        name: machine.name,
        locationId: machine.locationId,
      });
    }
  }

  // Create issues
  const issues = [];
  for (let i = 1; i <= issueCount; i++) {
    const machineId = machines[Math.floor((i - 1) / 2)]?.id || machines[0]?.id;
    if (!machineId) continue;

    const [issue] = await db
      .insert(schema.issues)
      .values({
        id: `issue-${orgContext.organization.id}-${String(i)}`,
        title: `Test Issue ${String(i)} for ${orgContext.organization.name}`,
        description: `Test issue description ${String(i)}`,
        organizationId: orgContext.organization.id,
        machineId: machineId,
        statusId: orgContext.statuses.new.id,
        priorityId: orgContext.priorities.medium.id,
        createdById: orgContext.users.member.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (issue) {
      issues.push({
        id: issue.id,
        title: issue.title,
        machineId: issue.machineId,
      });
    }
  }

  return { locations, machines, issues };
}

/**
 * Verify organizational data isolation
 *
 * @param db - Database instance
 * @param org1Id - First organization ID
 * @param org2Id - Second organization ID
 * @returns Isolation verification results
 */
export async function verifyOrgIsolation(
  db: TestDatabase,
  org1Id: string,
  org2Id: string,
): Promise<{
  org1Data: {
    issueCount: number;
    machineCount: number;
    locationCount: number;
  };
  org2Data: {
    issueCount: number;
    machineCount: number;
    locationCount: number;
  };
  isIsolated: boolean;
  crossContamination: {
    org1HasOrg2Data: boolean;
    org2HasOrg1Data: boolean;
  };
}> {
  // Get data counts for org1
  const org1Issues = await db.query.issues.findMany({
    where: eq(schema.issues.organizationId, org1Id),
  });

  const org1Machines = await db.query.machines.findMany({
    where: eq(schema.machines.organizationId, org1Id),
  });

  const org1Locations = await db.query.locations.findMany({
    where: eq(schema.locations.organizationId, org1Id),
  });

  // Get data counts for org2
  const org2Issues = await db.query.issues.findMany({
    where: eq(schema.issues.organizationId, org2Id),
  });

  const org2Machines = await db.query.machines.findMany({
    where: eq(schema.machines.organizationId, org2Id),
  });

  const org2Locations = await db.query.locations.findMany({
    where: eq(schema.locations.organizationId, org2Id),
  });

  // Check for cross-contamination
  const org1HasOrg2Data =
    org1Issues.some((issue) => issue.organizationId === org2Id) ||
    org1Machines.some((machine) => machine.organizationId === org2Id) ||
    org1Locations.some((location) => location.organizationId === org2Id);

  const org2HasOrg1Data =
    org2Issues.some((issue) => issue.organizationId === org1Id) ||
    org2Machines.some((machine) => machine.organizationId === org1Id) ||
    org2Locations.some((location) => location.organizationId === org1Id);

  return {
    org1Data: {
      issueCount: org1Issues.length,
      machineCount: org1Machines.length,
      locationCount: org1Locations.length,
    },
    org2Data: {
      issueCount: org2Issues.length,
      machineCount: org2Machines.length,
      locationCount: org2Locations.length,
    },
    isIsolated: !org1HasOrg2Data && !org2HasOrg1Data,
    crossContamination: {
      org1HasOrg2Data,
      org2HasOrg1Data,
    },
  };
}

/**
 * Get user membership for a specific organization
 *
 * @param db - Database instance
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @returns User membership with role if found
 */
export async function getUserMembership(
  db: TestDatabase,
  userId: string,
  organizationId: string,
) {
  return await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.userId, userId),
      eq(schema.memberships.organizationId, organizationId),
    ),
    with: {
      role: true,
    },
  });
}

/**
 * Common organization test scenarios
 */
export const OrgTestScenarios = {
  /**
   * Two separate organizations with no shared data
   */
  isolation: async (db: TestDatabase) => {
    const { org1, org2 } = await setupMultiOrgContext(db, 2);

    await createOrgTestData(db, org1, { issueCount: 3, machineCount: 2 });
    await createOrgTestData(db, org2, { issueCount: 2, machineCount: 1 });

    return { org1, org2 };
  },

  /**
   * Organization with comprehensive data for relationship testing
   */
  comprehensive: async (db: TestDatabase) => {
    const org = await createOrgContext(db, "comp");

    await createOrgTestData(db, org, {
      locationCount: 2,
      machineCount: 4,
      issueCount: 6,
    });

    return { org };
  },

  /**
   * Multiple organizations for scale testing
   */
  scale: async (db: TestDatabase, orgCount = 5) => {
    const orgs = await setupMultiOrgContext(db, orgCount);

    for (const [_key, org] of Object.entries(orgs)) {
      await createOrgTestData(db, org, {
        issueCount: Math.floor(Math.random() * 5) + 1,
        machineCount: Math.floor(Math.random() * 3) + 1,
      });
    }

    return orgs;
  },
} as const;

/**
 * Type exports
 */
export type { OrgTestContext };
