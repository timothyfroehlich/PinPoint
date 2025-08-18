/**
 * Model OPDB Router Integration Tests (PGlite)
 *
 * Integration tests for the model.opdb router using PGlite in-memory PostgreSQL database.
 * Tests real database operations with OPDB integration, mocked external API, and data integrity.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real Drizzle ORM operations
 * - Mocked OPDB external API calls
 * - Multi-tenant data isolation testing
 * - Real model creation and sync operations
 * - Data deduplication with Map structures
 * - Complex batch operations with error handling
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

import type { TRPCContext } from "~/server/api/trpc.base";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";

import { modelOpdbRouter } from "~/server/api/routers/model.opdb";
import * as schema from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

// Mock external dependencies
let idCounter = 0;
const mocks = vi.hoisted(() => ({
  generateId: vi.fn(() => `test-model-${Date.now()}-${++idCounter}`),
  opdbClient: {
    searchMachines: vi.fn(),
    getMachineById: vi.fn(),
  },
}));

vi.mock("~/lib/utils/id-generation", () => ({
  generateId: mocks.generateId,
}));

vi.mock("~/lib/opdb/client", () => ({
  OPDBClient: vi.fn().mockImplementation(() => mocks.opdbClient),
}));

// Mock permissions (not database-related)
vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue(["model:view", "organization:manage"]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue(["model:view", "organization:manage"]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

describe("modelOpdbRouter Integration Tests", () => {
  // Helper function to set up test with org, user, and caller
  async function setupTest(db: TestDatabase) {
    // Reset mock counter and clear mocks
    vi.clearAllMocks();
    idCounter = 0;

    // Create test organization and user
    const organizationId = generateTestId("org");
    const userId = generateTestId("user");

    await db.insert(schema.organizations).values({
      id: organizationId,
      name: "Test Organization",
      subdomain: "test",
    });

    await db.insert(schema.users).values({
      id: userId,
      email: "test@example.com",
      name: "Test User",
    });

    const testContext = createTestContext(db, organizationId, userId);
    const caller = modelOpdbRouter.createCaller(testContext);

    return { organizationId, userId, caller, db };
  }

  // Helper function to create test context
  function createTestContext(
    testDb: TestDatabase,
    organizationId: string,
    userId: string,
  ): TRPCContext {
    const mockContext: TRPCContext = {
      db: testDb,
      services: {} as any,
      user: {
        id: userId,
        email: "member@test.com",
        app_metadata: { organization_id: organizationId },
      } as any,
      supabase: {} as any,
      organization: {
        id: organizationId,
        name: "Test Organization",
        subdomain: "test",
      },
      headers: new Headers(),
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(() => mockContext.logger),
        withRequest: vi.fn(() => mockContext.logger),
        withUser: vi.fn(() => mockContext.logger),
        withOrganization: vi.fn(() => mockContext.logger),
        withContext: vi.fn(() => mockContext.logger),
      } as any,
      userPermissions: ["model:view", "organization:manage"],
    };

    return mockContext;
  }

  describe("searchOPDB", () => {
    test("searches OPDB machines successfully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller } = await setupTest(db);

        const mockResults = [
          {
            id: "opdb-1",
            name: "Medieval Madness",
            manufacturer: "Williams",
            year: 1997,
          },
          {
            id: "opdb-2",
            name: "Attack from Mars",
            manufacturer: "Bally",
            year: 1995,
          },
        ];

        mocks.opdbClient.searchMachines.mockResolvedValue(mockResults);

        const result = await caller.searchOPDB({ query: "medieval" });

        expect(result).toEqual(mockResults);
        expect(mocks.opdbClient.searchMachines).toHaveBeenCalledWith(
          "medieval",
        );
      });
    });

    test("handles OPDB API errors gracefully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller } = await setupTest(db);

        mocks.opdbClient.searchMachines.mockRejectedValue(
          new Error("OPDB API timeout"),
        );

        await expect(caller.searchOPDB({ query: "test" })).rejects.toThrow(
          "OPDB API timeout",
        );
      });
    });
  });

  describe("createFromOPDB", () => {
    const mockOPDBData = {
      name: "Medieval Madness",
      manufacturer: "Williams",
      year: 1997,
      type: "ss",
      playfield_image: "https://opdb.org/images/mm.jpg",
    };

    test("creates new model from OPDB data with real database operations", async ({
      workerDb,
    }) => {
      const generatedId = `test-model-${Date.now()}`;
      mocks.generateId.mockReturnValue(generatedId);
      mocks.opdbClient.getMachineById.mockResolvedValue(mockOPDBData);

      const result = await caller.createFromOPDB({ opdbId: "opdb-123" });

      expect(result).toEqual(
        expect.objectContaining({
          id: generatedId,
          name: "Medieval Madness",
          opdbId: "opdb-123",
          manufacturer: "Williams",
          year: 1997,
          opdbImgUrl: "https://opdb.org/images/mm.jpg",
          machineType: "ss",
          isCustom: false,
          isActive: true,
        }),
      );

      // Verify model was actually created in database
      const createdModel = await testDb.query.models.findFirst({
        where: eq(schema.models.id, generatedId),
      });

      expect(createdModel).toBeDefined();
      expect(createdModel?.name).toBe("Medieval Madness");
      expect(createdModel?.opdbId).toBe("opdb-123");
    });

    test("throws CONFLICT when model with same OPDB ID already exists", async ({
      workerDb,
    }) => {
      // Create existing model with OPDB ID
      const existingModelId = mocks.generateId();
      mocks.generateId.mockReturnValue(existingModelId);

      await testDb.insert(schema.models).values({
        id: existingModelId,
        name: "Existing Game",
        opdbId: "opdb-duplicate",
        isCustom: false,
        isActive: true,
      });

      mocks.opdbClient.getMachineById.mockResolvedValue(mockOPDBData);

      await expect(
        caller.createFromOPDB({ opdbId: "opdb-duplicate" }),
      ).rejects.toThrow(
        new TRPCError({
          code: "CONFLICT",
          message: "This game already exists in the system",
        }),
      );

      expect(mocks.opdbClient.getMachineById).not.toHaveBeenCalled();
    });

    test("throws NOT_FOUND when OPDB game doesn't exist", async ({
      workerDb,
    }) => {
      mocks.opdbClient.getMachineById.mockResolvedValue(null);

      await expect(
        caller.createFromOPDB({ opdbId: "invalid-opdb-id" }),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Game not found in OPDB",
        }),
      );
    });

    test("handles partial OPDB data with proper defaults", async ({
      workerDb,
    }) => {
      const partialData = {
        name: "Partial Game",
        manufacturer: null,
        year: null,
        playfield_image: null,
        type: null,
      };

      const generatedId = `test-partial-${Date.now()}`;
      mocks.generateId.mockReturnValue(generatedId);
      mocks.opdbClient.getMachineById.mockResolvedValue(partialData);

      const result = await caller.createFromOPDB({ opdbId: "opdb-partial" });

      expect(result).toEqual(
        expect.objectContaining({
          id: generatedId,
          name: "Partial Game",
          manufacturer: null,
          year: null,
          opdbImgUrl: null,
          machineType: null,
          isCustom: false,
          isActive: true,
        }),
      );

      // Verify in database
      const createdModel = await testDb.query.models.findFirst({
        where: eq(schema.models.id, generatedId),
      });

      expect(createdModel?.manufacturer).toBeNull();
      expect(createdModel?.year).toBeNull();
    });

    test("creates globally available models (not organization-scoped)", async ({
      workerDb,
    }) => {
      const generatedId = `test-global-${Date.now()}`;
      mocks.generateId.mockReturnValue(generatedId);
      mocks.opdbClient.getMachineById.mockResolvedValue(mockOPDBData);

      // Create model from primary organization
      await caller.createFromOPDB({ opdbId: "opdb-global" });

      // Switch to secondary organization context
      mockContext.organization = {
        id: "test-org-secondary",
        name: "Secondary Org",
        subdomain: "secondary",
      };
      mockContext.user.app_metadata = {
        organization_id: "test-org-secondary",
      };
      const secondaryCaller = modelOpdbRouter.createCaller(mockContext);

      // Should be able to see the global model exists (when searching)
      const existingModel = await testDb.query.models.findFirst({
        where: eq(schema.models.opdbId, "opdb-global"),
      });

      expect(existingModel).toBeDefined();
      expect(existingModel?.id).toBe(generatedId);

      // Creating duplicate should fail from any organization
      await expect(
        secondaryCaller.createFromOPDB({ opdbId: "opdb-global" }),
      ).rejects.toThrow(
        new TRPCError({
          code: "CONFLICT",
          message: "This game already exists in the system",
        }),
      );
    });
  });

  describe("syncWithOPDB", () => {
    test("syncs models with real database operations and deduplication", async ({
      workerDb,
    }) => {
      // Get baseline count of existing OPDB models in the seeded database
      const baselineResult = await caller.syncWithOPDB();
      const baselineCount = Number(baselineResult.total);

      // Create test models with specific OPDB IDs
      const modelId1 = mocks.generateId();
      const modelId2 = mocks.generateId();
      const machineId1 = mocks.generateId();
      const machineId2 = mocks.generateId();
      const machineId3 = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(modelId1)
        .mockReturnValueOnce(modelId2)
        .mockReturnValueOnce(machineId1)
        .mockReturnValueOnce(machineId2)
        .mockReturnValueOnce(machineId3);

      // Create models with unique OPDB IDs not in seeded data
      await testDb.insert(schema.models).values([
        {
          id: modelId1,
          name: "Test Medieval Madness",
          opdbId: "test-opdb-mm-unique",
          manufacturer: "Old Manufacturer",
          year: 1990,
          isCustom: false,
          isActive: true,
        },
        {
          id: modelId2,
          name: "Test Attack from Mars",
          opdbId: "test-opdb-afm-unique",
          manufacturer: "Old Bally",
          year: 1990,
          isCustom: false,
          isActive: true,
        },
      ]);

      // Create machines (including duplicates to test deduplication)
      await testDb.insert(schema.machines).values([
        {
          id: machineId1,
          name: "MM Machine 1",
          modelId: modelId1,
          organizationId: testData.organization,
          locationId: testData.location || "test-location-1",
          qrCodeId: `qr-${machineId1}`,
          isActive: true,
        },
        {
          id: machineId2,
          name: "MM Machine 2", // Another machine with same model
          modelId: modelId1,
          organizationId: testData.organization,
          locationId: testData.location || "test-location-1",
          qrCodeId: `qr-${machineId2}`,
          isActive: true,
        },
        {
          id: machineId3,
          name: "AFM Machine 1",
          modelId: modelId2,
          organizationId: testData.organization,
          locationId: testData.location || "test-location-1",
          qrCodeId: `qr-${machineId3}`,
          isActive: true,
        },
      ]);

      // Mock OPDB responses with updated data
      mocks.opdbClient.getMachineById.mockImplementation((opdbId: string) => {
        if (opdbId === "test-opdb-mm-unique") {
          return Promise.resolve({
            name: "Medieval Madness (Updated)",
            manufacturer: "Williams",
            year: 1997,
            playfield_image: "https://opdb.org/mm-updated.jpg",
            type: "ss",
          });
        } else if (opdbId === "test-opdb-afm-unique") {
          return Promise.resolve({
            name: "Attack from Mars (Updated)",
            manufacturer: "Bally",
            year: 1995,
            playfield_image: "https://opdb.org/afm-updated.jpg",
            type: "ss",
          });
        } else {
          // Mock responses for existing seeded models
          return Promise.resolve({
            name: `Updated ${opdbId}`,
            manufacturer: "Test Manufacturer",
            year: 2023,
          });
        }
      });

      const result = await caller.syncWithOPDB();

      // Should sync our 2 new models plus all existing seeded models
      expect(result).toEqual({
        synced: baselineCount + 2,
        total: baselineCount + 2,
        message: `Synced ${baselineCount + 2} of ${baselineCount + 2} games`,
      });

      // Verify our test models were actually updated in database
      const updatedModel1 = await testDb.query.models.findFirst({
        where: eq(schema.models.id, modelId1),
      });

      const updatedModel2 = await testDb.query.models.findFirst({
        where: eq(schema.models.id, modelId2),
      });

      expect(updatedModel1).toEqual(
        expect.objectContaining({
          name: "Medieval Madness (Updated)",
          manufacturer: "Williams",
          year: 1997,
          opdbImgUrl: "https://opdb.org/mm-updated.jpg",
          machineType: "ss",
        }),
      );

      expect(updatedModel2).toEqual(
        expect.objectContaining({
          name: "Attack from Mars (Updated)",
          manufacturer: "Bally",
          year: 1995,
          opdbImgUrl: "https://opdb.org/afm-updated.jpg",
          machineType: "ss",
        }),
      );

      expect(updatedModel1?.updatedAt).toBeDefined();
      expect(updatedModel2?.updatedAt).toBeDefined();
    });

    test("returns appropriate message when OPDB sync fails", async ({
      workerDb,
    }) => {
      // The seeded database has existing models with OPDB IDs
      // This test verifies what happens when OPDB API calls fail

      // Mock OPDB API to reject all calls (simulating API failure)
      mocks.opdbClient.getMachineById.mockRejectedValue(
        new Error("OPDB API unavailable"),
      );

      const result = await caller.syncWithOPDB();

      // Should find existing OPDB models but sync 0 due to API failures
      expect(result.synced).toBe(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.message).toBe(`Synced 0 of ${result.total} games`);

      // Should have tried to call OPDB API
      expect(mocks.opdbClient.getMachineById).toHaveBeenCalled();
    });

    test("filters out custom models with custom- prefix", async ({
      workerDb,
    }) => {
      // This test verifies that models with "custom-" prefix OPDB IDs are filtered out
      // But since the seeded data contains other valid OPDB models, we expect those to be found

      const modelId = mocks.generateId();
      const machineId = mocks.generateId();

      // Create model with custom- prefix OPDB ID
      await testDb.insert(schema.models).values({
        id: modelId,
        name: "Custom OPDB Game",
        opdbId: "custom-123", // Should be filtered out
        isCustom: true,
        isActive: true,
      });

      await testDb.insert(schema.machines).values({
        id: machineId,
        name: "Custom Machine",
        modelId: modelId,
        organizationId: testData.organization,
        locationId: testData.location || "test-location-1",
        qrCodeId: machineId,
        isActive: true,
      });

      // Mock OPDB API to simulate successful sync of non-custom models
      mocks.opdbClient.getMachineById.mockRejectedValue(
        new Error("API unavailable"),
      );

      const result = await caller.syncWithOPDB();

      // Should find existing OPDB models (from seeded data) but exclude the custom- one
      expect(result.synced).toBe(0); // 0 because API calls fail
      expect(result.total).toBeGreaterThan(0); // Should still find valid OPDB models from seeded data
      expect(result.message).toBe(`Synced 0 of ${result.total} games`);

      // Verify the custom- prefixed model was filtered out by checking
      // that getMachineById was never called with "custom-123"
      const mockCalls = mocks.opdbClient.getMachineById.mock.calls;
      const customCalls = mockCalls.filter((call) => call[0] === "custom-123");
      expect(customCalls).toHaveLength(0);
    });

    test("continues sync despite individual failures", async ({ workerDb }) => {
      // This test verifies that sync operation continues and handles failures gracefully
      // by simulating a mix of successful and failed API calls

      let callCount = 0;

      // Mock OPDB calls to simulate some failures
      mocks.opdbClient.getMachineById.mockImplementation((opdbId: string) => {
        callCount++;
        // Fail every other call to simulate partial failures
        if (callCount % 2 === 0) {
          return Promise.reject(new Error("OPDB API error"));
        } else {
          return Promise.resolve({
            name: `Updated ${opdbId}`,
            manufacturer: "Test Mfg",
            year: 2023,
          });
        }
      });

      const result = await caller.syncWithOPDB();

      // Should have processed some models
      expect(result.total).toBeGreaterThan(0);
      expect(result.synced).toBeGreaterThanOrEqual(0);
      expect(result.synced).toBeLessThanOrEqual(result.total);

      // Should return appropriate message
      expect(result.message).toBe(
        `Synced ${result.synced} of ${result.total} games`,
      );

      // Should have made API calls
      expect(mocks.opdbClient.getMachineById).toHaveBeenCalled();
      expect(callCount).toBeGreaterThan(0);

      // Test passes if sync operation completed and handled failures gracefully
      // (Note: error logging is verified in other tests, this focuses on resilience)
    });

    test("only syncs models in current organization", async ({ workerDb }) => {
      // Get existing count for the primary organization
      const existingResult = await caller.syncWithOPDB();
      const existingCount = Number(existingResult.total);

      const primaryModelId = mocks.generateId();
      const secondaryModelId = mocks.generateId();
      const primaryMachineId = mocks.generateId();
      const secondaryMachineId = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(primaryModelId)
        .mockReturnValueOnce(secondaryModelId)
        .mockReturnValueOnce(primaryMachineId)
        .mockReturnValueOnce(secondaryMachineId);

      // Create models with unique OPDB IDs
      await testDb.insert(schema.models).values([
        {
          id: primaryModelId,
          name: "Primary Org Model",
          opdbId: "opdb-primary-unique",
          isCustom: false,
          isActive: true,
        },
        {
          id: secondaryModelId,
          name: "Secondary Org Model",
          opdbId: "opdb-secondary-unique",
          isCustom: false,
          isActive: true,
        },
      ]);

      // Create machines in different organizations
      await testDb.insert(schema.machines).values([
        {
          id: primaryMachineId,
          name: "Primary Machine",
          modelId: primaryModelId,
          organizationId: testData.organization,
          locationId: testData.location || "test-location-1",
          qrCodeId: primaryMachineId,
          isActive: true,
        },
        {
          id: secondaryMachineId,
          name: "Secondary Machine",
          modelId: secondaryModelId,
          organizationId: "test-org-secondary",
          locationId: "test-location-secondary",
          qrCodeId: secondaryMachineId,
          isActive: true,
        },
      ]);

      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Updated Model",
      });

      // Primary org should sync all existing models + the new primary org model
      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: existingCount + 1, // Existing models + 1 new primary org model
        total: existingCount + 1,
        message: `Synced ${existingCount + 1} of ${existingCount + 1} games`,
      });

      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledWith(
        "opdb-primary-unique",
      );
      expect(mocks.opdbClient.getMachineById).not.toHaveBeenCalledWith(
        "opdb-secondary-unique",
      );
    });

    test("deduplicates models correctly with Map-based logic", async ({
      workerDb,
    }) => {
      // Get existing count first
      const existingResult = await caller.syncWithOPDB();
      const existingCount = Number(existingResult.total);

      const modelId = mocks.generateId();
      const machineId1 = mocks.generateId();
      const machineId2 = mocks.generateId();
      const machineId3 = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(modelId)
        .mockReturnValueOnce(machineId1)
        .mockReturnValueOnce(machineId2)
        .mockReturnValueOnce(machineId3);

      // Create one model with unique OPDB ID
      await testDb.insert(schema.models).values({
        id: modelId,
        name: "Duplicate Test Model",
        opdbId: "opdb-duplicate-unique",
        isCustom: false,
        isActive: true,
      });

      // Create multiple machines with same model
      await testDb.insert(schema.machines).values([
        {
          id: machineId1,
          name: "Machine 1",
          modelId: modelId,
          organizationId: testData.organization,
          locationId: testData.location || "test-location-1",
          qrCodeId: machineId1,
          isActive: true,
        },
        {
          id: machineId2,
          name: "Machine 2",
          modelId: modelId, // Same model
          organizationId: testData.organization,
          locationId: testData.location || "test-location-1",
          qrCodeId: machineId2,
          isActive: true,
        },
        {
          id: machineId3,
          name: "Machine 3",
          modelId: modelId, // Same model
          organizationId: testData.organization,
          locationId: testData.location || "test-location-1",
          qrCodeId: machineId3,
          isActive: true,
        },
      ]);

      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Updated Duplicate Model",
      });

      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: existingCount + 1, // Existing + our 1 unique model
        total: existingCount + 1, // Should be deduplicated
        message: `Synced ${existingCount + 1} of ${existingCount + 1} games`,
      });

      // Should make one call for our new model + calls for existing models
      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledWith(
        "opdb-duplicate-unique",
      );
    });
  });

  describe("data integrity", () => {
    test("maintains referential integrity during model creation", async ({
      workerDb,
    }) => {
      const generatedId = `test-integrity-${Date.now()}`;
      mocks.generateId.mockReturnValue(generatedId);
      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Integrity Test Game",
        manufacturer: "Test Corp",
        year: 2023,
      });

      await caller.createFromOPDB({ opdbId: "opdb-integrity-unique" });

      // Verify model exists with the correct generated ID
      const createdModel = await testDb.query.models.findFirst({
        where: eq(schema.models.opdbId, "opdb-integrity-unique"),
      });

      expect(createdModel).toBeDefined();
      expect(createdModel?.opdbId).toBe("opdb-integrity-unique");
      expect(createdModel?.name).toBe("Integrity Test Game");

      // Verify we can create machines referencing this model
      const machineId = mocks.generateId();
      mocks.generateId.mockReturnValue(machineId);

      await testDb.insert(schema.machines).values({
        id: machineId,
        name: "Test Machine",
        modelId: createdModel?.id ?? "fallback-model-id",
        organizationId: testData.organization,
        locationId: testData.location || "test-location-1",
        qrCodeId: machineId,
        isActive: true,
      });

      const createdMachine = await testDb.query.machines.findFirst({
        where: eq(schema.machines.id, machineId),
        with: { model: true },
      });

      expect(createdMachine?.model?.name).toBe("Integrity Test Game");
    });

    test("maintains data consistency during sync operations", async ({
      workerDb,
    }) => {
      const modelId = mocks.generateId();
      const machineId = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(modelId)
        .mockReturnValueOnce(machineId);

      const originalData = {
        id: modelId,
        name: "Original Name",
        manufacturer: "Original Mfg",
        year: 1990,
        opdbId: "opdb-consistency",
        isCustom: false,
        isActive: true,
      };

      // Create model and machine
      await testDb.insert(schema.models).values(originalData);

      await testDb.insert(schema.machines).values({
        id: machineId,
        name: "Test Machine",
        modelId: modelId,
        organizationId: testData.organization,
        locationId: testData.location || "test-location-1",
        qrCodeId: machineId,
        isActive: true,
      });

      // Mock OPDB update
      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Updated Name",
        manufacturer: "Updated Mfg",
        year: 2023,
      });

      await caller.syncWithOPDB();

      // Verify model was updated
      const updatedModel = await testDb.query.models.findFirst({
        where: eq(schema.models.id, modelId),
      });

      expect(updatedModel).toEqual(
        expect.objectContaining({
          name: "Updated Name",
          manufacturer: "Updated Mfg",
          year: 2023,
          opdbId: "opdb-consistency", // Should preserve OPDB ID
          isCustom: false, // Should preserve custom flag
          isActive: true, // Should preserve active flag
        }),
      );

      // Verify machine still references correct model
      const machine = await testDb.query.machines.findFirst({
        where: eq(schema.machines.id, machineId),
        with: { model: true },
      });

      expect(machine?.model?.name).toBe("Updated Name");
    });
  });

  describe("error scenarios", () => {
    test("handles database constraint violations gracefully", async ({
      workerDb,
    }) => {
      // Create model with specific OPDB ID
      const existingId = mocks.generateId();
      mocks.generateId.mockReturnValue(existingId);

      await testDb.insert(schema.models).values({
        id: existingId,
        name: "Existing Model",
        opdbId: "opdb-unique-constraint",
        isCustom: false,
        isActive: true,
      });

      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Another Model",
        manufacturer: "Test",
      });

      // Should detect existing model and throw CONFLICT with correct message
      await expect(
        caller.createFromOPDB({ opdbId: "opdb-unique-constraint" }),
      ).rejects.toThrow(
        new TRPCError({
          code: "CONFLICT",
          message: "This game already exists in the system",
        }),
      );
    });

    test("handles concurrent sync operations safely", async ({ workerDb }) => {
      // Get existing model count
      const existingResult = await caller.syncWithOPDB();
      const existingTotal = Number(existingResult.total);

      const modelId = mocks.generateId();
      const machineId = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(modelId)
        .mockReturnValueOnce(machineId);

      // Create model with unique OPDB ID
      await testDb.insert(schema.models).values({
        id: modelId,
        name: "Concurrent Model",
        opdbId: "opdb-concurrent-unique",
        isCustom: false,
        isActive: true,
      });

      await testDb.insert(schema.machines).values({
        id: machineId,
        name: "Concurrent Machine",
        modelId: modelId,
        organizationId: testData.organization,
        locationId: testData.location || "test-location-1",
        qrCodeId: machineId,
        isActive: true,
      });

      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Updated Concurrent Model",
      });

      // Multiple sync calls should not cause conflicts
      const results = await Promise.all([
        caller.syncWithOPDB(),
        caller.syncWithOPDB(),
      ]);

      // Both should succeed with existing models + our new one
      results.forEach((result) => {
        expect(result.synced).toBeGreaterThanOrEqual(0);
        expect(result.total).toBe(existingTotal + 1);
      });
    });
  });
});
