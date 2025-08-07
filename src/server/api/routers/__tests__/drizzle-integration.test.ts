/**
 * Drizzle tRPC Integration Tests
 *
 * Validates that Drizzle client is properly integrated into tRPC context
 * and can be used alongside Prisma during the migration period.
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

describe("Drizzle tRPC Integration", () => {
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

    // Create enhanced context with Drizzle client
    const baseContext = createVitestMockContext();
    mockContext = {
      ...baseContext,
      drizzle: mockDrizzleClient,
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
      expect(mockContext.drizzle).toBeDefined();
      expect(mockContext.drizzle).toBe(mockDrizzleClient);
    });

    it("should have both Prisma and Drizzle clients in context", () => {
      expect(mockContext.db).toBeDefined();
      expect(mockContext.drizzle).toBeDefined();
      expect(mockContext.db).not.toBe(mockContext.drizzle);
    });

    it("should be able to create tRPC router with dual-ORM context", () => {
      const testRouter = createTRPCRouter({
        testProcedure: publicProcedure.query(({ ctx }) => {
          // Validate both clients are available
          if (!ctx.db) throw new Error("Prisma client missing");
          if (!ctx.drizzle) throw new Error("Drizzle client missing");

          return {
            hasPrisma: !!ctx.db,
            hasDrizzle: !!ctx.drizzle,
          };
        }),
      });

      const caller = testRouter.createCaller(mockContext);
      expect(caller).toBeDefined();
    });
  });

  describe("Schema Integration", () => {
    it("should have all expected Drizzle schema exports", () => {
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
          if (!ctx.drizzle) {
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
        drizzle: undefined,
      } as unknown as TRPCContext;

      const caller = testRouter.createCaller(contextWithoutDrizzle);

      await expect(caller.testMissingDrizzle()).rejects.toThrow(
        "Drizzle client not available",
      );
    });

    it("should handle missing Prisma client gracefully", async () => {
      const testRouter = createTRPCRouter({
        testMissingPrisma: publicProcedure.query(({ ctx }) => {
          if (!ctx.db) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Prisma client not available",
            });
          }
          return { success: true };
        }),
      });

      // Create context without prisma
      const contextWithoutPrisma = {
        ...mockContext,
        db: undefined,
      } as unknown as TRPCContext;

      const caller = testRouter.createCaller(contextWithoutPrisma);

      await expect(caller.testMissingPrisma()).rejects.toThrow(
        "Prisma client not available",
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
              hasDrizzle: !!ctx.drizzle,
              hasPrisma: !!ctx.db,
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
          const hasSelect = typeof ctx.drizzle.select === "function";
          const hasInsert = typeof ctx.drizzle.insert === "function";
          const hasUpdate = typeof ctx.drizzle.update === "function";
          const hasDelete = typeof ctx.drizzle.delete === "function";
          const hasTransaction = typeof ctx.drizzle.transaction === "function";

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
      expect(mockContext.drizzle).toBe(mockDrizzleClient);

      // Ensure it satisfies the DrizzleClient type
      const client: DrizzleClient = mockDrizzleClient;
      expect(client).toBeDefined();
    });
  });
});
