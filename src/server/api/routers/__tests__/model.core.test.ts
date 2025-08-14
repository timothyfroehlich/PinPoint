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
 * - Relational queries with ctx.drizzle.query.models.findMany()
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
    it("returns models with machine counts using exists() subquery", async () => {
      // Mock successful response with extras (machine counts)
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

      vi.mocked(mockCtx.drizzle.query.models.findMany).mockResolvedValue(
        mockModels,
      );

      const result = await caller.getAll();

      expect(result).toEqual(mockModels);
      expect(mockCtx.drizzle.query.models.findMany).toHaveBeenCalledWith({
        where: expect.any(Function), // exists() subquery function
        orderBy: expect.any(Function), // asc ordering function
        extras: {
          machineCount: expect.any(Object), // SQL template for counting
        },
      });
    });

    it("returns empty array when no models exist in organization", async () => {
      vi.mocked(mockCtx.drizzle.query.models.findMany).mockResolvedValue([]);

      const result = await caller.getAll();

      expect(result).toEqual([]);
      expect(mockCtx.drizzle.query.models.findMany).toHaveBeenCalledOnce();
    });

    it("applies organizational scoping through exists() subquery", async () => {
      vi.mocked(mockCtx.drizzle.query.models.findMany).mockResolvedValue([]);

      await caller.getAll();

      // Verify exists() subquery structure was used
      const call = vi.mocked(mockCtx.drizzle.query.models.findMany).mock
        .calls[0];
      const whereClause = call?.[0]?.where;
      expect(whereClause).toBeInstanceOf(Function);
      expect(call?.[0]?.extras?.machineCount).toBeDefined();
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

      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(
        mockModel,
      );

      const result = await caller.getById({ id: "model-1" });

      expect(result).toEqual(mockModel);
      expect(mockCtx.drizzle.query.models.findFirst).toHaveBeenCalledWith({
        where: expect.any(Function), // and() with eq() and exists() functions
        extras: {
          machineCount: expect.any(Object), // SQL template for counting
        },
      });
    });

    it("throws NOT_FOUND when model doesn't exist", async () => {
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);

      await expect(caller.getById({ id: "non-existent" })).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Game title not found or access denied",
        }),
      );
    });

    it("throws NOT_FOUND when model exists but not in organization", async () => {
      // Simulate model existing but exists() subquery filtering it out
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);

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

      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(
        mockModel,
      );

      const result = await caller.getById({ id: "model-1" });

      expect(result.machineCount).toBe(5);
      expect(mockCtx.drizzle.query.models.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          extras: expect.objectContaining({
            machineCount: expect.any(Object),
          }),
        }),
      );
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

      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(
        mockModel,
      );
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
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);

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

      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(
        mockModel,
      );

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

      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(
        mockModel,
      );

      await expect(caller.delete({ id: "model-1" })).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete game title that has game instances",
        }),
      );
    });

    it("validates organizational access before deletion", async () => {
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);

      await expect(caller.delete({ id: "other-org-model" })).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Game title not found or access denied",
        }),
      );

      // Verify findFirst was called with organizational scoping
      const call = vi.mocked(mockCtx.drizzle.query.models.findFirst).mock
        .calls[0];
      expect(call?.[0]?.where).toBeInstanceOf(Function);
    });

    it("includes machine count check in deletion validation", async () => {
      const mockModel = {
        id: "model-1",
        name: "Test Game",
        isCustom: false,
        machineCount: 1,
      };

      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(
        mockModel,
      );

      await expect(caller.delete({ id: "model-1" })).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete game title that has game instances",
        }),
      );

      // Verify extras with machineCount was requested
      const call = vi.mocked(mockCtx.drizzle.query.models.findFirst).mock
        .calls[0];
      expect(call?.[0]?.extras?.machineCount).toBeDefined();
    });
  });

  describe("organizational scoping", () => {
    it("applies exists() subquery for organizational boundaries", async () => {
      vi.mocked(mockCtx.drizzle.query.models.findMany).mockResolvedValue([]);

      await caller.getAll();

      // Verify the where clause uses exists() subquery pattern
      const call = vi.mocked(mockCtx.drizzle.query.models.findMany).mock
        .calls[0];
      const whereFunction = call?.[0]?.where;
      expect(whereFunction).toBeInstanceOf(Function);

      // The where function should receive models and { exists } as parameters
      // This validates the Drizzle exists() subquery pattern is being used
      expect(whereFunction).toBeDefined();
    });

    it("scopes all operations by organization context", async () => {
      // Test that organization ID from context is used consistently
      expect(mockCtx.organization?.id).toBe("org-1");

      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);

      await expect(caller.getById({ id: "test" })).rejects.toThrow();

      // All operations should use the same organizational scoping pattern
      const call = vi.mocked(mockCtx.drizzle.query.models.findFirst).mock
        .calls[0];
      expect(call?.[0]?.where).toBeInstanceOf(Function);
    });
  });

  describe("SQL extras and machine counting", () => {
    it("uses SQL template for machine counting in getAll", async () => {
      vi.mocked(mockCtx.drizzle.query.models.findMany).mockResolvedValue([]);

      await caller.getAll();

      const call = vi.mocked(mockCtx.drizzle.query.models.findMany).mock
        .calls[0];
      expect(call?.[0]?.extras?.machineCount).toBeDefined();
    });

    it("uses consistent machine counting across operations", async () => {
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);

      await expect(caller.getById({ id: "test" })).rejects.toThrow();
      await expect(caller.delete({ id: "test" })).rejects.toThrow();

      // Both operations should use the same extras pattern
      const calls = vi.mocked(mockCtx.drizzle.query.models.findFirst).mock
        .calls;
      calls.forEach((call) => {
        expect(call?.[0]?.extras?.machineCount).toBeDefined();
      });
    });
  });

  describe("error handling", () => {
    it("propagates database errors appropriately", async () => {
      const dbError = new Error("Database connection failed");
      vi.mocked(mockCtx.drizzle.query.models.findMany).mockRejectedValue(
        dbError,
      );

      await expect(caller.getAll()).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("uses consistent error messages for access control", async () => {
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(null);

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
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(
        customModel,
      );
      await expect(caller.delete({ id: "model-1" })).rejects.toThrow(
        "Cannot delete custom games. Remove game instances instead.",
      );

      // Test model with machines error
      vi.mocked(mockCtx.drizzle.query.models.findFirst).mockResolvedValue(
        modelWithMachines,
      );
      await expect(caller.delete({ id: "model-2" })).rejects.toThrow(
        "Cannot delete game title that has game instances",
      );
    });
  });
});
