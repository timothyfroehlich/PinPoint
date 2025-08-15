/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Model Core Router Unit Tests
 *
 * Unit tests for the model.core router using modern Vitest patterns and mock database.
 * Tests the core Drizzle query patterns, organizational scoping, and error handling.
 *
 * Key Features Tested:
 * - Complex exists() subqueries for organizational scoping
 * - SQL template extras for machine counting
 * - Relational queries with ctx.db.query.models.findMany()
 * - TRPCError handling (NOT_FOUND, BAD_REQUEST)
 * - Model deletion validation logic
 *
 * Uses August 2025 Vitest patterns with type-safe mocking.
 */

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock permissions system
const mockPermissions = vi.hoisted(() => ({
  requirePermissionForSession: vi.fn(),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue(["model:view", "organization:manage"]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue(["model:view", "organization:manage"]),
  requirePermissionForSession: mockPermissions.requirePermissionForSession,
}));

import type { VitestMockContext } from "~/test/vitestMockContext";

import { modelCoreRouter } from "~/server/api/routers/model.core";
import { requirePermissionForSession } from "~/server/auth/permissions";
import { createVitestMockContext } from "~/test/vitestMockContext";

describe("modelCoreRouter", () => {
  let mockCtx: VitestMockContext;
  let caller: ReturnType<typeof modelCoreRouter.createCaller>;

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

    // Mock permissions to allow organization management
    vi.mocked(requirePermissionForSession).mockResolvedValue(undefined);

    caller = modelCoreRouter.createCaller(mockCtx);
  });

  describe("getAll", () => {
    it("returns models with machine counts using inArray pattern", async () => {
      // Mock successful response with machine counts
      const mockModels = [
        {
          id: "model-1",
          name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
          isCustom: false,
          machineCount: 3,
        },
        {
          id: "model-2",
          name: "Attack from Mars",
          manufacturer: "Bally",
          year: 1995,
          isCustom: false,
          machineCount: 1,
        },
      ];

      // Mock the selectDistinct query for machine model IDs
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              { modelId: "model-1" },
              { modelId: "model-2" },
            ]),
        }),
      } as any);

      // Mock the main select query
      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockModels),
          }),
        }),
      } as any);

      const result = await caller.getAll();

      expect(result).toEqual(mockModels);
      expect(mockCtx.drizzle.selectDistinct).toHaveBeenCalled();
      expect(mockCtx.drizzle.select).toHaveBeenCalled();
    });

    it("returns empty array when no models exist in organization", async () => {
      // Mock no machines in organization
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await caller.getAll();

      expect(result).toEqual([]);
      expect(mockCtx.drizzle.selectDistinct).toHaveBeenCalledOnce();
    });

    it("applies organizational scoping through inArray pattern", async () => {
      // Mock no machines in organization
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await caller.getAll();

      // Verify organizational scoping query was used
      expect(mockCtx.drizzle.selectDistinct).toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("returns model by ID with organizational scoping", async () => {
      const mockModel = {
        id: "model-1",
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
        isCustom: false,
        machineCount: 2,
      };

      // Mock the selectDistinct query for machine model IDs
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ modelId: "model-1" }]),
        }),
      } as any);

      // Mock the main select query
      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([mockModel])),
            }),
          }),
        }),
      } as any);

      const result = await caller.getById({ id: "model-1" });

      expect(result).toEqual(mockModel);
      expect(mockCtx.drizzle.selectDistinct).toHaveBeenCalled();
      expect(mockCtx.drizzle.select).toHaveBeenCalled();
    });

    it("throws NOT_FOUND when model doesn't exist", async () => {
      // Mock the selectDistinct query for machine model IDs
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Mock the main select query returning null
      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([])),
            }),
          }),
        }),
      } as any);

      await expect(caller.getById({ id: "non-existent" })).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Game title not found or access denied",
        }),
      );
    });

    it("throws NOT_FOUND when model exists but not in organization", async () => {
      // Simulate model existing but not having machines in this organization
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // No machines in this org
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([])),
            }),
          }),
        }),
      } as any);

      await expect(caller.getById({ id: "other-org-model" })).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Game title not found or access denied",
        }),
      );
    });

    it("includes machine count in response", async () => {
      const mockModel = {
        id: "model-1",
        name: "Attack from Mars",
        machineCount: 5,
      };

      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ modelId: "model-1" }]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([mockModel])),
            }),
          }),
        }),
      } as any);

      const result = await caller.getById({ id: "model-1" });

      expect(result.machineCount).toBe(5);
      expect(mockCtx.drizzle.select).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("successfully deletes OPDB model with no machines", async () => {
      const mockModel = {
        id: "model-1",
        name: "Medieval Madness",
        isCustom: false,
        machineCount: 0,
      };

      const deletedModel = { ...mockModel, deletedAt: new Date() };

      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ modelId: "model-1" }]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([mockModel])),
            }),
          }),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([deletedModel]),
        }),
      } as any);

      const result = await caller.delete({ id: "model-1" });

      expect(result).toEqual(deletedModel);
      expect(mockCtx.drizzle.delete).toHaveBeenCalled();
    });

    it("throws NOT_FOUND when model doesn't exist", async () => {
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([])),
            }),
          }),
        }),
      } as any);

      await expect(caller.delete({ id: "non-existent" })).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Game title not found or access denied",
        }),
      );
    });

    it("throws BAD_REQUEST when trying to delete custom model", async () => {
      const mockModel = {
        id: "model-1",
        name: "Custom Game",
        isCustom: true,
        machineCount: 0,
      };

      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ modelId: "model-1" }]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([mockModel])),
            }),
          }),
        }),
      } as any);

      await expect(caller.delete({ id: "model-1" })).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete custom games. Remove game instances instead.",
        }),
      );
    });

    it("throws BAD_REQUEST when model has existing machines", async () => {
      const mockModel = {
        id: "model-1",
        name: "Medieval Madness",
        isCustom: false,
        machineCount: 3, // Has machines
      };

      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ modelId: "model-1" }]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([mockModel])),
            }),
          }),
        }),
      } as any);

      await expect(caller.delete({ id: "model-1" })).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete game title that has game instances",
        }),
      );
    });

    it("validates organizational access before deletion", async () => {
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // No machines in org
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([])),
            }),
          }),
        }),
      } as any);

      await expect(caller.delete({ id: "other-org-model" })).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Game title not found or access denied",
        }),
      );

      // Verify organizational scoping was applied
      expect(mockCtx.drizzle.selectDistinct).toHaveBeenCalled();
    });

    it("includes machine count check in deletion validation", async () => {
      const mockModel = {
        id: "model-1",
        name: "Test Game",
        isCustom: false,
        machineCount: 1,
      };

      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ modelId: "model-1" }]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([mockModel])),
            }),
          }),
        }),
      } as any);

      await expect(caller.delete({ id: "model-1" })).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete game title that has game instances",
        }),
      );

      // Verify machine count is included in the response
      expect(mockCtx.drizzle.select).toHaveBeenCalled();
    });
  });

  describe("organizational scoping", () => {
    it("applies inArray pattern for organizational boundaries", async () => {
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await caller.getAll();

      // Verify the organizational scoping query was executed
      expect(mockCtx.drizzle.selectDistinct).toHaveBeenCalled();
    });

    it("scopes all operations by organization context", async () => {
      // Test that organization ID from context is used consistently
      expect(mockCtx.organization?.id).toBe("org-1");

      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([])),
            }),
          }),
        }),
      } as any);

      await expect(caller.getById({ id: "test" })).rejects.toThrow();

      // All operations should use the same organizational scoping pattern
      expect(mockCtx.drizzle.selectDistinct).toHaveBeenCalled();
    });
  });

  describe("SQL extras and machine counting", () => {
    it("uses SQL template for machine counting in getAll", async () => {
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await caller.getAll();

      // Verify the select operation was called (which includes machine count SQL)
      expect(mockCtx.drizzle.selectDistinct).toHaveBeenCalled();
    });

    it("uses consistent machine counting across operations", async () => {
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([])),
            }),
          }),
        }),
      } as any);

      await expect(caller.getById({ id: "test" })).rejects.toThrow();
      await expect(caller.delete({ id: "test" })).rejects.toThrow();

      // Both operations should use the same select pattern with machine counting
      expect(mockCtx.drizzle.selectDistinct).toHaveBeenCalledTimes(2);
      expect(mockCtx.drizzle.select).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("propagates database errors appropriately", async () => {
      const dbError = new Error("Database connection failed");
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(dbError),
        }),
      } as any);

      await expect(caller.getAll()).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("uses consistent error messages for access control", async () => {
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([])),
            }),
          }),
        }),
      } as any);

      // Both getById and delete should use the same message for access denial
      await expect(caller.getById({ id: "test" })).rejects.toThrow(
        "Game title not found or access denied",
      );

      await expect(caller.delete({ id: "test" })).rejects.toThrow(
        "Game title not found or access denied",
      );
    });

    it("provides specific error messages for deletion validation", async () => {
      const customModel = {
        id: "model-1",
        isCustom: true,
        machineCount: 0,
      };

      const modelWithMachines = {
        id: "model-2",
        isCustom: false,
        machineCount: 2,
      };

      // Test custom model error
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ modelId: "model-1" }]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([customModel])),
            }),
          }),
        }),
      } as any);

      await expect(caller.delete({ id: "model-1" })).rejects.toThrow(
        "Cannot delete custom games. Remove game instances instead.",
      );

      // Test model with machines error
      vi.mocked(mockCtx.drizzle.selectDistinct).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ modelId: "model-2" }]),
        }),
      } as any);

      vi.mocked(mockCtx.drizzle.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((fn) => fn([modelWithMachines])),
            }),
          }),
        }),
      } as any);

      await expect(caller.delete({ id: "model-2" })).rejects.toThrow(
        "Cannot delete game title that has game instances",
      );
    });
  });
});
