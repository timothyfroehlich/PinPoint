/**
 * Drizzle Schema & tRPC Context Unit Tests
 *
 * Unit tests for Drizzle schema validation and tRPC context integration.
 * Validates schema structure, type safety, and context availability.
 *
 * Note: This is unit testing (schema validation) rather than integration testing.
 * For actual database operations with routers, see router integration tests.
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

import type { TRPCContext } from "~/server/api/trpc.base";
import type { DrizzleClient } from "~/server/db/drizzle";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import * as drizzleSchema from "~/server/db/schema";
import { createVitestMockContext } from "~/test/vitestMockContext";

describe("Drizzle Schema & tRPC Context Unit Tests", () => {
  let mockContext: TRPCContext;
  let mockDrizzleClient: DrizzleClient;

  beforeEach(() => {
    // Create a simple mock that satisfies the DrizzleClient type
    mockDrizzleClient = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
      execute: vi.fn(),
    } as unknown as DrizzleClient;

    // Create enhanced context with Drizzle client (single client pattern)
    const baseContext = createVitestMockContext();
    mockContext = {
      ...baseContext,
      db: mockDrizzleClient, // Use single client pattern
      user: {
        id: "user-1",
        email: "test@example.com",
        aud: "authenticated",
        created_at: new Date().toISOString(),
        user_metadata: { name: "Test User" },
        app_metadata: { organization_id: "org-1" },
      } as any,
      organization: {
        id: "org-1",
        name: "Test Organization",
        subdomain: "test",
      },
      membership: {
        id: "membership-1",
        userId: "user-1",
        organizationId: "org-1",
        roleId: "role-1",
      },
      userPermissions: ["issue:view"],
    } as unknown as TRPCContext;

    vi.clearAllMocks();
  });

  describe("Context Integration", () => {
    it("should have Drizzle client available in tRPC context", () => {
      expect(mockContext.db).toBeDefined();
      expect(mockContext.db).toBe(mockDrizzleClient);
    });

    it("should be able to create tRPC router with Drizzle context", () => {
      const testRouter = createTRPCRouter({
        testProcedure: publicProcedure.query(({ ctx }) => {
          // Validate Drizzle client is available
          if (!ctx.db) throw new Error("Drizzle client missing");

          return {
            hasDrizzle: !!ctx.db,
          };
        }),
      });

      const caller = testRouter.createCaller(mockContext);
      expect(caller).toBeDefined();
    });
  });

  describe("Schema Validation (Unit Tests)", () => {
    it("should export all expected Drizzle schema tables", () => {
      // Validate that our schema exports are available
      expect(drizzleSchema.users).toBeDefined();
      expect(drizzleSchema.organizations).toBeDefined();
      expect(drizzleSchema.locations).toBeDefined();
      expect(drizzleSchema.machines).toBeDefined();
      expect(drizzleSchema.models).toBeDefined();
      expect(drizzleSchema.issues).toBeDefined();
      expect(drizzleSchema.memberships).toBeDefined();
      expect(drizzleSchema.roles).toBeDefined();
      expect(drizzleSchema.permissions).toBeDefined();
    });

    it("should have proper schema table structure", () => {
      // Validate key fields exist on main tables
      expect(drizzleSchema.users.id).toBeDefined();
      expect(drizzleSchema.users.email).toBeDefined();
      expect(drizzleSchema.users.name).toBeDefined();

      expect(drizzleSchema.organizations.id).toBeDefined();
      expect(drizzleSchema.organizations.name).toBeDefined();
      expect(drizzleSchema.organizations.subdomain).toBeDefined();

      expect(drizzleSchema.machines.id).toBeDefined();
      expect(drizzleSchema.machines.qrCodeId).toBeDefined();
      expect(drizzleSchema.machines.organizationId).toBeDefined();
    });

    it("should support eq() function from drizzle-orm", () => {
      // Validate that drizzle-orm functions work with our schema
      const userFilter = eq(drizzleSchema.users.id, "test-id");
      expect(userFilter).toBeDefined();

      const orgFilter = eq(drizzleSchema.organizations.subdomain, "test");
      expect(orgFilter).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing Drizzle client gracefully", async () => {
      const testRouter = createTRPCRouter({
        testMissingDrizzle: publicProcedure.query(({ ctx }) => {
          if (!ctx.db) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Drizzle client not available",
            });
          }
          return { success: true };
        }),
      });

      // Create context without drizzle
      const contextWithoutDrizzle = {
        ...mockContext,
        db: undefined,
      } as unknown as TRPCContext;

      const caller = testRouter.createCaller(contextWithoutDrizzle);

      await expect(caller.testMissingDrizzle()).rejects.toThrow(
        "Drizzle client not available",
      );
    });

    it("should handle missing database client gracefully", async () => {
      const testRouter = createTRPCRouter({
        testMissingDb: publicProcedure.query(({ ctx }) => {
          if (!ctx.db) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Database client not available",
            });
          }
          return { success: true };
        }),
      });

      // Create context without database client
      const contextWithoutDb = {
        ...mockContext,
        db: undefined,
      } as unknown as TRPCContext;

      const caller = testRouter.createCaller(contextWithoutDb);

      await expect(caller.testMissingDb()).rejects.toThrow(
        "Database client not available",
      );
    });
  });

  describe("Type Safety", () => {
    it("should maintain TypeScript type safety", () => {
      // This test validates compilation - if it compiles, types are working
      const testRouter = createTRPCRouter({
        typeValidation: publicProcedure
          .input(z.object({ test: z.string() }))
          .query(({ ctx, input }) => {
            // TypeScript should infer correct types
            const userId: string = ctx.user?.id ?? "test-user";
            const orgId: string = ctx.organization?.id ?? "test-org";
            const testInput: string = input.test;

            return {
              userId,
              orgId,
              testInput,
              hasDrizzle: !!ctx.db,
            };
          }),
      });

      const caller = testRouter.createCaller(mockContext);
      expect(caller).toBeDefined();
    });

    it("should support Drizzle client methods in TypeScript", async () => {
      // Validate that DrizzleClient methods are typed correctly
      const testRouter = createTRPCRouter({
        drizzleMethodTest: publicProcedure.query(({ ctx }) => {
          // These should all be typed methods on DrizzleClient
          const hasSelect = typeof ctx.db.select === "function";
          const hasInsert = typeof ctx.db.insert === "function";
          const hasUpdate = typeof ctx.db.update === "function";
          const hasDelete = typeof ctx.db.delete === "function";
          const hasTransaction = typeof ctx.db.transaction === "function";

          return {
            hasSelect,
            hasInsert,
            hasUpdate,
            hasDelete,
            hasTransaction,
          };
        }),
      });

      const caller = testRouter.createCaller(mockContext);
      const result = await caller.drizzleMethodTest();

      expect(result).toEqual({
        hasSelect: true,
        hasInsert: true,
        hasUpdate: true,
        hasDelete: true,
        hasTransaction: true,
      });
    });
  });

  describe("Mock Validation", () => {
    it("should validate mock client structure", () => {
      // Ensure our mock has the expected methods
      expect(typeof mockDrizzleClient.select).toBe("function");
      expect(typeof mockDrizzleClient.insert).toBe("function");
      expect(typeof mockDrizzleClient.update).toBe("function");
      expect(typeof mockDrizzleClient.delete).toBe("function");
      expect(typeof mockDrizzleClient.transaction).toBe("function");
    });

    it("should validate mock integration without method calls", () => {
      // Validate the mock client is properly integrated
      expect(mockDrizzleClient).toBeDefined();
      expect(mockContext.db).toBe(mockDrizzleClient);

      // Ensure it satisfies the DrizzleClient type
      const client: DrizzleClient = mockDrizzleClient;
      expect(client).toBeDefined();
    });
  });
});
