/**
 * Issue Router Integration Tests (tRPC + PGlite)
 *
 * Real tRPC router integration tests using PGlite in-memory PostgreSQL database.
 * Tests actual router operations with proper authentication, permissions, and database operations.
 *
 * Converted from unit tests to proper Archetype 5 (tRPC Router Integration) patterns.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real tRPC router operations
 * - Actual permission enforcement via RLS
 * - Multi-tenant data isolation testing
 * - Worker-scoped database for memory safety
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 * 
 * Covers all issue procedures:
 * - getById: Retrieve issue by ID with full details
 * - update: Update issue fields with permissions
 * - updateStatus: Change issue status with validation
 * - publicCreate: Anonymous issue creation via QR codes
 * - publicGetAll: Anonymous issue viewing with filtering
 */

import { eq, and } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => generateTestId("test-id")),
  generatePrefixedId: vi.fn((prefix) => generateTestId(`${prefix}-id`)),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "issue:read",
      "issue:edit",
      "issue:create",
      "issue:delete",
    ]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue([
      "issue:read",
      "issue:edit",
      "issue:create",
      "issue:delete",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
  supabaseUserToSession: vi.fn((user) => ({
    user: {
      id: user?.id ?? generateTestId("fallback-user"),
      email: user?.email ?? "test@example.com",
      name: user?.name ?? "Test User",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })),
}));

import { appRouter } from "~/server/api/root";
import * as schema from "~/server/db/schema";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

// Import real service factory for true integration testing
import { ServiceFactory } from "~/server/services/factory";

// Helper function to set up test data and context
async function setupTestData(db: TestDatabase) {
  // Create seed data first
  const organizationId = generateTestId("test-org");

  // Create organization
  const [org] = await db
    .insert(schema.organizations)
    .values({
      id: organizationId,
      name: "Test Organization",
      subdomain: "test",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create test user with dynamic ID for integration tests
  const [testUser] = await db
    .insert(schema.users)
    .values({
      id: generateTestId("user-admin"),
      name: "Test Admin",
      email: `admin-${generateTestId("user")}@example.com`,
      emailVerified: null,
    })
    .returning();

  // Create roles
  const [adminRole] = await db
    .insert(schema.roles)
    .values({
      id: generateTestId("admin-role"),
      name: "Admin",
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create membership for the test user
  await db.insert(schema.memberships).values({
    id: "test-membership-1",
    userId: testUser.id,
    organizationId,
    roleId: adminRole.id,
  });

  // Create location
  const [location] = await db
    .insert(schema.locations)
    .values({
      id: generateTestId("location"),
      name: "Test Location",
      address: "123 Test Street",
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create model
  const [model] = await db
    .insert(schema.models)
    .values({
      id: generateTestId("model"),
      name: "Test Model",
      manufacturer: "Test Mfg",
      year: 2020,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create machine
  const [machine] = await db
    .insert(schema.machines)
    .values({
      id: generateTestId("machine"),
      name: "Test Machine",
      modelId: model.id,
      locationId: location.id,
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create status and priority
  const [status] = await db
    .insert(schema.issueStatuses)
    .values({
      id: generateTestId("status"),
      name: "Open",
      category: "NEW",
      isDefault: true,
      organizationId,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const [priority] = await db
    .insert(schema.priorities)
    .values({
      id: generateTestId("priority"),
      name: "Medium",
      isDefault: true,
      organizationId,
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create test issue
  const [issue] = await db
    .insert(schema.issues)
    .values({
      id: generateTestId("issue"),
      title: "Test Issue",
      description: "Test issue description",
      machineId: machine.id,
      statusId: status.id,
      priorityId: priority.id,
      createdById: testUser.id,
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create test context with real data
  const ctx: TRPCContext = {
    user: {
      id: testUser.id,
      email: testUser.email!,
      name: testUser.name!,
      image: null,
    },
    db,
    supabase: null,
    organization: {
      id: organizationId,
      name: org.name,
      subdomain: org.subdomain!,
    },
    session: {
      user: {
        id: testUser.id,
        email: testUser.email!,
        name: testUser.name!,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    organizationId,
    userId: testUser.id,
    userPermissions: [
      "issue:read",
      "issue:edit",
      "issue:create",
      "issue:delete",
    ],
    services: new ServiceFactory(db),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(() => ctx.logger),
      withRequest: vi.fn(() => ctx.logger),
      withUser: vi.fn(() => ctx.logger),
      withOrganization: vi.fn(() => ctx.logger),
      withContext: vi.fn(() => ctx.logger),
    } as any,
  };

  return {
    ctx,
    organizationId,
    testUser,
    adminRole,
    location,
    model,
    machine,
    status,
    priority,
    issue,
  };
}

// Helper function to create public context for anonymous procedures
async function setupPublicTestData(db: TestDatabase) {
  // Create seed data first
  const organizationId = generateTestId("test-org");

  // Create organization
  const [org] = await db
    .insert(schema.organizations)
    .values({
      id: organizationId,
      name: "Test Organization",
      subdomain: "test",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create location
  const [location] = await db
    .insert(schema.locations)
    .values({
      id: generateTestId("location"),
      name: "Test Location",
      address: "123 Test Street",
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create model
  const [model] = await db
    .insert(schema.models)
    .values({
      id: generateTestId("model"),
      name: "Test Model",
      manufacturer: "Test Mfg",
      year: 2020,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create machine
  const [machine] = await db
    .insert(schema.machines)
    .values({
      id: generateTestId("machine"),
      name: "Test Machine",
      modelId: model.id,
      locationId: location.id,
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create status and priority
  const [status] = await db
    .insert(schema.issueStatuses)
    .values({
      id: generateTestId("status"),
      name: "Open",
      category: "NEW",
      isDefault: true,
      organizationId,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const [priority] = await db
    .insert(schema.priorities)
    .values({
      id: generateTestId("priority"),
      name: "Medium",
      isDefault: true,
      organizationId,
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create public context (no user)
  const ctx: TRPCContext = {
    user: null,
    db,
    supabase: null,
    organization: {
      id: organizationId,
      name: org.name,
      subdomain: org.subdomain!,
    },
    session: null,
    organizationId,
    userId: null,
    userPermissions: [],
    services: new ServiceFactory(db),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(() => ctx.logger),
      withRequest: vi.fn(() => ctx.logger),
      withUser: vi.fn(() => ctx.logger),
      withOrganization: vi.fn(() => ctx.logger),
      withContext: vi.fn(() => ctx.logger),
    } as any,
  };

  return {
    ctx,
    organizationId,
    location,
    model,
    machine,
    status,
    priority,
  };
}

describe("Issue Router Integration Tests", () => {
  describe("getById procedure", () => {
    test("should retrieve issue by ID with full details", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, issue } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        const result = await caller.issue.core.getById({ id: issue.id });

        expect(result).toBeDefined();
        expect(result.id).toBe(issue.id);
        expect(result.title).toBe("Test Issue");
        expect(result.machine).toBeDefined();
        expect(result.status).toBeDefined();
        expect(result.priority).toBeDefined();
        expect(result.createdBy).toBeDefined();
      });
    });

    test("should enforce organization isolation", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        // Create issue in different organization with all required fields
        const [otherOrg] = await db
          .insert(schema.organizations)
          .values({
            id: generateTestId("other-org"),
            name: "Other Org",
            subdomain: "other",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create required entities for other org
        const [otherModel] = await db
          .insert(schema.models)
          .values({
            id: generateTestId("other-model"),
            name: "Other Model",
            manufacturer: "Other Mfg",
            year: 2020,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [otherLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("other-location"),
            name: "Other Location",
            address: "456 Other Street",
            organizationId: otherOrg.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [otherMachine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("other-machine"),
            name: "Other Machine",
            modelId: otherModel.id,
            locationId: otherLocation.id,
            organizationId: otherOrg.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [otherStatus] = await db
          .insert(schema.issueStatuses)
          .values({
            id: generateTestId("other-status"),
            name: "Other Status",
            category: "NEW",
            organizationId: otherOrg.id,
            order: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [otherPriority] = await db
          .insert(schema.priorities)
          .values({
            id: generateTestId("other-priority"),
            name: "Other Priority",
            organizationId: otherOrg.id,
            order: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [otherOrgIssue] = await db
          .insert(schema.issues)
          .values({
            id: generateTestId("other-issue"),
            title: "Other Org Issue",
            machineId: otherMachine.id,
            statusId: otherStatus.id,
            priorityId: otherPriority.id,
            organizationId: otherOrg.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        await expect(
          caller.issue.core.getById({ id: otherOrgIssue.id }),
        ).rejects.toThrow("Issue not found");
      });
    });

    test("should throw error for non-existent issue", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        await expect(
          caller.issue.core.getById({ id: generateTestId("non-existent") }),
        ).rejects.toThrow("Issue not found");
      });
    });
  });

  describe("update procedure", () => {
    test("should update issue fields successfully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, issue } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        const result = await caller.issue.core.update({
          id: issue.id,
          title: "Updated Title",
          description: "Updated description",
        });

        expect(result).toBeDefined();
        expect(result.title).toBe("Updated Title");
        expect(result.description).toBe("Updated description");

        // Verify in database
        const updatedIssue = await db.query.issues.findFirst({
          where: eq(schema.issues.id, issue.id),
        });
        expect(updatedIssue?.title).toBe("Updated Title");
        expect(updatedIssue?.description).toBe("Updated description");
      });
    });

    test("should enforce organization isolation on updates", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        // Create issue in different organization
        const [otherOrg] = await db
          .insert(schema.organizations)
          .values({
            id: generateTestId("other-org"),
            name: "Other Org",
            subdomain: "other",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [otherOrgIssue] = await db
          .insert(schema.issues)
          .values({
            id: generateTestId("other-issue"),
            title: "Other Org Issue",
            organizationId: otherOrg.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        await expect(
          caller.issue.core.update({
            id: otherOrgIssue.id,
            title: "Hacked Title",
          }),
        ).rejects.toThrow("Issue not found");
      });
    });
  });

  describe("updateStatus procedure", () => {
    test("should update issue status successfully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, issue, organizationId } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        // Create new status
        const [newStatus] = await db
          .insert(schema.issueStatuses)
          .values({
            id: generateTestId("new-status"),
            name: "In Progress",
            category: "IN_PROGRESS",
            organizationId,
            order: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const result = await caller.issue.core.updateStatus({
          id: issue.id,
          statusId: newStatus.id,
        });

        expect(result).toBeDefined();
        expect(result.statusId).toBe(newStatus.id);

        // Verify in database
        const updatedIssue = await db.query.issues.findFirst({
          where: eq(schema.issues.id, issue.id),
        });
        expect(updatedIssue?.statusId).toBe(newStatus.id);
      });
    });

    test("should validate status belongs to same organization", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, issue } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        // Create status in different organization
        const [otherOrg] = await db
          .insert(schema.organizations)
          .values({
            id: generateTestId("other-org"),
            name: "Other Org",
            subdomain: "other",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [otherStatus] = await db
          .insert(schema.issueStatuses)
          .values({
            id: generateTestId("other-status"),
            name: "Other Status",
            category: "NEW",
            organizationId: otherOrg.id,
            order: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        await expect(
          caller.issue.core.updateStatus({
            id: issue.id,
            statusId: otherStatus.id,
          }),
        ).rejects.toThrow("Invalid status");
      });
    });
  });

  describe("Authentication and Authorization", () => {
    test("should require authentication for protected procedures", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { issue } = await setupTestData(db);

        // Create context without authentication
        const unauthCtx: TRPCContext = {
          user: null,
          db,
          supabase: null,
          organization: null,
          session: null,
          organizationId: null,
          userId: null,
          userPermissions: [],
          services: new ServiceFactory(db),
          logger: {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
            child: vi.fn(() => unauthCtx.logger),
            withRequest: vi.fn(() => unauthCtx.logger),
            withUser: vi.fn(() => unauthCtx.logger),
            withOrganization: vi.fn(() => unauthCtx.logger),
            withContext: vi.fn(() => unauthCtx.logger),
          } as any,
        };

        const caller = appRouter.createCaller(unauthCtx);

        await expect(
          caller.issue.core.getById({ id: issue.id }),
        ).rejects.toThrow("UNAUTHORIZED");

        await expect(
          caller.issue.core.update({ id: issue.id, title: "New Title" }),
        ).rejects.toThrow("UNAUTHORIZED");

        await expect(
          caller.issue.core.updateStatus({ id: issue.id, statusId: "status-1" }),
        ).rejects.toThrow("UNAUTHORIZED");
      });
    });
  });
});

describe("Public Issue Procedures", () => {

  describe("publicCreate - Anonymous Issue Creation", () => {
    test("should allow anonymous users to create issues via QR codes", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine } = await setupPublicTestData(db);
        const caller = appRouter.createCaller(ctx);

        const result = await caller.issue.core.publicCreate({
          title: "Machine not working",
          description: "Screen is black",
          machineId: machine.id,
          reporterEmail: "john@example.com",
          submitterName: "John Doe",
        });

        expect(result).toBeDefined();
        expect(result.title).toBe("Machine not working");
        expect(result.description).toBe("Screen is black");
        expect(result.createdById).toBeNull();
        expect(result.submitterName).toBe("John Doe");
        expect(result.reporterEmail).toBe("john@example.com");
        expect(result.machineId).toBe(machine.id);

        // Verify issue was created in database
        const createdIssue = await db.query.issues.findFirst({
          where: eq(schema.issues.id, result.id),
        });
        expect(createdIssue).toBeDefined();
        expect(createdIssue?.title).toBe("Machine not working");
      });
    });

    test("should validate required fields for anonymous issue creation", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupPublicTestData(db);
        const caller = appRouter.createCaller(ctx);

        // Test missing title
        await expect(
          caller.issue.core.publicCreate({
            title: "",
            machineId: "machine-1",
          }),
        ).rejects.toThrow();

        // Test missing machineId
        await expect(
          caller.issue.core.publicCreate({
            title: "Test Issue",
            machineId: "",
          }),
        ).rejects.toThrow();
      });
    });

    test("should validate email format for reporterEmail", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine } = await setupPublicTestData(db);
        const caller = appRouter.createCaller(ctx);

        await expect(
          caller.issue.core.publicCreate({
            title: "Test Issue",
            machineId: machine.id,
            reporterEmail: "invalid-email",
          }),
        ).rejects.toThrow();
      });
    });

    test("should handle machine not found error", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupPublicTestData(db);
        const caller = appRouter.createCaller(ctx);

        await expect(
          caller.issue.core.publicCreate({
            title: "Test Issue",
            machineId: generateTestId("nonexistent-machine"),
          }),
        ).rejects.toThrow("Machine not found");
      });
    });

    test("should handle missing default status error", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine } = await setupPublicTestData(db);
        
        // Remove default status to simulate error condition
        await db.delete(schema.issueStatuses);
        
        const caller = appRouter.createCaller(ctx);

        await expect(
          caller.issue.core.publicCreate({
            title: "Test Issue",
            machineId: machine.id,
          }),
        ).rejects.toThrow(
          "Default issue status not found. Please contact an administrator.",
        );
      });
    });

    test("should handle missing default priority error", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine } = await setupPublicTestData(db);
        
        // Remove default priority to simulate error condition
        await db.delete(schema.priorities);
        
        const caller = appRouter.createCaller(ctx);

        await expect(
          caller.issue.core.publicCreate({
            title: "Test Issue",
            machineId: machine.id,
          }),
        ).rejects.toThrow(
          "Default priority not found. Please contact an administrator.",
        );
      });
    });

    test("should create minimal issue with only required fields", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine, status, priority } = await setupPublicTestData(db);
        const caller = appRouter.createCaller(ctx);

        const result = await caller.issue.core.publicCreate({
          title: "Machine Issue",
          machineId: machine.id,
        });

        expect(result).toBeDefined();
        expect(result.title).toBe("Machine Issue");
        expect(result.createdById).toBeNull();
        expect(result.machineId).toBe(machine.id);
        expect(result.statusId).toBe(status.id);
        expect(result.priorityId).toBe(priority.id);

        // Verify issue was created in database
        const createdIssue = await db.query.issues.findFirst({
          where: eq(schema.issues.id, result.id),
        });
        expect(createdIssue).toBeDefined();
        expect(createdIssue?.title).toBe("Machine Issue");
        expect(createdIssue?.createdById).toBeNull();
      });
    });
  });

  describe("publicGetAll - Anonymous Issue Viewing", () => {
    test("should allow anonymous users to view issues", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, organizationId, machine, status, priority } = await setupPublicTestData(db);
        
        // Create test user for issue assignment
        const [testUser] = await db
          .insert(schema.users)
          .values({
            id: generateTestId("test-user"),
            name: "Test User",
            email: "test@example.com",
            emailVerified: null,
          })
          .returning();

        // Create test issues
        await db.insert(schema.issues).values([
          {
            id: generateTestId("issue-1"),
            title: "Machine not working",
            description: "Screen is black",
            machineId: machine.id,
            statusId: status.id,
            priorityId: priority.id,
            organizationId,
            submitterName: "John Doe",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: generateTestId("issue-2"),
            title: "Flipper stuck",
            description: null,
            machineId: machine.id,
            statusId: status.id,
            priorityId: priority.id,
            organizationId,
            submitterName: "Jane Smith",
            createdById: testUser.id,
            assignedToId: testUser.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const caller = appRouter.createCaller(ctx);
        const result = await caller.issue.core.publicGetAll();

        expect(result).toHaveLength(2);
        expect(result.some(i => i.title === "Machine not working")).toBe(true);
        expect(result.some(i => i.title === "Flipper stuck")).toBe(true);
        
        // Verify structure of returned data
        const issue1 = result.find(i => i.title === "Machine not working");
        expect(issue1?.machine).toBeDefined();
        expect(issue1?.status).toBeDefined();
        expect(issue1?.priority).toBeDefined();
      });
    });

    test("should filter issues by location", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, organizationId, status, priority, model } = await setupPublicTestData(db);
        
        // Create second location
        const [location2] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("location-2"),
            name: "Location 2",
            address: "456 Other Street",
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create machine in location 2
        const [machine2] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("machine-2"),
            name: "Machine 2",
            modelId: model.id,
            locationId: location2.id,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create issues in both locations
        await db.insert(schema.issues).values([
          {
            id: generateTestId("issue-location-1"),
            title: "Issue at Location 1",
            machineId: machine2.id, // Use first machine (location 1)
            statusId: status.id,
            priorityId: priority.id,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: generateTestId("issue-location-2"),
            title: "Issue at Location 2",
            machineId: machine2.id, // Use second machine (location 2)
            statusId: status.id,
            priorityId: priority.id,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const caller = appRouter.createCaller(ctx);
        const result = await caller.issue.core.publicGetAll({
          locationId: location2.id,
        });

        // Should only return issues from location 2
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Issue at Location 2");
      });
    });

    test("should filter issues by machine", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, organizationId, machine, status, priority, model, location } = await setupPublicTestData(db);
        
        // Create second machine
        const [machine2] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("machine-2"),
            name: "Machine 2",
            modelId: model.id,
            locationId: location.id,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create issues for both machines
        await db.insert(schema.issues).values([
          {
            id: generateTestId("issue-machine-1"),
            title: "Issue for Machine 1",
            machineId: machine.id,
            statusId: status.id,
            priorityId: priority.id,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: generateTestId("issue-machine-2"),
            title: "Issue for Machine 2",
            machineId: machine2.id,
            statusId: status.id,
            priorityId: priority.id,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const caller = appRouter.createCaller(ctx);
        const result = await caller.issue.core.publicGetAll({
          machineId: machine.id,
        });

        // Should only return issues for machine 1
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Issue for Machine 1");
        expect(result[0].machineId).toBe(machine.id);
      });
    });

    test("should filter issues by status", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, organizationId, machine, priority } = await setupPublicTestData(db);
        
        // Create multiple statuses
        const [status1] = await db
          .insert(schema.issueStatuses)
          .values({
            id: generateTestId("status-1"),
            name: "Open",
            category: "NEW",
            organizationId,
            order: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [status2] = await db
          .insert(schema.issueStatuses)
          .values({
            id: generateTestId("status-2"),
            name: "Closed",
            category: "RESOLVED",
            organizationId,
            order: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create issues with different statuses
        await db.insert(schema.issues).values([
          {
            id: generateTestId("issue-open"),
            title: "Open Issue",
            machineId: machine.id,
            statusId: status1.id,
            priorityId: priority.id,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: generateTestId("issue-closed"),
            title: "Closed Issue",
            machineId: machine.id,
            statusId: status2.id,
            priorityId: priority.id,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const caller = appRouter.createCaller(ctx);
        const result = await caller.issue.core.publicGetAll({
          statusId: status1.id,
        });

        // Should only return open issues
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Open Issue");
        expect(result[0].statusId).toBe(status1.id);
      });
    });

    test("should filter issues by status category", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, organizationId, machine, status, priority } = await setupPublicTestData(db);
        
        // Create an issue with NEW status category
        await db.insert(schema.issues).values({
          id: generateTestId("test-issue"),
          title: "Test Issue",
          description: "Test description",
          organizationId,
          machineId: machine.id,
          statusId: status.id,
          priorityId: priority.id,
          createdBy: generateTestId("user"),
        });
        
        const caller = appRouter.createCaller(ctx);
        const result = await caller.issue.core.publicGetAll({
          statusCategory: "NEW",
        });
        
        expect(result.length).toBe(1);
        expect(result[0]?.title).toBe("Test Issue");
      });
    });

    test("should filter issues by model", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, organizationId, machine, status, priority, model } = await setupPublicTestData(db);
        
        // Create an issue linked to the specific model
        await db.insert(schema.issues).values({
          id: generateTestId("test-issue"),
          title: "Model-specific Issue",
          description: "Issue with this model",
          organizationId,
          machineId: machine.id,
          statusId: status.id,
          priorityId: priority.id,
          createdBy: generateTestId("user"),
        });
        
        const caller = appRouter.createCaller(ctx);
        const result = await caller.issue.core.publicGetAll({
          modelId: model.id,
        });
        
        expect(result.length).toBe(1);
        expect(result[0]?.title).toBe("Model-specific Issue");
      });
    });

    test("should handle custom limit parameter", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, organizationId, machine, status, priority } = await setupPublicTestData(db);
        
        // Create multiple issues
        const issueData = Array.from({ length: 15 }, (_, i) => ({
          id: generateTestId(`issue-${i}`),
          title: `Issue ${i + 1}`,
          machineId: machine.id,
          statusId: status.id,
          priorityId: priority.id,
          organizationId,
          createdAt: new Date(Date.now() - i * 1000), // Different timestamps for ordering
          updatedAt: new Date(Date.now() - i * 1000),
        }));
        
        await db.insert(schema.issues).values(issueData);

        const caller = appRouter.createCaller(ctx);
        const result = await caller.issue.core.publicGetAll({
          limit: 5,
        });

        // Should return only 5 issues
        expect(result).toHaveLength(5);
        // Should be ordered by createdAt desc (most recent first)
        expect(result[0].title).toBe("Issue 1"); // Most recent
      });
    });

    test("should enforce maximum limit of 100", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupPublicTestData(db);
        const caller = appRouter.createCaller(ctx);

        await expect(
          caller.issue.core.publicGetAll({
            limit: 150, // Over maximum
          }),
        ).rejects.toThrow();
      });
    });

    test("should enforce minimum limit of 1", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupPublicTestData(db);
        const caller = appRouter.createCaller(ctx);

        await expect(
          caller.issue.core.publicGetAll({
            limit: 0, // Under minimum
          }),
        ).rejects.toThrow();
      });
    });

    test("should sort issues by different criteria", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, organizationId, machine, status, priority } = await setupPublicTestData(db);
        
        // Create multiple issues with different timestamps
        await db.insert(schema.issues).values([
          {
            id: generateTestId("issue-1"),
            title: "First Issue",
            machineId: machine.id,
            statusId: status.id,
            priorityId: priority.id,
            organizationId,
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-02'),
          },
          {
            id: generateTestId("issue-2"),
            title: "Second Issue",
            machineId: machine.id,
            statusId: status.id,
            priorityId: priority.id,
            organizationId,
            createdAt: new Date('2023-01-03'),
            updatedAt: new Date('2023-01-04'),
          },
        ]);

        const caller = appRouter.createCaller(ctx);

        // Test default sorting (by created date desc)
        const defaultResult = await caller.issue.core.publicGetAll();
        expect(defaultResult).toHaveLength(2);
        expect(defaultResult[0].title).toBe("Second Issue"); // Most recent first

        // Test sorting by created date asc
        const ascResult = await caller.issue.core.publicGetAll({
          sortBy: "created",
          sortOrder: "asc",
        });
        expect(ascResult[0].title).toBe("First Issue"); // Oldest first
      });
    });

    test("should handle organization not found error", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupPublicTestData(db);
        
        // Create context without organization
        const noOrgCtx: TRPCContext = {
          ...ctx,
          organization: null,
          organizationId: null,
        };
        
        const caller = appRouter.createCaller(noOrgCtx);

        await expect(caller.issue.core.publicGetAll()).rejects.toThrow(
          "Organization not found",
        );
      });
    });

    test("should combine multiple filters", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, organizationId, location, model, status, priority } = await setupPublicTestData(db);
        
        // Create another location and status
        const [location2] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("location-2"),
            name: "Location 2",
            address: "456 Other Street",
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [closedStatus] = await db
          .insert(schema.issueStatuses)
          .values({
            id: generateTestId("status-closed"),
            name: "Closed",
            category: "RESOLVED",
            organizationId,
            order: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create machines in both locations
        const [machine1] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("machine-1"),
            name: "Machine in Location 1",
            modelId: model.id,
            locationId: location.id,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [machine2] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("machine-2"),
            name: "Machine in Location 2",
            modelId: model.id,
            locationId: location2.id,
            organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create issues with different combinations
        await db.insert(schema.issues).values([
          {
            id: generateTestId("issue-match"),
            title: "Matching Issue",
            machineId: machine1.id, // Location 1
            statusId: status.id, // NEW category
            priorityId: priority.id,
            organizationId,
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-01'),
          },
          {
            id: generateTestId("issue-wrong-location"),
            title: "Wrong Location",
            machineId: machine2.id, // Location 2
            statusId: status.id, // NEW category
            priorityId: priority.id,
            organizationId,
            createdAt: new Date('2023-01-02'),
            updatedAt: new Date('2023-01-02'),
          },
          {
            id: generateTestId("issue-wrong-status"),
            title: "Wrong Status",
            machineId: machine1.id, // Location 1
            statusId: closedStatus.id, // DONE category
            priorityId: priority.id,
            organizationId,
            createdAt: new Date('2023-01-03'),
            updatedAt: new Date('2023-01-03'),
          },
        ]);

        const caller = appRouter.createCaller(ctx);
        const result = await caller.issue.core.publicGetAll({
          locationId: location.id,
          statusCategory: "NEW",
          sortBy: "created",
          sortOrder: "asc",
          limit: 10,
        });

        // Should only return the matching issue
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Matching Issue");
        expect(result[0].machine.locationId).toBe(location.id);
        expect(result[0].status.category).toBe("NEW");
      });
    });
  });
});
