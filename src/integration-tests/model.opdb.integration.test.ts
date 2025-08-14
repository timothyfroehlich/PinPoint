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
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TRPCContext } from "~/server/api/trpc.base";

import { modelOpdbRouter } from "~/server/api/routers/model.opdb";
import * as schema from "~/server/db/schema";
import {
  createSeededTestDatabase,
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

// Mock external dependencies
const mocks = vi.hoisted(() => ({
  generateId: vi.fn(),
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
  let testDb: TestDatabase;
  let testData: Awaited<ReturnType<typeof getSeededTestData>>;
  let mockContext: TRPCContext;
  let caller: ReturnType<typeof modelOpdbRouter.createCaller>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const setup = await createSeededTestDatabase();
    testDb = setup.db;
    testData = await getSeededTestData(setup.db, setup.organizationId);

    // Setup predictable ID generation
    mocks.generateId.mockImplementation(() => `test-model-${Date.now()}`);

    mockContext = {
      db: {} as any, // Not used in Drizzle conversion
      drizzle: testDb,
      services: {} as any,
      user: {
        id: testData.user || "test-user-1",
        email: "member@test.com",
        app_metadata: { organization_id: testData.organization },
      } as any,
      supabase: {} as any,
      organization: {
        id: testData.organization,
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

    caller = modelOpdbRouter.createCaller(mockContext);
  });

  describe("searchOPDB", () => {
    it("searches OPDB machines successfully", async () => {
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
      expect(mocks.opdbClient.searchMachines).toHaveBeenCalledWith("medieval");
    });

    it("handles OPDB API errors gracefully", async () => {
      mocks.opdbClient.searchMachines.mockRejectedValue(
        new Error("OPDB API timeout"),
      );

      await expect(caller.searchOPDB({ query: "test" })).rejects.toThrow(
        "OPDB API timeout",
      );
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

    it("creates new model from OPDB data with real database operations", async () => {
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

    it("throws CONFLICT when model with same OPDB ID already exists", async () => {
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

    it("throws NOT_FOUND when OPDB game doesn't exist", async () => {
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

    it("handles partial OPDB data with proper defaults", async () => {
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

    it("creates globally available models (not organization-scoped)", async () => {
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
      ).rejects.toThrow(new TRPCError({ code: "CONFLICT" }));
    });
  });

  describe("syncWithOPDB", () => {
    it("syncs models with real database operations and deduplication", async () => {
      // Create test models
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

      // Create models with OPDB IDs
      await testDb.insert(schema.models).values([
        {
          id: modelId1,
          name: "Old Medieval Madness",
          opdbId: "opdb-mm",
          manufacturer: "Old Manufacturer",
          year: 1990,
          isCustom: false,
          isActive: true,
        },
        {
          id: modelId2,
          name: "Old Attack from Mars",
          opdbId: "opdb-afm",
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
          locationId: testData.locations.primary.id,
          isActive: true,
        },
        {
          id: machineId2,
          name: "MM Machine 2", // Another machine with same model
          modelId: modelId1,
          organizationId: testData.organization,
          locationId: testData.locations.primary.id,
          isActive: true,
        },
        {
          id: machineId3,
          name: "AFM Machine 1",
          modelId: modelId2,
          organizationId: testData.organization,
          locationId: testData.locations.primary.id,
          isActive: true,
        },
      ]);

      // Mock OPDB responses with updated data
      const updatedMM = {
        name: "Medieval Madness (Updated)",
        manufacturer: "Williams",
        year: 1997,
        playfield_image: "https://opdb.org/mm-updated.jpg",
        type: "ss",
      };

      const updatedAFM = {
        name: "Attack from Mars (Updated)",
        manufacturer: "Bally",
        year: 1995,
        playfield_image: "https://opdb.org/afm-updated.jpg",
        type: "ss",
      };

      mocks.opdbClient.getMachineById
        .mockResolvedValueOnce(updatedMM)
        .mockResolvedValueOnce(updatedAFM);

      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: 2,
        total: 2, // Should deduplicate to 2 unique models
        message: "Synced 2 of 2 games",
      });

      // Verify models were actually updated in database
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

    it("returns appropriate message when no OPDB models exist", async () => {
      // Create only custom models (no OPDB IDs)
      const modelId = mocks.generateId();
      const machineId = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(modelId)
        .mockReturnValueOnce(machineId);

      await testDb.insert(schema.models).values({
        id: modelId,
        name: "Custom Game",
        opdbId: null, // No OPDB ID
        isCustom: true,
        isActive: true,
      });

      await testDb.insert(schema.machines).values({
        id: machineId,
        name: "Custom Machine",
        modelId: modelId,
        organizationId: testData.organization,
        locationId: testData.locations.primary.id,
        isActive: true,
      });

      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: 0,
        message: "No OPDB-linked games found to sync",
      });

      expect(mocks.opdbClient.getMachineById).not.toHaveBeenCalled();
    });

    it("filters out custom models with custom- prefix", async () => {
      const modelId = mocks.generateId();
      const machineId = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(modelId)
        .mockReturnValueOnce(machineId);

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
        locationId: testData.locations.primary.id,
        isActive: true,
      });

      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: 0,
        message: "No OPDB-linked games found to sync",
      });
    });

    it("continues sync despite individual failures", async () => {
      const modelId1 = mocks.generateId();
      const modelId2 = mocks.generateId();
      const machineId1 = mocks.generateId();
      const machineId2 = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(modelId1)
        .mockReturnValueOnce(modelId2)
        .mockReturnValueOnce(machineId1)
        .mockReturnValueOnce(machineId2);

      // Create two models
      await testDb.insert(schema.models).values([
        {
          id: modelId1,
          name: "Working Model",
          opdbId: "opdb-working",
          isCustom: false,
          isActive: true,
        },
        {
          id: modelId2,
          name: "Failing Model",
          opdbId: "opdb-failing",
          isCustom: false,
          isActive: true,
        },
      ]);

      await testDb.insert(schema.machines).values([
        {
          id: machineId1,
          name: "Working Machine",
          modelId: modelId1,
          organizationId: testData.organization,
          locationId: testData.locations.primary.id,
          isActive: true,
        },
        {
          id: machineId2,
          name: "Failing Machine",
          modelId: modelId2,
          organizationId: testData.organization,
          locationId: testData.locations.primary.id,
          isActive: true,
        },
      ]);

      // First succeeds, second fails
      mocks.opdbClient.getMachineById
        .mockResolvedValueOnce({ name: "Updated Working Model" })
        .mockRejectedValueOnce(new Error("OPDB API error"));

      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: 1,
        total: 2,
        message: "Synced 1 of 2 games",
      });

      // Verify error was logged
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Failed to sync OPDB game",
          component: "modelRouter.syncOPDBGames",
          context: expect.objectContaining({
            gameTitle: "Failing Model",
            gameId: modelId2,
            opdbId: "opdb-failing",
          }),
        }),
      );

      // Verify successful model was updated
      const updatedModel = await testDb.query.models.findFirst({
        where: eq(schema.models.id, modelId1),
      });
      expect(updatedModel?.name).toBe("Updated Working Model");
    });

    it("only syncs models in current organization", async () => {
      const primaryModelId = mocks.generateId();
      const secondaryModelId = mocks.generateId();
      const primaryMachineId = mocks.generateId();
      const secondaryMachineId = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(primaryModelId)
        .mockReturnValueOnce(secondaryModelId)
        .mockReturnValueOnce(primaryMachineId)
        .mockReturnValueOnce(secondaryMachineId);

      // Create identical models
      await testDb.insert(schema.models).values([
        {
          id: primaryModelId,
          name: "Shared Model",
          opdbId: "opdb-shared",
          isCustom: false,
          isActive: true,
        },
        {
          id: secondaryModelId,
          name: "Secondary Model",
          opdbId: "opdb-secondary",
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
          locationId: testData.locations.primary.id,
          isActive: true,
        },
        {
          id: secondaryMachineId,
          name: "Secondary Machine",
          modelId: secondaryModelId,
          organizationId: "test-org-secondary",
          locationId: testData.locations.secondary.id,
          isActive: true,
        },
      ]);

      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Updated Model",
      });

      // Primary org should only sync its machines' models
      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: 1,
        total: 1,
        message: "Synced 1 of 1 games",
      });

      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledWith(
        "opdb-shared",
      );
      expect(mocks.opdbClient.getMachineById).not.toHaveBeenCalledWith(
        "opdb-secondary",
      );
    });

    it("deduplicates models correctly with Map-based logic", async () => {
      const modelId = mocks.generateId();
      const machineId1 = mocks.generateId();
      const machineId2 = mocks.generateId();
      const machineId3 = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(modelId)
        .mockReturnValueOnce(machineId1)
        .mockReturnValueOnce(machineId2)
        .mockReturnValueOnce(machineId3);

      // Create one model
      await testDb.insert(schema.models).values({
        id: modelId,
        name: "Duplicate Test Model",
        opdbId: "opdb-duplicate",
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
          locationId: testData.locations.primary.id,
          isActive: true,
        },
        {
          id: machineId2,
          name: "Machine 2",
          modelId: modelId, // Same model
          organizationId: testData.organization,
          locationId: testData.locations.primary.id,
          isActive: true,
        },
        {
          id: machineId3,
          name: "Machine 3",
          modelId: modelId, // Same model
          organizationId: testData.organization,
          locationId: testData.locations.primary.id,
          isActive: true,
        },
      ]);

      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Updated Duplicate Model",
      });

      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: 1,
        total: 1, // Should be deduplicated to 1 unique model
        message: "Synced 1 of 1 games",
      });

      // Should only make one API call despite multiple machines
      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledTimes(1);
      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledWith(
        "opdb-duplicate",
      );
    });
  });

  describe("data integrity", () => {
    it("maintains referential integrity during model creation", async () => {
      const generatedId = `test-integrity-${Date.now()}`;
      mocks.generateId.mockReturnValue(generatedId);
      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Integrity Test Game",
        manufacturer: "Test Corp",
        year: 2023,
      });

      await caller.createFromOPDB({ opdbId: "opdb-integrity" });

      // Verify model exists
      const createdModel = await testDb.query.models.findFirst({
        where: eq(schema.models.id, generatedId),
      });

      expect(createdModel).toBeDefined();
      expect(createdModel?.opdbId).toBe("opdb-integrity");

      // Verify we can create machines referencing this model
      const machineId = mocks.generateId();
      mocks.generateId.mockReturnValue(machineId);

      await testDb.insert(schema.machines).values({
        id: machineId,
        name: "Test Machine",
        modelId: generatedId,
        organizationId: testData.organization,
        locationId: testData.locations.primary.id,
        isActive: true,
      });

      const createdMachine = await testDb.query.machines.findFirst({
        where: eq(schema.machines.id, machineId),
        with: { model: true },
      });

      expect(createdMachine?.model?.name).toBe("Integrity Test Game");
    });

    it("maintains data consistency during sync operations", async () => {
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
        locationId: testData.locations.primary.id,
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
    it("handles database constraint violations gracefully", async () => {
      // Create model with specific OPDB ID
      const existingId = mocks.generateId();
      mocks.generateId.mockReturnValue(existingId);

      await testDb.insert(schema.models).values({
        id: existingId,
        name: "Existing Model",
        opdbId: "opdb-unique",
        isCustom: false,
        isActive: true,
      });

      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Another Model",
        manufacturer: "Test",
      });

      // Should detect existing model and throw CONFLICT
      await expect(
        caller.createFromOPDB({ opdbId: "opdb-unique" }),
      ).rejects.toThrow(new TRPCError({ code: "CONFLICT" }));
    });

    it("handles concurrent sync operations safely", async () => {
      const modelId = mocks.generateId();
      const machineId = mocks.generateId();

      mocks.generateId
        .mockReturnValueOnce(modelId)
        .mockReturnValueOnce(machineId);

      // Create model
      await testDb.insert(schema.models).values({
        id: modelId,
        name: "Concurrent Model",
        opdbId: "opdb-concurrent",
        isCustom: false,
        isActive: true,
      });

      await testDb.insert(schema.machines).values({
        id: machineId,
        name: "Concurrent Machine",
        modelId: modelId,
        organizationId: testData.organization,
        locationId: testData.locations.primary.id,
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

      // Both should succeed
      results.forEach((result) => {
        expect(result.synced).toBeGreaterThanOrEqual(0);
        expect(result.total).toBe(1);
      });
    });
  });
});
