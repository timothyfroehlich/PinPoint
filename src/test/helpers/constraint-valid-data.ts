import { SEED_TEST_IDS } from "../constants/seed-test-ids";
import {
  organizations,
  models,
  locations,
  machines,
  users,
  issues,
  auditTrail,
  issueStatuses,
  priorities,
} from "~/server/db/schema";

export interface ConstraintValidTestData {
  organizations: Array<{ id: string; name: string; subdomain: string }>;
  models: Array<{ id: string; name: string; manufacturer: string }>;
  locations: Array<{ id: string; name: string; organizationId: string }>;
  machines: Array<{
    id: string;
    name: string;
    organizationId: string;
    locationId: string;
    modelId: string;
  }>;
  users: Array<{ id: string; email: string; organizationId: string }>;
  issues: Array<{
    id: string;
    title: string;
    organizationId: string;
    machineId: string;
    createdBy: string;
  }>;
}

/**
 * Creates a complete set of constraint-valid test data with proper dependency chain
 */
export async function createConstraintValidTestData(
  db: any,
): Promise<ConstraintValidTestData> {
  // Step 1: Create base entities (no dependencies)
  const orgs = await db
    .insert(organizations)
    .values([
      {
        id: SEED_TEST_IDS.ORGANIZATIONS.primary,
        name: "Austin Pinball",
        subdomain: "austin-pinball",
        createdAt: new Date("2024-01-01"),
      },
      {
        id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
        name: "Competitor Arcade",
        subdomain: "competitor-arcade",
        createdAt: new Date("2024-01-01"),
      },
    ])
    .returning();

  const mds = await db
    .insert(models)
    .values([
      {
        id: SEED_TEST_IDS.MODELS.MEDIEVAL_MADNESS,
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
      },
      {
        id: SEED_TEST_IDS.MODELS.ATTACK_FROM_MARS,
        name: "Attack from Mars",
        manufacturer: "Bally",
        year: 1995,
      },
    ])
    .returning();

  // Step 2: Create dependent entities (require organizations)
  const locs = await db
    .insert(locations)
    .values([
      {
        id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        name: "Main Floor",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        capacity: 50,
      },
      {
        id: SEED_TEST_IDS.LOCATIONS.BACK_ROOM,
        name: "Back Room",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        capacity: 20,
      },
    ])
    .returning();

  const usrs = await db
    .insert(users)
    .values([
      {
        id: SEED_TEST_IDS.USERS.ADMIN,
        email: "admin@pinpoint.test",
        name: "Test Admin",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        role: "admin",
      },
      {
        id: SEED_TEST_IDS.USERS.MEMBER1,
        email: "member@pinpoint.test",
        name: "Test Member",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        role: "member",
      },
    ])
    .returning();

  // Step 3: Create machines (require organizations, locations, models)
  const machs = await db
    .insert(machines)
    .values([
      {
        id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        name: "Medieval Madness #001",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        modelId: SEED_TEST_IDS.MODELS.MEDIEVAL_MADNESS,
        status: "operational", // Valid enum value
        condition: "excellent", // Valid enum value
      },
      {
        id: SEED_TEST_IDS.MACHINES.ATTACK_FROM_MARS_1,
        name: "Attack from Mars #001",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        modelId: SEED_TEST_IDS.MODELS.ATTACK_FROM_MARS,
        status: "maintenance", // Valid enum value
        condition: "good", // Valid enum value
      },
    ])
    .returning();

  // Step 4: Create issues (require organizations, machines, users)
  await db.insert(issueStatuses).values([
    {
      id: "status-new-001",
      name: "New",
      category: "NEW",
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    },
    {
      id: "status-in-progress-001",
      name: "In Progress",
      category: "IN_PROGRESS",
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    },
  ]);

  await db.insert(priorities).values([
    {
      id: "priority-low-001",
      name: "Low",
      order: 1,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    },
    {
      id: "priority-medium-001",
      name: "Medium",
      order: 2,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    },
    {
      id: "priority-high-001",
      name: "High",
      order: 3,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    },
  ]);

  const iss = await db
    .insert(issues)
    .values([
      {
        id: SEED_TEST_IDS.ISSUES.ISSUE_1,
        title: "Left flipper not working",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        createdById: SEED_TEST_IDS.USERS.ADMIN,
        statusId: "status-new-001",
        priorityId: "priority-high-001",
        createdAt: new Date("2024-01-15"),
      },
      {
        id: SEED_TEST_IDS.ISSUES.ISSUE_2,
        title: "Display flickering",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        machineId: SEED_TEST_IDS.MACHINES.ATTACK_FROM_MARS_1,
        createdById: SEED_TEST_IDS.USERS.MEMBER1,
        statusId: "status-in-progress-001",
        priorityId: "priority-medium-001",
        createdAt: new Date("2024-01-16"),
      },
    ])
    .returning();

  return {
    organizations: orgs,
    models: mds,
    locations: locs,
    machines: machs,
    users: usrs,
    issues: iss,
  };
}

// Convenience function for audit trail test data
export async function createAuditTrailTestData(db: any) {
  const baseData = await createConstraintValidTestData(db);

  // Create audit trail entries with valid action types
  await db.insert(auditTrail).values([
    {
      id: "audit-1",
      entityType: "issue", // Valid entity type
      entityId: SEED_TEST_IDS.ISSUES.ISSUE_1,
      action: "create", // Valid action type
      userId: SEED_TEST_IDS.USERS.ADMIN,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      changes: { title: "Left flipper not working" },
      createdAt: new Date("2024-01-15"),
    },
    {
      id: "audit-2",
      entityType: "machine", // Valid entity type
      entityId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      action: "update", // Valid action type
      userId: SEED_TEST_IDS.USERS.ADMIN,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      changes: { status: "maintenance" },
      createdAt: new Date("2024-01-16"),
    },
  ]);

  return baseData;
}
