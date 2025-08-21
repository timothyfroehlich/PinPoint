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
  getSeededTestData,
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
    const {
      db,
      primaryOrgId: primary,
      secondaryOrgId: competitor,
    } = await createSeededTestDatabase();
    workerDb = db;
    primaryOrgId = primary;
    competitorOrgId = competitor;

    // Get seeded test data for primary organization
    seededData = await getSeededTestData(db, primaryOrgId);
  });

  describe("Issue Router Integration", () => {
    test("should create issue with real database operations", async () => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Create admin context using seeded data
        const context = await createSeededAdminTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = appRouter.createCaller(context);

        const result = await caller.issue.core.create({
          title: "Integration Test Issue",
          description: "Real database test description",
          severity: "Medium",
          machineId: seededData.seededData.machine.id,
        });

        // Verify the result structure
        expect(result).toMatchObject({
          title: "Integration Test Issue",
          description: "Real database test description",
          machineId: seededData.machine.id,
          statusId: seededData.status.id,
          priorityId: seededData.priority.id,
        });

        // Verify relationships are loaded
        expect(result.machine).toBeDefined();
        expect(result.seededData.machine.id).toBe(seededData.machine.id);
        expect(result.status).toBeDefined();
        expect(result.seededData.status.id).toBe(seededData.status.id);
        expect(result.priority).toBeDefined();
        expect(result.seededData.priority.id).toBe(seededData.priority.id);

        // Verify the database was actually updated
        const issueInDb = await txDb.query.issues.findFirst({
          where: eq(schema.issues.id, result.id),
        });
        expect(issueInDb).toBeDefined();
        expect(issueInDb?.title).toBe("Integration Test Issue");
      });
    });

    test("should update issue with real database operations", async () => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededAdminTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = appRouter.createCaller(context);

        // First create an issue
        const issue = await caller.issue.core.create({
          title: "Original Title",
          description: "Original description",
          severity: "Medium",
          machineId: seededData.machine.id,
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
        const updatedIssueInDb = await txDb.query.issues.findFirst({
          where: eq(schema.issues.id, issue.id),
        });
        expect(updatedIssueInDb?.title).toBe("Updated Title");
        expect(updatedIssueInDb?.description).toBe("Updated description");
      });
    });

    test("should enforce organizational isolation in issue operations", async () => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededAdminTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Create a second organization
        const [org2] = await txDb
          .insert(schema.organizations)
          .values({
            id: "org-2",
            name: "Organization 2",
            subdomain: "org2",
          })
          .returning();

        // Create issue in first organization
        const caller = appRouter.createCaller(context);
        const issue = await caller.issue.core.create({
          title: "Org 1 Issue",
          description: "Should be isolated",
          severity: "Medium",
          machineId: seededData.machine.id,
        });

        // Create context for second organization
        const org2Ctx = {
          ...ctx,
          organization: {
            id: org2.id,
            name: org2.name,
            subdomain: org2.subdomain,
          },
          primaryOrgId: org2.id,
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
    test("should update machine with real database operations", async () => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededAdminTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = appRouter.createCaller(context);

        const result = await caller.machine.core.update({
          id: seededData.machine.id,
          name: "Updated Machine Name",
        });

        // Verify the result structure
        expect(result).toMatchObject({
          id: seededData.machine.id,
          name: "Updated Machine Name",
        });

        // Verify relationships are loaded
        expect(result.location).toBeDefined();
        expect(result.seededData.location.id).toBe(seededData.location.id);
        expect(result.model).toBeDefined();
        expect(result.model.id).toBe(seededData.model.id);

        // Verify the database was actually updated
        const updatedMachineInDb = await txDb.query.machines.findFirst({
          where: eq(schema.machines.id, seededData.machine.id),
        });
        expect(updatedMachineInDb?.name).toBe("Updated Machine Name");
      });
    });

    test("should enforce organizational isolation in machine operations", async () => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededAdminTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Create a second organization
        const [org2] = await txDb
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
          primaryOrgId: org2.id,
          user: {
            ...context.user,
            app_metadata: {
              organization_id: org2.id,
            },
          },
        };

        const org2Caller = appRouter.createCaller(org2Ctx);

        // Should not be able to access machine from different organization
        await expect(
          org2Caller.machine.core.update({
            id: seededData.machine.id,
            name: "Malicious Update",
          }),
        ).rejects.toThrow("Machine not found or not accessible");
      });
    });
  });

  describe("Location Router Integration", () => {
    test("should update location with real database operations", async () => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededAdminTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = appRouter.createCaller(context);

        const result = await caller.location.update({
          id: seededData.location.id,
          name: "Updated Location Name",
        });

        // Verify the result structure
        expect(result).toMatchObject({
          id: seededData.location.id,
          name: "Updated Location Name",
        });

        // Verify the database was actually updated
        const updatedLocationInDb = await txDb.query.locations.findFirst({
          where: eq(schema.locations.id, seededData.location.id),
        });
        expect(updatedLocationInDb?.name).toBe("Updated Location Name");
      });
    });
  });

  describe("Multi-tenant Integration Testing", () => {
    test("should enforce cross-organizational boundaries across all routers", async () => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededAdminTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Create a second organization with its own data
        const [org2] = await txDb
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
            primaryOrgId: org2.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Test org1 user cannot access org2 resources
        const caller = appRouter.createCaller(context);

        // Should not be able to update org2's location
        await expect(
          caller.location.update({
            id: org2Location.id,
            name: "Malicious Update",
          }),
        ).rejects.toThrow();

        // Verify org1 user can still access org1 resources
        const result = await caller.location.update({
          id: seededData.location.id,
          name: "Legitimate Update",
        });
        expect(result.name).toBe("Legitimate Update");
      });
    });
  });

  test("should maintain data integrity across router operations", async () => {
    await withIsolatedTest(workerDb, async (txDb) => {
      const context = await createSeededAdminTestContext(
        txDb,
        primaryOrgId,
        SEED_TEST_IDS.USERS.ADMIN,
      );
      const caller = appRouter.createCaller(context);

      // Create an issue linked to the machine
      const issue = await caller.issue.core.create({
        title: "Integration Test Issue",
        description: "Test referential integrity",
        severity: "Medium",
        machineId: seededData.machine.id,
      });

      // Update the machine name
      const updatedMachine = await caller.machine.core.update({
        id: seededData.machine.id,
        name: "Updated Machine for Integrity Test",
      });

      // Verify the issue still references the updated machine correctly
      const issueInDb = await txDb.query.issues.findFirst({
        where: eq(schema.issues.id, issue.id),
        with: {
          machine: true,
        },
      });

      expect(issueInDb?.machine?.id).toBe(seededData.machine.id);
      expect(issueInDb?.machine?.name).toBe(
        "Updated Machine for Integrity Test",
      );
      expect(issueInDb?.statusId).toBe(seededData.status.id);
      expect(issueInDb?.priorityId).toBe(seededData.priority.id);
    });
  });
});
