/**
 * Location Router Aggregation Integration Tests (PGlite)
 *
 * Converted to use seeded data patterns for consistent, fast, memory-safe testing.
 * Tests complex aggregation queries on the location router, particularly getPublic
 * endpoint with machine counts, issue counts, and multi-tenant isolation using
 * established seeded data infrastructure.
 *
 * Key Features:
 * - Uses createSeededTestDatabase() and SEED_TEST_IDS for consistent test data
 * - Leverages createSeededLocationTestContext() for standardized TRPC context
 * - Uses SEED_TEST_IDS.ORGANIZATIONS.competitor for cross-org isolation testing
 * - Maintains aggregation testing with seeded data baseline + additional test data
 * - Worker-scoped PGlite integration for memory safety
 *
 * Uses modern August 2025 patterns with seeded data architecture.
 */
import { eq, count, and, ne } from "drizzle-orm";
import { describe, expect, vi, beforeAll } from "vitest";

// Import test setup and utilities
import { locationRouter } from "~/server/api/routers/location";
import * as schema from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import {
  createSeededTestDatabase,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
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
  let workerDb: TestDatabase;
  let primaryOrgId: string;
  let competitorOrgId: string;
  // Using deterministic SEED_TEST_IDS directly

  beforeAll(async () => {
    // Create seeded test database with established infrastructure
    const setup = await createSeededTestDatabase();
    workerDb = setup.db;
    primaryOrgId = setup.organizationId;
    competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

    // no-op: tests will reference SEED_TEST_IDS directly
  });

  describe("Complex Aggregation Queries", () => {
    test("should handle getPublic with machine and issue counts", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Use global seededData from beforeAll
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.MEMBER1,
        );
        const caller = locationRouter.createCaller(context);

        // Create additional test data for aggregation
        const testLocationId = generateTestId("agg-test-location");
        const [testLocation] = await txDb
          .insert(schema.locations)
          .values({
            id: testLocationId,
            name: "Aggregation Test Location",
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create machines for testing
        const testMachines = Array.from({ length: 3 }, (_, i) => ({
          id: `agg-machine-${i}`,
          name: `Aggregation Machine ${i}`,
          qrCodeId: `agg-qr-${i}`,
          organizationId: primaryOrgId,
          locationId: testLocation.id,
          modelId: SEED_TEST_IDS.MOCK_PATTERNS.MODEL,
          ownerId: SEED_TEST_IDS.USERS.MEMBER1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await txDb.insert(schema.machines).values(testMachines);

        // Create issues for aggregation testing
        const testIssues = Array.from({ length: 6 }, (_, i) => ({
          id: `agg-issue-${i}`,
          title: `Aggregation Issue ${i}`,
          organizationId: primaryOrgId,
          machineId: `agg-machine-${i % 3}`, // 2 issues per machine
          statusId: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
          priorityId: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
          createdById: SEED_TEST_IDS.USERS.MEMBER1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await txDb.insert(schema.issues).values(testIssues);

        const result = await caller.getPublic();

        // Should include at least our test location + seeded locations
        expect(result.length).toBeGreaterThanOrEqual(1);

        // Find our test location in results
        const testLocationResult = result.find((l) => l.id === testLocation.id);
        expect(testLocationResult).toBeDefined();

        // Verify aggregation counts
        expect(testLocationResult!._count.machines).toBe(3);
        testLocationResult!.machines.forEach((machine) => {
          expect(machine._count.issues).toBe(2); // 2 issues per machine
        });
      });
    });

    test("should maintain organizational isolation in aggregation", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Use global seededData from beforeAll

        // Create contexts for both organizations
        const primaryContext = await createSeededLocationTestContext(
          txDb,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          SEED_TEST_IDS.USERS.MEMBER1,
        );
        const primaryCaller = locationRouter.createCaller(primaryContext);

        const competitorContext = await createSeededLocationTestContext(
          txDb,
          SEED_TEST_IDS.ORGANIZATIONS.competitor,
          SEED_TEST_IDS.USERS.MEMBER2,
        );
        const competitorCaller = locationRouter.createCaller(competitorContext);

        // Create test location in competitor org
        await txDb.insert(schema.locations).values({
          id: "competitor-agg-location",
          name: "Competitor Aggregation Location",
          organizationId: competitorOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const primaryResults = await primaryCaller.getPublic();
        const competitorResults = await competitorCaller.getPublic();

        // Primary org should not see competitor locations
        const primaryLocationIds = primaryResults.map((l) => l.id);
        expect(primaryLocationIds).not.toContain("competitor-agg-location");

        // Competitor org should see its location but not primary's seeded location
        const competitorLocationIds = competitorResults.map((l) => l.id);
        expect(competitorLocationIds).toContain("competitor-agg-location");
        expect(competitorLocationIds).not.toContain(
          SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        );
      });
    });
  });
});
