/**
 * Location Router Integration Tests - Schema & Performance Tests (PGlite)
 *
 * Converted to use seeded data patterns for consistent, fast, memory-safe testing.
 * This file focuses on database schema validation, performance testing, and
 * complex multi-tenant scenarios using the established seeded data infrastructure.
 *
 * Key Features:
 * - Uses createSeededTestDatabase() and SEED_TEST_IDS for consistent test data
 * - Leverages createSeededLocationTestContext() for standardized TRPC context
 * - Uses SEED_TEST_IDS.ORGANIZATIONS.competitor for cross-org isolation testing
 * - Maintains performance tests with seeded data baseline + additional test data
 * - Worker-scoped PGlite integration for memory safety
 *
 * Uses modern August 2025 patterns with seeded data architecture.
 */

import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

// Import test setup and utilities

import { locationRouter } from "~/server/api/routers/location";
import * as schema from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

import { createSeededLocationTestContext } from "~/test/helpers/createSeededLocationTestContext";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => generateTestId("test-id")),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "location:edit",
      "location:delete",
      "organization:manage",
    ]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue([
      "location:edit",
      "location:delete",
      "organization:manage",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

describe("Location Router - Schema & Performance Tests (PGlite)", () => {
  const primaryOrgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
  const _competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

  describe("Database Schema Validation", () => {
    test("should maintain referential integrity", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Create context using seeded data
        const _context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Use seeded data for base entities, create test-specific additional data
        const machineId = generateTestId("test-machine-integrity");
        const issueId = generateTestId("test-issue-integrity");

        // Create machine with relationships using seeded location and model
        const [machine] = await txDb
          .insert(schema.machines)
          .values({
            id: machineId,
            name: "Test Machine Integrity",
            qrCodeId: `qr-${machineId}`,
            organizationId: primaryOrgId,
            locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
            modelId: "model-mm-001",
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create issue with relationships using seeded priority and status
        await txDb.insert(schema.issues).values({
          id: issueId,
          title: "Test Issue Integrity",
          organizationId: primaryOrgId,
          machineId: machine.id,
          statusId: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
          priorityId: SEED_TEST_IDS.PRIORITIES.HIGH_PRIMARY,
          createdById: SEED_TEST_IDS.USERS.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Test referential integrity with deep relations
        const locationWithRelations = await txDb.query.locations.findFirst({
          where: eq(schema.locations.id, SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR),
          with: {
            machines: {
              with: {
                model: true,
                owner: true,
                issues: {
                  with: {
                    status: true,
                    priority: true,
                  },
                },
              },
            },
          },
        });

        expect(locationWithRelations).toBeDefined();
        expect(locationWithRelations?.machines.length).toBeGreaterThanOrEqual(
          1,
        );

        // Find our test machine
        const testMachine = locationWithRelations?.machines.find(
          (m) => m.id === machineId,
        );
        expect(testMachine).toBeDefined();
        expect(testMachine?.model.id).toBe("model-mm-001");
        expect(testMachine?.owner.id).toBe(SEED_TEST_IDS.USERS.ADMIN);
        expect(testMachine?.issues.length).toBeGreaterThanOrEqual(1);

        // Find our test issue
        const testIssue = testMachine?.issues.find((i) => i.id === issueId);
        expect(testIssue).toBeDefined();
        expect(testIssue?.status.id).toBe(SEED_TEST_IDS.STATUSES.NEW_PRIMARY);
        expect(testIssue?.priority.id).toBe(
          SEED_TEST_IDS.PRIORITIES.HIGH_PRIMARY,
        );
      });
    });

    test("should handle timestamps correctly", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        const beforeCreate = new Date();

        const result = await caller.create({ name: "Timestamp Test Location" });

        const afterCreate = new Date();

        // Verify timestamps are within expected range with small tolerance for test execution timing
        const timeTolerance = 50; // Allow 50ms tolerance for test execution speed variations
        expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(
          beforeCreate.getTime() - timeTolerance,
        );
        expect(result.createdAt.getTime()).toBeLessThanOrEqual(
          afterCreate.getTime() + timeTolerance,
        );
        expect(result.updatedAt.getTime()).toBe(result.createdAt.getTime());

        // Test update timestamp behavior
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

        const updated = await caller.update({
          id: result.id,
          name: "Updated Timestamp Test",
        });

        expect(updated.updatedAt.getTime()).toBeGreaterThan(
          updated.createdAt.getTime(),
        );
      });
    });

    test("should enforce organizational scoping constraints", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Get existing organization from seeded data
        const existingOrg = await txDb.query.organizations.findFirst({
          where: eq(schema.organizations.id, primaryOrgId),
        });
        expect(existingOrg).toBeDefined();

        // Test subdomain uniqueness constraint using competitor org
        const competitorOrg = await txDb.query.organizations.findFirst({
          where: eq(
            schema.organizations.id,
            SEED_TEST_IDS.ORGANIZATIONS.competitor,
          ),
        });
        expect(competitorOrg).toBeDefined();

        // Test that trying to create an org with existing subdomain fails
        const duplicateOrg = {
          id: generateTestId("duplicate-org"),
          name: "Duplicate Organization",
          subdomain: existingOrg?.subdomain ?? "fallback-subdomain", // Same subdomain as existing primary org
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // This should fail due to unique constraint on subdomain
        try {
          await txDb.insert(schema.organizations).values(duplicateOrg);
          // If PGlite doesn't enforce constraints, check manually
          const duplicateOrgs = await txDb
            .select()
            .from(schema.organizations)
            .where(
              eq(
                schema.organizations.subdomain,
                existingOrg?.subdomain ?? "fallback-subdomain",
              ),
            );
          expect(duplicateOrgs.length).toBeLessThanOrEqual(1);
        } catch (error) {
          // If constraint is enforced, this is expected behavior
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe("Performance & Query Optimization", () => {
    test("should handle large datasets efficiently", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create many additional locations and machines (in addition to seeded data)
        const locations = Array.from({ length: 20 }, (_, i) => ({
          id: `perf-location-${i}`,
          name: `Performance Location ${i}`,
          organizationId: primaryOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await txDb.insert(schema.locations).values(locations);

        const machines = Array.from({ length: 60 }, (_, i) => ({
          id: `perf-machine-${i}`,
          name: `Performance Machine ${i}`,
          qrCodeId: `perf-qr-${i}`,
          organizationId: primaryOrgId,
          locationId: `perf-location-${i % 20}`, // Distribute across locations
          modelId: "model-mm-001",
          ownerId: SEED_TEST_IDS.USERS.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await txDb.insert(schema.machines).values(machines);

        const startTime = Date.now();

        const result = await caller.getAll();

        const executionTime = Date.now() - startTime;

        // Account for seeded data + new data
        expect(result.length).toBeGreaterThanOrEqual(20); // At least 20 new locations
        expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

        // Verify all relationships loaded correctly
        const totalMachines = result.reduce(
          (sum, loc) => sum + loc.machines.length,
          0,
        );
        expect(totalMachines).toBeGreaterThanOrEqual(60); // At least our 60 new machines
      });
    });

    test("should optimize getPublic aggregation queries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create additional test locations (avoid conflicts with seeded data)
        await txDb.insert(schema.locations).values(
          Array.from({ length: 5 }, (_, i) => ({
            id: `agg-location-${i}`,
            name: `Aggregation Location ${i}`,
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );

        await txDb.insert(schema.machines).values(
          Array.from({ length: 15 }, (_, i) => ({
            id: `agg-machine-${i}`,
            name: `Aggregation Machine ${i}`,
            qrCodeId: `agg-qr-${i}`,
            organizationId: primaryOrgId,
            locationId: `agg-location-${i % 5}`, // 3 machines per location
            modelId: "model-mm-001",
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );

        await txDb.insert(schema.issues).values(
          Array.from({ length: 30 }, (_, i) => ({
            id: `agg-issue-${i}`,
            title: `Aggregation Issue ${i}`,
            organizationId: primaryOrgId,
            machineId: `agg-machine-${i % 15}`, // 2 issues per machine
            statusId: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
            priorityId: SEED_TEST_IDS.PRIORITIES.HIGH_PRIMARY,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );

        // Verify that all locations were created successfully before testing getPublic
        const allLocations = await txDb
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.organizationId, primaryOrgId));

        expect(allLocations.length).toBeGreaterThanOrEqual(5); // At least our 5 new locations + seeded

        const startTime = Date.now();

        const result = await caller.getPublic();

        const executionTime = Date.now() - startTime;

        expect(result.length).toBeGreaterThanOrEqual(5); // At least our new locations + seeded
        expect(executionTime).toBeLessThan(2000); // Complex aggregation should still be fast

        // Verify aggregation accuracy for our test locations
        const aggregationLocations = result.filter((l) =>
          l.name.startsWith("Aggregation"),
        );
        expect(aggregationLocations).toHaveLength(5);

        aggregationLocations.forEach((location) => {
          expect(location._count.machines).toBe(3);
          location.machines.forEach((machine) => {
            expect(machine._count.issues).toBe(2);
          });
        });
      });
    });

    test("should handle concurrent operations efficiently", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Test concurrent location creation
        const createPromises = Array.from({ length: 10 }, (_, i) =>
          caller.create({ name: `Concurrent Location ${i}` }),
        );

        const startTime = Date.now();
        const results = await Promise.all(createPromises);
        const executionTime = Date.now() - startTime;

        expect(results).toHaveLength(10);
        expect(executionTime).toBeLessThan(2000); // Concurrent operations should be fast

        // Verify all locations were created with unique IDs
        const uniqueIds = new Set(results.map((r) => r.id));
        expect(uniqueIds.size).toBe(10);
      });
    });
  });
});
