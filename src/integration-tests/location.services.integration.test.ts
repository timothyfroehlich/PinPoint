/**
 * Location Router Services Integration Tests (PGlite)
 *
 * Converted to use seeded data patterns for consistent, fast, memory-safe testing.
 * Tests external service integrations on the location router, particularly
 * PinballMap synchronization and service failure scenarios using established
 * seeded data infrastructure.
 *
 * Key Features:
 * - Uses createSeededTestDatabase() and SEED_TEST_IDS for consistent test data
 * - Leverages createSeededLocationTestContext() for standardized TRPC context
 * - Uses SEED_TEST_IDS.ORGANIZATIONS.competitor for cross-org isolation testing
 * - Maintains service integration testing with enhanced mocking
 * - Worker-scoped PGlite integration for memory safety
 *
 * Uses modern August 2025 patterns with seeded data architecture.
 */

import { describe, expect, vi } from "vitest";

// Import test setup and utilities

import { locationRouter } from "~/server/api/routers/location";
import * as schema from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createSeededLocationTestContext } from "~/test/helpers/createSeededLocationTestContext";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => generateTestId("test-id")),
}));

// Removed permission mocks to use real membership-based scoping from seeds

describe("Location Router Services Integration (PGlite)", () => {
  const primaryOrgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
  const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

  describe("syncWithPinballMap", () => {
    test("should handle successful sync with service integration", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Verify PinballMap service is mocked correctly
        expect(context.services.createPinballMapService).toBeDefined();

        const result = await caller.syncWithPinballMap({
          locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        });

        expect(result).toEqual({
          success: true,
          data: { synced: true, machinesUpdated: 2 },
        });

        // Verify service was called with correct parameters
        expect(context.services.createPinballMapService).toHaveBeenCalled();
      });
    });

    test("should handle service failures appropriately", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Override the mock to simulate failure
        context.services.createPinballMapService = vi.fn(() => ({
          syncLocation: vi
            .fn()
            .mockRejectedValue(new Error("Service unavailable")),
        }));

        const caller = locationRouter.createCaller(context);

        await expect(
          caller.syncWithPinballMap({
            locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
          }),
        ).rejects.toThrow("Service unavailable");
      });
    });

    test("should prevent cross-organizational sync attempts", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Create contexts for both organizations
        const primaryContext = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const primaryCaller = locationRouter.createCaller(primaryContext);

        const _competitorContext = await createSeededLocationTestContext(
          txDb,
          competitorOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Create a location in competitor org
        const [competitorLocation] = await txDb
          .insert(schema.locations)
          .values({
            id: generateTestId("competitor-location"),
            name: "Competitor Location",
            organizationId: competitorOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Primary org should not be able to sync competitor org location
        await expect(
          primaryCaller.syncWithPinballMap({
            locationId: competitorLocation.id,
          }),
        ).rejects.toThrow(); // Should fail due to organizational boundary
      });
    });
  });

  describe("Service Integration Patterns", () => {
    test("should maintain service isolation between organizations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Create contexts for both organizations
        const primaryContext = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        const competitorContext = await createSeededLocationTestContext(
          txDb,
          competitorOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Verify that each context has isolated service instances
        expect(primaryContext.services.createPinballMapService).not.toBe(
          competitorContext.services.createPinballMapService,
        );

        // Each organization should get fresh service mocks
        expect(primaryContext.services.createPinballMapService).toBeTypeOf(
          "function",
        );
        expect(competitorContext.services.createPinballMapService).toBeTypeOf(
          "function",
        );
      });
    });

    test("should handle service dependency injection correctly", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Verify all required services are available
        expect(context.services.createPinballMapService).toBeDefined();
        expect(context.services.createNotificationService).toBeDefined();
        expect(context.services.createCollectionService).toBeDefined();
        expect(context.services.createIssueActivityService).toBeDefined();
        expect(context.services.createCommentCleanupService).toBeDefined();
        expect(context.services.createQRCodeService).toBeDefined();

        // Service injection should work correctly for all operations
        const caller = locationRouter.createCaller(context);
        const result = await caller.syncWithPinballMap({
          locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        });

        expect(result.success).toBe(true);
      });
    });
  });
});
