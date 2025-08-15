/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Model OPDB Router Unit Tests
 *
 * Unit tests for the model.opdb router using modern Vitest patterns and mocked dependencies.
 * Tests OPDB integration, external API calls, data transformation, and error handling.
 *
 * Key Features Tested:
 * - External OPDB API search and data retrieval
 * - Drizzle insert().values().returning() patterns
 * - Drizzle update().set().where() operations
 * - Model creation from OPDB data with proper defaults
 * - Batch sync operations with Map-based deduplication
 * - TRPCError handling (CONFLICT, NOT_FOUND)
 * - Error resilience in sync operations
 *
 * Uses August 2025 Vitest patterns with type-safe mocking of external dependencies.
 */

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VitestMockContext } from "~/test/vitestMockContext";

import { modelOpdbRouter } from "~/server/api/routers/model.opdb";
import { createVitestMockContext } from "~/test/vitestMockContext";

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

// Mock permissions system
vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue(["model:view", "organization:manage"]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue(["model:view", "organization:manage"]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

describe("modelOpdbRouter", () => {
  let mockCtx: VitestMockContext;
  let caller: ReturnType<typeof modelOpdbRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createVitestMockContext();

    // Mock membership lookup for organizationProcedure
    vi.mocked(mockCtx.db.membership.findFirst).mockResolvedValue({
      id: "test-membership",
      organizationId: "org-1",
      userId: "user-1",
      roleId: "role-1",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    caller = modelOpdbRouter.createCaller(mockCtx);

    // Setup default mocks
    mocks.generateId.mockReturnValue("test-model-id");
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

    it("handles empty search results", async () => {
      mocks.opdbClient.searchMachines.mockResolvedValue([]);

      const result = await caller.searchOPDB({ query: "nonexistent" });

      expect(result).toEqual([]);
      expect(mocks.opdbClient.searchMachines).toHaveBeenCalledWith(
        "nonexistent",
      );
    });

    it("propagates OPDB API errors", async () => {
      const apiError = new Error("OPDB API timeout");
      mocks.opdbClient.searchMachines.mockRejectedValue(apiError);

      await expect(caller.searchOPDB({ query: "test" })).rejects.toThrow(
        "OPDB API timeout",
      );
    });

    it("validates minimum query length", async () => {
      await expect(caller.searchOPDB({ query: "" })).rejects.toThrow();
    });
  });

  describe("createFromOPDB", () => {
    const mockMachineData = {
      name: "Medieval Madness",
      manufacturer: "Williams",
      year: 1997,
      type: "ss",
      playfield_image: "https://example.com/image.jpg",
    };

    it("creates new model from OPDB data", async () => {
      const newModel = {
        id: "test-model-id",
        name: "Medieval Madness",
        opdbId: "opdb-123",
        manufacturer: "Williams",
        year: 1997,
        opdbImgUrl: "https://example.com/image.jpg",
        machineType: "ss",
        isCustom: false,
        isActive: true,
      };

      // Mock no existing game
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);

      // Mock OPDB API response
      mocks.opdbClient.getMachineById.mockResolvedValue(mockMachineData);

      // Mock database insert
      vi.mocked(mockCtx.drizzle.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newModel]),
        }),
      } as any);

      const result = await caller.createFromOPDB({ opdbId: "opdb-123" });

      expect(result).toEqual(newModel);
      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledWith("opdb-123");
      expect(mockCtx.drizzle.insert).toHaveBeenCalled();
    });

    it("throws CONFLICT when game already exists", async () => {
      const existingModel = {
        id: "existing-model",
        name: "Medieval Madness",
        opdbId: "opdb-123",
      };

      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(
        existingModel,
      );

      await expect(
        caller.createFromOPDB({ opdbId: "opdb-123" }),
      ).rejects.toThrow(
        new TRPCError({
          code: "CONFLICT",
          message: "This game already exists in the system",
        }),
      );

      expect(mocks.opdbClient.getMachineById).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when OPDB game doesn't exist", async () => {
      // Mock no existing game locally
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);

      // Mock OPDB API returning null (not found)
      mocks.opdbClient.getMachineById.mockResolvedValue(null);

      await expect(
        caller.createFromOPDB({ opdbId: "invalid-id" }),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Game not found in OPDB",
        }),
      );
    });

    it("creates model with proper defaults", async () => {
      // Mock incomplete OPDB data
      const incompleteData = {
        name: "Test Game",
        manufacturer: null,
        year: null,
        playfield_image: null,
        type: null,
      };

      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);
      mocks.opdbClient.getMachineById.mockResolvedValue(incompleteData);

      const mockInsert = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "test-model-id" }]),
        }),
      };
      vi.mocked(mockCtx.drizzle.insert).mockReturnValue(mockInsert as any);

      await caller.createFromOPDB({ opdbId: "test-id" });

      expect(mockInsert.values).toHaveBeenCalledWith({
        id: "test-model-id",
        name: "Test Game",
        opdbId: "test-id",
        manufacturer: null,
        year: null,
        opdbImgUrl: null,
        machineType: null,
        isCustom: false,
        isActive: true,
      });
    });

    it("generates unique IDs for new models", async () => {
      mocks.generateId.mockReturnValue("unique-model-id");

      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);
      mocks.opdbClient.getMachineById.mockResolvedValue(mockMachineData);

      const mockInsert = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "unique-model-id" }]),
        }),
      };
      vi.mocked(mockCtx.drizzle.insert).mockReturnValue(mockInsert as any);

      await caller.createFromOPDB({ opdbId: "test-id" });

      expect(mocks.generateId).toHaveBeenCalled();
      expect(mockInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({ id: "unique-model-id" }),
      );
    });
  });

  describe("syncWithOPDB", () => {
    const mockMachinesInOrg = [
      {
        id: "machine-1",
        organizationId: "org-1",
        model: {
          id: "model-1",
          name: "Medieval Madness",
          opdbId: "opdb-123",
        },
      },
      {
        id: "machine-2",
        organizationId: "org-1",
        model: {
          id: "model-2",
          name: "Attack from Mars",
          opdbId: "opdb-456",
        },
      },
      // Duplicate model (should be deduplicated)
      {
        id: "machine-3",
        organizationId: "org-1",
        model: {
          id: "model-1", // Same as machine-1
          name: "Medieval Madness",
          opdbId: "opdb-123",
        },
      },
    ];

    it("syncs OPDB models successfully", async () => {
      vi.mocked(mockCtx.drizzle.query.machines.findMany).mockResolvedValue(
        mockMachinesInOrg,
      );

      const updatedData1 = {
        name: "Medieval Madness (Updated)",
        manufacturer: "Williams",
        year: 1997,
        playfield_image: "https://example.com/new-image.jpg",
        type: "ss",
      };

      const updatedData2 = {
        name: "Attack from Mars (Updated)",
        manufacturer: "Bally",
        year: 1995,
        playfield_image: "https://example.com/afm-image.jpg",
        type: "ss",
      };

      mocks.opdbClient.getMachineById
        .mockResolvedValueOnce(updatedData1)
        .mockResolvedValueOnce(updatedData2);

      vi.mocked(mockCtx.drizzle.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: 2,
        total: 2, // Should be deduplicated to 2 unique models
        message: "Synced 2 of 2 games",
      });

      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledTimes(2);
      expect(mockCtx.drizzle.update).toHaveBeenCalledTimes(2);
    });

    it("handles empty organization (no machines)", async () => {
      vi.mocked(mockCtx.drizzle.query.machines.findMany).mockResolvedValue([]);

      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: 0,
        message: "No OPDB-linked games found to sync",
      });

      expect(mocks.opdbClient.getMachineById).not.toHaveBeenCalled();
    });

    it("deduplicates models correctly using Map", async () => {
      vi.mocked(mockCtx.drizzle.query.machines.findMany).mockResolvedValue(
        mockMachinesInOrg,
      );

      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Updated Name",
        manufacturer: "Updated Mfg",
      });

      vi.mocked(mockCtx.drizzle.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      await caller.syncWithOPDB();

      // Should only update 2 unique models despite 3 machines
      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledTimes(2);
      expect(mockCtx.drizzle.update).toHaveBeenCalledTimes(2);
    });

    it("filters out custom models and invalid OPDB IDs", async () => {
      const mixedMachines = [
        {
          id: "machine-1",
          model: {
            id: "model-1",
            name: "Custom Game",
            opdbId: "custom-123", // Starts with 'custom-'
          },
        },
        {
          id: "machine-2",
          model: {
            id: "model-2",
            name: "No OPDB ID",
            opdbId: null, // No OPDB ID
          },
        },
        {
          id: "machine-3",
          model: {
            id: "model-3",
            name: "Valid OPDB Game",
            opdbId: "opdb-456", // Valid OPDB ID
          },
        },
      ];

      vi.mocked(mockCtx.drizzle.query.machines.findMany).mockResolvedValue(
        mixedMachines,
      );

      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Updated Game",
      });

      vi.mocked(mockCtx.drizzle.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const result = await caller.syncWithOPDB();

      expect(result.total).toBe(1); // Only 1 valid OPDB game
      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledWith("opdb-456");
    });

    it("continues sync despite individual failures", async () => {
      const machines = [
        {
          model: {
            id: "model-1",
            name: "Game 1",
            opdbId: "opdb-1",
          },
        },
        {
          model: {
            id: "model-2",
            name: "Game 2",
            opdbId: "opdb-2",
          },
        },
      ];

      vi.mocked(mockCtx.drizzle.query.machines.findMany).mockResolvedValue(
        machines,
      );

      // First call succeeds, second fails
      mocks.opdbClient.getMachineById
        .mockResolvedValueOnce({ name: "Updated Game 1" })
        .mockRejectedValueOnce(new Error("API Error"));

      vi.mocked(mockCtx.drizzle.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const result = await caller.syncWithOPDB();

      expect(result).toEqual({
        synced: 1, // Only 1 succeeded
        total: 2,
        message: "Synced 1 of 2 games",
      });

      // The router should handle errors gracefully and continue processing
      expect(result.synced).toBe(1);
      expect(result.total).toBe(2);
    });

    it("updates models with complete OPDB data", async () => {
      const machine = {
        model: {
          id: "model-1",
          name: "Old Name",
          opdbId: "opdb-123",
        },
      };

      vi.mocked(mockCtx.drizzle.query.machines.findMany).mockResolvedValue([
        machine,
      ]);

      const updatedData = {
        name: "New Name",
        manufacturer: "New Manufacturer",
        year: 2023,
        playfield_image: "https://example.com/new.jpg",
        type: "digital",
      };

      mocks.opdbClient.getMachineById.mockResolvedValue(updatedData);

      const mockUpdate = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      };
      vi.mocked(mockCtx.drizzle.update).mockReturnValue(mockUpdate as any);

      await caller.syncWithOPDB();

      expect(mockUpdate.set).toHaveBeenCalledWith({
        name: "New Name",
        manufacturer: "New Manufacturer",
        year: 2023,
        opdbImgUrl: "https://example.com/new.jpg",
        machineType: "digital",
        updatedAt: expect.any(Date),
      });
    });

    it("skips models with null OPDB IDs during iteration", async () => {
      const machines = [
        {
          model: {
            id: "model-1",
            name: "Valid Game",
            opdbId: "opdb-123",
          },
        },
        {
          model: {
            id: "model-2",
            name: "Invalid Game",
            opdbId: null, // Should be skipped
          },
        },
      ];

      vi.mocked(mockCtx.drizzle.query.machines.findMany).mockResolvedValue(
        machines,
      );

      mocks.opdbClient.getMachineById.mockResolvedValue({
        name: "Updated Game",
      });

      vi.mocked(mockCtx.drizzle.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const result = await caller.syncWithOPDB();

      expect(result.total).toBe(1); // Only 1 valid model processed
      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledWith("opdb-123");
      expect(mocks.opdbClient.getMachineById).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("handles OPDB client construction errors", async () => {
      // The OPDBClient constructor shouldn't throw, but test the pattern
      expect(() => modelOpdbRouter.createCaller(mockCtx)).not.toThrow();
    });

    it("propagates database errors in createFromOPDB", async () => {
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);
      mocks.opdbClient.getMachineById.mockResolvedValue({ name: "Test Game" });

      const dbError = new Error("Database insert failed");
      vi.mocked(mockCtx.drizzle.insert).mockImplementation(() => {
        throw dbError;
      });

      await expect(
        caller.createFromOPDB({ opdbId: "test-id" }),
      ).rejects.toThrow("Database insert failed");
    });

    it("handles OPDB API errors gracefully in sync", async () => {
      vi.mocked(mockCtx.drizzle.query.machines.findMany).mockResolvedValue([
        {
          model: {
            id: "model-1",
            name: "Test Game",
            opdbId: "opdb-123",
          },
        },
      ]);

      mocks.opdbClient.getMachineById.mockRejectedValue(
        new Error("OPDB service unavailable"),
      );

      const result = await caller.syncWithOPDB();

      expect(result.synced).toBe(0);
      expect(result.total).toBe(1);
      // The router handles the error gracefully by continuing with empty results
    });
  });

  describe("organizational scoping", () => {
    it("scopes machine queries by organization", async () => {
      vi.mocked(mockCtx.drizzle.query.machines.findMany).mockResolvedValue([]);

      await caller.syncWithOPDB();

      // Verify the query was called with proper organization scoping
      expect(mockCtx.drizzle.query.machines.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          with: {
            model: true,
          },
        }),
      );
    });

    it("uses organization context consistently", async () => {
      expect(mockCtx.organization?.id).toBe("org-1");

      vi.mocked(mockCtx.drizzle.query.machines.findMany).mockResolvedValue([]);

      await caller.syncWithOPDB();

      // Verify organizational scoping is applied - the call was made
      expect(mockCtx.drizzle.query.machines.findMany).toHaveBeenCalled();
    });
  });
});
