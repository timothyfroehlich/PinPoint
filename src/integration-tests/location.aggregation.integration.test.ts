/**
 * Location Router Aggregation Integration Tests (PGlite)
 *
 * Integration tests for complex aggregation queries on the location router.
 * Tests getPublic endpoint with machine counts, issue counts, and multi-tenant isolation.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complex aggregation and count queries
 * - Multi-tenant data isolation testing
 * - Machine and issue count validation
 * - Resolved vs unresolved issue filtering
 *
 * Uses modern August 2025 patterns with worker-scoped PGlite integration.
 */
import { eq, count, and, ne } from "drizzle-orm";
import { beforeAll, describe, expect, vi } from "vitest";
// Import test setup and utilities
import { locationRouter } from "~/server/api/routers/location";
import * as schema from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import {
  createSeededTestDatabase,
  getSeededTestData,
  SEED_TEST_IDS,
} from "~/test/helpers/pglite-test-setup";
import {
  createSeededLocationTestContext,
  createCompetitorAdminContext,
} from "~/test/helpers/createSeededLocationTestContext";
// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => generateTestId("test-id")),
}));
// Removed permission mocks to use real membership-based scoping from seeds
describe("Location Router Aggregation Operations (PGlite)", () => {
  describe("getPublic - Aggregation Queries", () => {
    test("should return locations with accurate machine and issue counts", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set up seeded data for this test
        const { organizationId: primaryOrgId } =
          await createSeededTestDatabase(db);
        const seeded = await getSeededTestData(db, primaryOrgId);

        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create machines for location1
        await db.insert(schema.machines).values([
          {
            id: "machine-1-agg",
            name: "Machine 1",
            qrCodeId: "qr-1-agg",
            organizationId: primaryOrgId,
            locationId: seeded.location,
            modelId: seeded.model,
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "machine-2-agg",
            name: "Machine 2",
            qrCodeId: "qr-2-agg",
            organizationId: primaryOrgId,
            locationId: seeded.location,
            modelId: seeded.model,
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Create another location for testing
        const [location2] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("test-location-2-agg"),
            name: "Secondary Location",
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create one machine for location2
        await db.insert(schema.machines).values({
          id: "machine-3-agg",
          name: "Machine 3",
          qrCodeId: "qr-3-agg",
          organizationId: primaryOrgId,
          locationId: location2.id,
          modelId: seeded.model,
          ownerId: SEED_TEST_IDS.USERS.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create issues for machines
        await db.insert(schema.issues).values([
          {
            id: "issue-1-agg",
            title: "Issue 1",
            organizationId: primaryOrgId,
            machineId: "machine-1-agg",
            statusId: seeded.status,
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "issue-2-agg",
            title: "Issue 2",
            organizationId: primaryOrgId,
            machineId: "machine-1-agg",
            statusId: seeded.status,
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "issue-3-agg",
            title: "Issue 3",
            organizationId: primaryOrgId,
            machineId: "machine-3-agg",
            statusId: seeded.status,
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.getPublic();
        expect(result).toHaveLength(2);

        // Find locations
        const mainArcade = result.find((l) => l.id === seeded.location);
        const secondaryLocation = result.find((l) => l.id === location2.id);

        expect(mainArcade).toBeDefined();
        expect(secondaryLocation).toBeDefined();

        if (!mainArcade || !secondaryLocation) {
          throw new Error("Test locations not found");
        }

        // Verify machine counts
        expect(mainArcade._count.machines).toBe(2);
        expect(secondaryLocation._count.machines).toBe(1);

        // Verify machine details with model relationships
        expect(mainArcade.machines).toHaveLength(2);
        expect(mainArcade.machines[0].model).toBeDefined();

        // Verify issue counts
        const machine1 = mainArcade.machines.find(
          (m) => m.id === "machine-1-agg",
        );
        const machine3 = secondaryLocation.machines.find(
          (m) => m.id === "machine-3-agg",
        );

        expect(machine1?._count.issues).toBe(2);
        expect(machine3?._count.issues).toBe(1);
      });
    });

    test("should filter out resolved issues from counts", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create a resolved status for testing
        const [resolvedStatus] = await db
          .insert(schema.issueStatuses)
          .values({
            id: "status-resolved-agg",
            name: "Resolved",
            category: "RESOLVED",
            organizationId: primaryOrgId,
          })
          .returning();

        // Create a machine
        const [machine] = await db
          .insert(schema.machines)
          .values({
            id: "machine-filter-agg",
            name: "Machine Filter",
            qrCodeId: "qr-filter-agg",
            organizationId: primaryOrgId,
            locationId: seeded.location,
            modelId: seeded.model,
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create mix of resolved and unresolved issues
        await db.insert(schema.issues).values([
          {
            id: "issue-unresolved-1",
            title: "Unresolved Issue 1",
            organizationId: primaryOrgId,
            machineId: machine.id,
            statusId: seeded.status, // OPEN status
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "issue-unresolved-2",
            title: "Unresolved Issue 2",
            organizationId: primaryOrgId,
            machineId: machine.id,
            statusId: seeded.status, // OPEN status
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "issue-resolved",
            title: "Resolved Issue",
            organizationId: primaryOrgId,
            machineId: machine.id,
            statusId: resolvedStatus.id, // RESOLVED status
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Get total issues count for verification
        const totalIssues = await db
          .select({ count: count() })
          .from(schema.issues)
          .where(eq(schema.issues.machineId, machine.id));

        const unresolvedIssues = await db
          .select({ count: count() })
          .from(schema.issues)
          .innerJoin(
            schema.issueStatuses,
            eq(schema.issues.statusId, schema.issueStatuses.id),
          )
          .where(
            and(
              eq(schema.issues.machineId, machine.id),
              ne(schema.issueStatuses.category, "RESOLVED"),
            ),
          );

        // Verify we have some issues and that resolved filtering works
        expect(totalIssues[0].count).toBe(3);
        expect(unresolvedIssues[0].count).toBe(2);

        // The public endpoint should only count unresolved issues
        const result = await caller.getPublic();
        const testLocation = result.find((l) => l.id === seeded.location);
        expect(testLocation).toBeDefined();
        if (!testLocation)
          throw new Error("Test location not found in results");

        const machineWithIssues = testLocation.machines.find(
          (m) => m.id === machine.id,
        );
        if (machineWithIssues) {
          expect(machineWithIssues._count.issues).toBe(2); // Should filter out resolved issue
        }
      });
    });

    test("should work without authentication", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set up seeded data for this test
        const { organizationId: primaryOrgId } =
          await createSeededTestDatabase(db);
        const seeded = await getSeededTestData(db, primaryOrgId);

        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Create another location for testing
        const [location2] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("test-location-2-public"),
            name: "Public Location 2",
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create machines for both locations
        await db.insert(schema.machines).values([
          {
            id: "machine-public-agg-1",
            name: "Public Machine 1",
            qrCodeId: "qr-public-agg-1",
            organizationId: primaryOrgId,
            locationId: seeded.location,
            modelId: seeded.model,
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "machine-public-agg-2",
            name: "Public Machine 2",
            qrCodeId: "qr-public-agg-2",
            organizationId: primaryOrgId,
            locationId: location2.id,
            modelId: seeded.model,
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const publicContext = {
          ...context,
          user: null, // No user authentication
        };

        const publicCaller = locationRouter.createCaller(publicContext as any);
        const result = await publicCaller.getPublic();

        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty("_count");
        expect(result[0]).toHaveProperty("machines");
      });
    });

    test("should maintain organizational scoping in all subqueries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create competitor org context and data
        await createCompetitorAdminContext(db);

        // Create location in competitor org
        await db.insert(schema.locations).values({
          id: "other-location",
          name: "Other Location",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.machines).values({
          id: "other-machine",
          name: "Other Machine",
          qrCodeId: "other-qr",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          locationId: "other-location",
          modelId: seeded.model,
          ownerId: SEED_TEST_IDS.USERS.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Add many issues to the other org's machine
        await db.insert(schema.issues).values([
          {
            id: "other-issue-1",
            title: "Other Issue 1",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            machineId: "other-machine",
            statusId: seeded.status,
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "other-issue-2",
            title: "Other Issue 2",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            machineId: "other-machine",
            statusId: seeded.status,
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Create another location in primary org for comparison
        const [location2] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("test-location-scope-2"),
            name: "Our Location 2",
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create machines in both our locations for comparison
        await db.insert(schema.machines).values([
          {
            id: "our-machine-scope-1",
            name: "Our Machine 1",
            qrCodeId: "our-qr-1",
            organizationId: primaryOrgId,
            locationId: seeded.location,
            modelId: seeded.model,
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "our-machine-scope-2",
            name: "Our Machine 2",
            qrCodeId: "our-qr-2",
            organizationId: primaryOrgId,
            locationId: location2.id,
            modelId: seeded.model,
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        await db.insert(schema.issues).values([
          {
            id: "our-issue-scope-1",
            title: "Our Issue 1",
            organizationId: primaryOrgId,
            machineId: "our-machine-scope-1",
            statusId: seeded.status,
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "our-issue-scope-2",
            title: "Our Issue 2",
            organizationId: primaryOrgId,
            machineId: "our-machine-scope-2",
            statusId: seeded.status,
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.getPublic();

        // Should only see our organization's data
        expect(result).toHaveLength(2); // Only our 2 locations
        expect(result.every((l) => l.id !== "other-location")).toBe(true);

        // Verify counts aren't affected by other org's data
        const testLocation = result.find((l) => l.id === seeded.location);
        expect(testLocation).toBeDefined();
        if (!testLocation)
          throw new Error("Test location not found in results");

        // Should see our machine with our issue, not affected by other org's issues
        const ourMachine = testLocation.machines.find(
          (m) => m.id === "our-machine-scope-1",
        );
        expect(ourMachine?._count.issues).toBe(1); // Should not include other org's issues
      });
    });
  });

  describe("Complex Multi-Tenant Aggregation Scenarios", () => {
    test("should maintain org boundaries in complex cross-join scenarios", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create competitor organization data using SEED_TEST_IDS
        const competitorContext = await createCompetitorAdminContext(db);

        // Create multiple locations in both orgs with identical patterns
        const locations = [
          // Primary org locations
          {
            id: "primary-loc-1",
            name: "Primary Location 1",
            organizationId: primaryOrgId,
          },
          {
            id: "primary-loc-2",
            name: "Primary Location 2",
            organizationId: primaryOrgId,
          },
          // Competitor org locations
          {
            id: "competitor-loc-1",
            name: "Competitor Location 1",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          },
          {
            id: "competitor-loc-2",
            name: "Competitor Location 2",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          },
        ];

        await db.insert(schema.locations).values(
          locations.map((loc) => ({
            ...loc,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );

        // Create machines in all locations
        const machines = [
          // Primary org machines
          {
            id: "primary-machine-1",
            organizationId: primaryOrgId,
            locationId: "primary-loc-1",
          },
          {
            id: "primary-machine-2",
            organizationId: primaryOrgId,
            locationId: "primary-loc-2",
          },
          // Competitor org machines (more of them to test isolation)
          {
            id: "competitor-machine-1",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            locationId: "competitor-loc-1",
          },
          {
            id: "competitor-machine-2",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            locationId: "competitor-loc-2",
          },
          {
            id: "competitor-machine-3",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            locationId: "competitor-loc-2", // Multiple machines per location
          },
        ];

        await db.insert(schema.machines).values(
          machines.map((machine) => ({
            ...machine,
            name: `Machine ${machine.id}`,
            qrCodeId: `qr-${machine.id}`,
            modelId: seeded.model,
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );

        // Create many issues in competitor org to test isolation
        const issues = [];
        for (let i = 1; i <= 10; i++) {
          issues.push({
            id: `competitor-issue-${i}`,
            title: `Competitor Issue ${i}`,
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            machineId: "competitor-machine-1",
            statusId: seeded.status,
            priorityId: seeded.priority,
            createdById: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // Add a few issues to primary org
        issues.push({
          id: "primary-issue-1",
          title: "Primary Issue 1",
          organizationId: primaryOrgId,
          machineId: "primary-machine-1",
          statusId: seeded.status,
          priorityId: seeded.priority,
          createdById: SEED_TEST_IDS.USERS.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.issues).values(issues);

        // Test primary org caller - should only see primary org data
        const primaryResult = await caller.getPublic();

        // Verify isolation: should only see primary org locations
        expect(primaryResult).toHaveLength(3); // seeded location + 2 new primary locations
        expect(
          primaryResult.every(
            (l) => l.id.includes("primary") || l.id === seeded.location,
          ),
        ).toBe(true);
        expect(primaryResult.some((l) => l.id.includes("competitor"))).toBe(
          false,
        );

        // Verify machine counts are correct and not inflated by competitor data
        const primaryLoc1 = primaryResult.find((l) => l.id === "primary-loc-1");
        const primaryLoc2 = primaryResult.find((l) => l.id === "primary-loc-2");

        expect(primaryLoc1?._count.machines).toBe(1);
        expect(primaryLoc2?._count.machines).toBe(1);

        // Verify issue counts don't include competitor issues
        const primaryMachine = primaryLoc1?.machines.find(
          (m) => m.id === "primary-machine-1",
        );
        expect(primaryMachine?._count.issues).toBe(1); // Should not see 10 competitor issues

        // Test competitor org caller for comparison
        const competitorCaller = locationRouter.createCaller(competitorContext);
        const competitorResult = await competitorCaller.getPublic();

        // Should only see competitor org data
        expect(competitorResult).toHaveLength(2); // Only competitor locations
        expect(competitorResult.every((l) => l.id.includes("competitor"))).toBe(
          true,
        );
        expect(competitorResult.some((l) => l.id.includes("primary"))).toBe(
          false,
        );

        // Verify competitor has more machines/issues
        const competitorLoc2 = competitorResult.find(
          (l) => l.id === "competitor-loc-2",
        );
        expect(competitorLoc2?._count.machines).toBe(2); // Should have 2 machines

        const competitorMachine1 = competitorResult
          .find((l) => l.id === "competitor-loc-1")
          ?.machines.find((m) => m.id === "competitor-machine-1");
        expect(competitorMachine1?._count.issues).toBe(10); // All competitor issues
      });
    });
  });

  describe("Performance and Edge Cases", () => {
    test("should handle locations with no machines efficiently", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create several locations with no machines
        await db.insert(schema.locations).values([
          {
            id: "empty-loc-1",
            name: "Empty Location 1",
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "empty-loc-2",
            name: "Empty Location 2",
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "empty-loc-3",
            name: "Empty Location 3",
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.getPublic();

        // Should include all locations, even empty ones
        expect(result).toHaveLength(4); // seeded location + 3 empty locations

        const emptyLocations = result.filter((l) => l.id.startsWith("empty-"));
        expect(emptyLocations).toHaveLength(3);

        // Empty locations should have zero counts
        emptyLocations.forEach((loc) => {
          expect(loc._count.machines).toBe(0);
          expect(loc.machines).toHaveLength(0);
        });
      });
    });

    test("should handle machines with no issues efficiently", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create machines without issues
        await db.insert(schema.machines).values([
          {
            id: "no-issues-machine-1",
            name: "Machine Without Issues 1",
            qrCodeId: "qr-no-issues-1",
            organizationId: primaryOrgId,
            locationId: seeded.location,
            modelId: seeded.model,
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "no-issues-machine-2",
            name: "Machine Without Issues 2",
            qrCodeId: "qr-no-issues-2",
            organizationId: primaryOrgId,
            locationId: seeded.location,
            modelId: seeded.model,
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.getPublic();
        const testLocation = result.find((l) => l.id === seeded.location);

        expect(testLocation).toBeDefined();
        if (!testLocation) throw new Error("Test location not found");

        // Should have machines
        expect(testLocation._count.machines).toBe(2);
        expect(testLocation.machines).toHaveLength(2);

        // All machines should have zero issue counts
        testLocation.machines.forEach((machine) => {
          expect(machine._count.issues).toBe(0);
        });
      });
    });
  });
});
