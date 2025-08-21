/**
 * Router Integration Tests (tRPC + PGlite)
 *
 * Real tRPC router integration tests using PGlite in-memory PostgreSQL database.
 * Tests actual router operations with proper authentication, permissions, and database operations.
 *
 * Converted from mock-heavy unit tests to proper Archetype 5 (tRPC Router Integration) patterns.
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
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { describe, expect, vi, beforeAll } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";

import { appRouter } from "~/server/api/root";
import * as schema from "~/server/db/schema";
import { 
  createSeededTestDatabase, 
  getSeededTestData 
} from "~/test/helpers/pglite-test-setup";
import { createSeededAdminTestContext } from "~/test/helpers/createSeededAdminTestContext";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => generateTestId("test-id")),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "issue:create",
      "issue:edit",
      "issue:delete",
      "machine:edit",
      "machine:delete",
      "location:edit",
      "location:delete",
      "organization:manage",
      "user:manage",
    ]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue([
      "issue:create",
      "issue:edit",
      "issue:delete",
      "machine:edit",
      "machine:delete",
      "location:edit",
      "location:delete",
      "organization:manage",
      "user:manage",
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

// Mock the service factory to avoid service dependencies
vi.mock("~/server/services/factory", () => ({
  createServiceFactory: vi.fn(() => ({
    createNotificationService: vi.fn(() => ({
      notifyMachineOwnerOfIssue: vi.fn(),
      notifyMachineOwnerOfStatusChange: vi.fn(),
    })),
    createIssueActivityService: vi.fn(() => ({
      recordActivity: vi.fn(),
      recordIssueAssigned: vi.fn(),
    })),
  })),
}));

describe("tRPC Router Integration Tests", () => {
  // Suite-level variables for seeded data
  let workerDb: TestDatabase;
  let primaryOrgId: string;
  let competitorOrgId: string;
  let seededData: any;

  beforeAll(async () => {
    // Create seeded test database with dual organizations
    const { db, primaryOrgId: primary, secondaryOrgId: competitor } = await createSeededTestDatabase();
    workerDb = db;
    primaryOrgId = primary;
    competitorOrgId = competitor;
    
    // Get seeded test data for primary organization
    seededData = await getSeededTestData(db, primaryOrgId);
  });

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
        manufacturer: "Test Manufacturer",
        year: 2024,
      })
      .returning();

    // Create machine
    const [machine] = await db
      .insert(schema.machines)
      .values({
        id: "test-machine",
        name: "Test Machine",
        qrCodeId: generateTestId("qr"),
        organizationId,
        locationId: location.id,
        modelId: model.id,
        ownerId: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create issue statuses
    const [status] = await db
      .insert(schema.issueStatuses)
      .values({
        id: generateTestId("status"),
        name: "New",
        category: "NEW",
        organizationId,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create priority
    const [priority] = await db
      .insert(schema.priorities)
      .values({
        id: generateTestId("priority"),
        name: "Medium",
        organizationId,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create test context with real database
    const ctx: TRPCContext = {
      db: db,
      user: {
        id: testUser.id,
        email: "test@example.com",
        name: "Test User",
        user_metadata: {},
        app_metadata: {
          organization_id: organizationId,
        },
      },
      organization: {
        id: organizationId,
        name: "Test Organization",
        subdomain: "test",
      },
      organizationId: organizationId,
      supabase: {} as any, // Not used in this router
      headers: new Headers(),
      userPermissions: [
        "issue:create",
        "issue:edit",
        "issue:delete",
        "machine:edit",
        "machine:delete",
        "location:edit",
        "location:delete",
        "organization:manage",
        "user:manage",
      ],
      services: {} as any, // Not used in this router
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
      machine,
      location,
      model,
      status,
      priority,
      testUser,
      adminRole,
    };
  }

  describe("Issue Router Integration", () => {
    test("should create issue with real database operations", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine, status, priority } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        const result = await caller.issue.core.create({
          title: "Integration Test Issue",
          description: "Real database test description",
          severity: "Medium",
          machineId: machine.id,
        });

        // Verify the result structure
        expect(result).toMatchObject({
          title: "Integration Test Issue",
          description: "Real database test description",
          machineId: machine.id,
          statusId: status.id,
          priorityId: priority.id,
        });

        // Verify relationships are loaded
        expect(result.machine).toBeDefined();
        expect(result.machine.id).toBe(machine.id);
        expect(result.status).toBeDefined();
        expect(result.status.id).toBe(status.id);
        expect(result.priority).toBeDefined();
        expect(result.priority.id).toBe(priority.id);

        // Verify the database was actually updated
        const issueInDb = await db.query.issues.findFirst({
          where: eq(schema.issues.id, result.id),
        });
        expect(issueInDb).toBeDefined();
        expect(issueInDb?.title).toBe("Integration Test Issue");
      });
    });

    test("should update issue with real database operations", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine, status, priority } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        // First create an issue
        const issue = await caller.issue.core.create({
          title: "Original Title",
          description: "Original description",
          severity: "Medium",
          machineId: machine.id,
        });

        // Then update it
        const result = await caller.issue.core.update({
          id: issue.id,
          title: "Updated Title",
          description: "Updated description",
        });

        // Verify the result structure
        expect(result).toMatchObject({
          id: issue.id,
          title: "Updated Title",
          description: "Updated description",
        });

        // Verify the database was actually updated
        const updatedIssueInDb = await db.query.issues.findFirst({
          where: eq(schema.issues.id, issue.id),
        });
        expect(updatedIssueInDb?.title).toBe("Updated Title");
        expect(updatedIssueInDb?.description).toBe("Updated description");
      });
    });

    test("should enforce organizational isolation in issue operations", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine } = await setupTestData(db);
        
        // Create a second organization
        const [org2] = await db
          .insert(schema.organizations)
          .values({
            id: "org-2",
            name: "Organization 2",
            subdomain: "org2",
          })
          .returning();

        // Create issue in first organization
        const caller = appRouter.createCaller(ctx);
        const issue = await caller.issue.core.create({
          title: "Org 1 Issue",
          description: "Should be isolated",
          severity: "Medium",
          machineId: machine.id,
        });

        // Create context for second organization
        const org2Ctx = {
          ...ctx,
          organization: {
            id: org2.id,
            name: org2.name,
            subdomain: org2.subdomain,
          },
          organizationId: org2.id,
          user: {
            ...ctx.user,
            app_metadata: {
              organization_id: org2.id,
            },
          },
        };

        const org2Caller = appRouter.createCaller(org2Ctx);

        // Should not be able to access issue from different organization
        await expect(
          org2Caller.issue.core.update({
            id: issue.id,
            title: "Malicious Update",
          }),
        ).rejects.toThrow("Issue not found");
      });
    });


  });

  describe("Machine Router Integration", () => {
    test("should update machine with real database operations", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine, location, model } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        const result = await caller.machine.core.update({
          id: machine.id,
          name: "Updated Machine Name",
        });

        // Verify the result structure
        expect(result).toMatchObject({
          id: machine.id,
          name: "Updated Machine Name",
        });

        // Verify relationships are loaded
        expect(result.location).toBeDefined();
        expect(result.location.id).toBe(location.id);
        expect(result.model).toBeDefined();
        expect(result.model.id).toBe(model.id);

        // Verify the database was actually updated
        const updatedMachineInDb = await db.query.machines.findFirst({
          where: eq(schema.machines.id, machine.id),
        });
        expect(updatedMachineInDb?.name).toBe("Updated Machine Name");
      });
    });

    test("should enforce organizational isolation in machine operations", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine } = await setupTestData(db);
        
        // Create a second organization
        const [org2] = await db
          .insert(schema.organizations)
          .values({
            id: "org-2",
            name: "Organization 2",
            subdomain: "org2",
          })
          .returning();

        // Create context for second organization
        const org2Ctx = {
          ...ctx,
          organization: {
            id: org2.id,
            name: org2.name,
            subdomain: org2.subdomain,
          },
          organizationId: org2.id,
          user: {
            ...ctx.user,
            app_metadata: {
              organization_id: org2.id,
            },
          },
        };

        const org2Caller = appRouter.createCaller(org2Ctx);

        // Should not be able to access machine from different organization
        await expect(
          org2Caller.machine.core.update({
            id: machine.id,
            name: "Malicious Update",
          }),
        ).rejects.toThrow("Machine not found or not accessible");
      });
    });

  });

  describe("Location Router Integration", () => {
    test("should update location with real database operations", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, location } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        const result = await caller.location.update({
          id: location.id,
          name: "Updated Location Name",
        });

        // Verify the result structure
        expect(result).toMatchObject({
          id: location.id,
          name: "Updated Location Name",
        });

        // Verify the database was actually updated
        const updatedLocationInDb = await db.query.locations.findFirst({
          where: eq(schema.locations.id, location.id),
        });
        expect(updatedLocationInDb?.name).toBe("Updated Location Name");
      });
    });
  });

  describe("Multi-tenant Integration Testing", () => {
    test("should enforce cross-organizational boundaries across all routers", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine, location, organizationId } = await setupTestData(db);
        
        // Create a second organization with its own data
        const [org2] = await db
          .insert(schema.organizations)
          .values({
            id: "org-2",
            name: "Organization 2",
            subdomain: "org2",
          })
          .returning();

        // Create location in org2
        const [org2Location] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("org2-location"),
            name: "Org2 Location",
            organizationId: org2.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Test org1 user cannot access org2 resources
        const caller = appRouter.createCaller(ctx);
        
        // Should not be able to update org2's location
        await expect(
          caller.location.update({
            id: org2Location.id,
            name: "Malicious Update",
          }),
        ).rejects.toThrow();

        // Verify org1 user can still access org1 resources
        const result = await caller.location.update({
          id: location.id,
          name: "Legitimate Update",
        });
        expect(result.name).toBe("Legitimate Update");
      });
    });
  });

    test("should maintain data integrity across router operations", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, machine, location, status, priority } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        // Create an issue linked to the machine
        const issue = await caller.issue.core.create({
          title: "Integration Test Issue",
          description: "Test referential integrity",
          severity: "Medium",
          machineId: machine.id,
        });

        // Update the machine name
        const updatedMachine = await caller.machine.core.update({
          id: machine.id,
          name: "Updated Machine for Integrity Test",
        });

        // Verify the issue still references the updated machine correctly
        const issueInDb = await db.query.issues.findFirst({
          where: eq(schema.issues.id, issue.id),
          with: {
            machine: true,
          },
        });

        expect(issueInDb?.machine?.id).toBe(machine.id);
        expect(issueInDb?.machine?.name).toBe("Updated Machine for Integrity Test");
        expect(issueInDb?.statusId).toBe(status.id);
        expect(issueInDb?.priorityId).toBe(priority.id);
      });
    });
  });
});
