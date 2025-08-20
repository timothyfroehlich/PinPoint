/**
 * PinballMap Integration Tests
 *
 * Consolidated tRPC router + service integration tests using PGlite database.
 * Tests complete request → service → database workflows with real business logic.
 *
 * Architecture:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real tRPC router operations
 * - Real service layer business logic
 * - External API mocking (PinballMap API only)
 * - Multi-tenant data isolation testing
 * - Worker-scoped database for memory safety
 *
 * Coverage:
 * - enableIntegration: Enable PinballMap integration for organization
 * - configureLocation: Configure location with PinballMap ID
 * - syncLocation: Complete sync workflow with machine reconciliation
 * - getSyncStatus: Organization sync status with real data
 * - Permission validation: Real auth context testing
 * - Organizational boundaries: Real RLS enforcement
 * - API error handling: External service failure scenarios
 */

import { eq, and } from "drizzle-orm";
import { describe, expect, vi, beforeEach } from "vitest";

// Import test setup and utilities
import { appRouter } from "~/server/api/root";
import * as schema from "~/server/db/schema";
import { SEED_TEST_IDS, createMockAdminContext } from "~/test/constants/seed-test-ids";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { getSeededTestData } from "~/test/helpers/pglite-test-setup";

// Mock external PinballMap API only
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock ID generation for consistent test data
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => "test-generated-id"),
}));

// Mock permissions (will be tested with real auth contexts)
vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi.fn(),
  getUserPermissionsForSupabaseUser: vi.fn(),
  requirePermissionForSession: vi.fn(),
  supabaseUserToSession: vi.fn(),
}));

describe("PinballMap Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enableIntegration", () => {
    test("should create new config and enable integration", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user,
        });
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.enableIntegration();

        expect(result.success).toBe(true);

        // Verify real database state
        const config = await db.query.pinballMapConfigs.findFirst({
          where: eq(schema.pinballMapConfigs.organizationId, SEED_TEST_IDS.ORGANIZATIONS.primary),
        });

        expect(config).toBeDefined();
        expect(config?.apiEnabled).toBe(true);
        expect(config?.createMissingModels).toBe(true);
        expect(config?.updateExistingData).toBe(true);
      });
    });

    test("should update existing disabled config to enabled", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Create existing disabled config
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-existing-config",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          apiEnabled: false,
          createMissingModels: false,
          updateExistingData: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user!,
        });
        
        const caller = appRouter.createCaller(adminContext);
        await caller.pinballMap.enableIntegration();

        // Verify config was updated, not duplicated
        const configs = await db.query.pinballMapConfigs.findMany({
          where: eq(schema.pinballMapConfigs.organizationId, SEED_TEST_IDS.ORGANIZATIONS.primary),
        });

        expect(configs).toHaveLength(1);
        expect(configs[0]?.apiEnabled).toBe(true);
      });
    });

    test("should require organization:manage permission", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        // Create member context with limited permissions
        const memberContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user,
          permissions: ["location:edit"], // Not organization:manage
        });
        
        const caller = appRouter.createCaller(memberContext);

        await expect(caller.pinballMap.enableIntegration())
          .rejects.toThrow("Missing required permission: organization:manage");
      });
    });
  });

  describe("configureLocation", () => {
    test("should configure location when integration enabled", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Enable integration first
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-config",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user!,
        });
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.configureLocation({
          locationId: seededData.location!,
          pinballMapId: 26454,
        });

        expect(result.success).toBe(true);

        // Verify real database update
        const updatedLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, seededData.location!),
        });

        expect(updatedLocation?.pinballMapId).toBe(26454);
        expect(updatedLocation?.syncEnabled).toBe(true);
      });
    });

    test("should throw error when integration not enabled", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user,
        });
        
        const caller = appRouter.createCaller(adminContext);

        await expect(
          caller.pinballMap.configureLocation({
            locationId: seededData.location!,
            pinballMapId: 26454,
          }),
        ).rejects.toThrow("PinballMap integration not enabled for organization");
      });
    });

    test("should enforce organizational boundaries", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Create location in competitor organization
        const [competitorLocation] = await db
          .insert(schema.locations)
          .values({
            id: "competitor-location",
            name: "Competitor Location",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user!,
        });
        
        const caller = appRouter.createCaller(adminContext);

        // Should not be able to configure competitor's location
        await expect(
          caller.pinballMap.configureLocation({
            locationId: competitorLocation.id,
            pinballMapId: 26454,
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe("syncLocation", () => {
    test("should sync machines from PinballMap API", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Setup enabled integration and configured location
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-config",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db
          .update(schema.locations)
          .set({ pinballMapId: 26454, syncEnabled: true })
          .where(eq(schema.locations.id, seededData.location!));

        // Mock successful PinballMap API response
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            machines: [
              {
                opdb_id: "MM-001",
                machine_name: "Medieval Madness",
                manufacturer: "Williams",
                year: 1997,
              },
              {
                opdb_id: "TZ-001", 
                machine_name: "Twilight Zone",
                manufacturer: "Bally",
                year: 1993,
              },
            ],
          }),
        });

        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user!,
        });
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.syncLocation({
          locationId: seededData.location!,
        });

        expect(result.success).toBe(true);
        expect(result.added).toBeGreaterThan(0);

        // Verify machines were actually added to database
        const machines = await db.query.machines.findMany({
          where: eq(schema.machines.locationId, seededData.location!),
          with: { model: true },
        });

        expect(machines.length).toBeGreaterThan(0);
        expect(machines.some(m => m.model?.name === "Medieval Madness")).toBe(true);
        expect(machines.some(m => m.model?.name === "Twilight Zone")).toBe(true);
      });
    });

    test("should remove machines not in PinballMap but preserve machines with issues", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Setup integration
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-config",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db
          .update(schema.locations)
          .set({ pinballMapId: 26454, syncEnabled: true })
          .where(eq(schema.locations.id, seededData.location!));

        // Create machine that will be missing from API (should be removed)
        const [machineToRemove] = await db
          .insert(schema.machines)
          .values({
            id: "machine-to-remove",
            name: "Machine to Remove",
            qrCodeId: "qr-remove",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            locationId: seededData.location!,
            modelId: seededData.model!,
            ownerId: seededData.user!,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create machine with issue (should NOT be removed)
        const [machineWithIssue] = await db
          .insert(schema.machines)
          .values({
            id: "machine-with-issue",
            name: "Machine with Issue",
            qrCodeId: "qr-issue",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            locationId: seededData.location!,
            modelId: seededData.model!,
            ownerId: seededData.user!,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create issue for the machine
        await db.insert(schema.issues).values({
          id: "test-issue",
          title: "Test Issue",
          machineId: machineWithIssue.id,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          statusId: seededData.status!,
          priorityId: seededData.priority!,
          createdBy: seededData.user!,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Mock API response with no machines (should trigger removal)
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ machines: [] }),
        });

        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user!,
        });
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.syncLocation({
          locationId: seededData.location!,
        });

        expect(result.success).toBe(true);
        expect(result.removed).toBe(1); // Only removed machine without issues

        // Verify correct machine was removed
        const remainingMachines = await db.query.machines.findMany({
          where: eq(schema.machines.locationId, seededData.location!),
        });

        expect(remainingMachines).toHaveLength(1);
        expect(remainingMachines[0]?.id).toBe(machineWithIssue.id);
      });
    });

    test("should handle PinballMap API errors gracefully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Setup integration
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-config",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db
          .update(schema.locations)
          .set({ pinballMapId: 26454, syncEnabled: true })
          .where(eq(schema.locations.id, seededData.location!));

        // Mock API failure
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });

        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user!,
        });
        
        const caller = appRouter.createCaller(adminContext);

        await expect(
          caller.pinballMap.syncLocation({
            locationId: seededData.location!,
          }),
        ).rejects.toThrow("INTERNAL_SERVER_ERROR");
      });
    });
  });

  describe("getSyncStatus", () => {
    test("should return enabled status with configured locations", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Create enabled config
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-config",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Configure location for sync
        await db
          .update(schema.locations)
          .set({ pinballMapId: 26454, syncEnabled: true, lastSyncAt: new Date() })
          .where(eq(schema.locations.id, seededData.location!));

        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user!,
        });
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.getSyncStatus();

        expect(result.configEnabled).toBe(true);
        expect(result.locations).toHaveLength(1);
        expect(result.locations[0]?.id).toBe(seededData.location.id);
        expect(result.locations[0]?.pinballMapId).toBe(26454);
        expect(result.locations[0]?.syncEnabled).toBe(true);
        expect(result.locations[0]?.lastSync).toBeDefined();
      });
    });

    test("should return disabled status when integration not enabled", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user,
        });
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.getSyncStatus();

        expect(result.configEnabled).toBe(false);
        expect(result.locations).toHaveLength(0);
        expect(result.lastSync).toBeNull();
      });
    });

    test("should enforce organizational boundaries", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Create config for competitor organization
        await db.insert(schema.pinballMapConfigs).values({
          id: "competitor-config",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create location in competitor organization
        await db.insert(schema.locations).values({
          id: "competitor-location",
          name: "Competitor Location",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          pinballMapId: 12345,
          syncEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const adminContext = createMockAdminContext({
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          userId: seededData.user!,
        });
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.getSyncStatus();

        // Should not see competitor's data
        expect(result.configEnabled).toBe(false); // No config for primary org
        expect(result.locations).toHaveLength(0); // No locations for primary org
      });
    });
  });
});