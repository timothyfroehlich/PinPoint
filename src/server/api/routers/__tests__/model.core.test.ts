/**
 * Model Router Integration Tests (tRPC + PGlite)
 *
 * Real tRPC router integration tests using PGlite in-memory PostgreSQL database.
 * Tests the simplified single-table model architecture with OPDB global models.
 *
 * Converted from mock-heavy unit tests to proper Archetype 5 (tRPC Router Integration) patterns.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real tRPC router operations with simplified model architecture
 * - OPDB models (organizationId = NULL) accessible globally
 * - Custom models (organizationId != NULL) scoped to organizations (v1.x feature)
 * - Multi-tenant data isolation testing
 * - Worker-scoped database for memory safety
 * - No deletion operations - OPDB models are read-only in beta
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";

import { appRouter } from "~/server/api/root";
import * as schema from "~/server/db/schema";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { getSeededTestData } from "~/test/helpers/pglite-test-setup";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => generateTestId("test-id")),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "model:view",
      "model:create",
      "model:edit",
      "model:delete",
      "organization:manage",
    ]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue([
      "model:view",
      "model:create",
      "model:edit",
      "model:delete",
      "organization:manage",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
  supabaseUserToSession: vi.fn((user) => ({
    user: {
      id: user?.id ?? generateTestId("fallback-user"),
      email: user?.email ?? "test@example.com",
      name: user?.name ?? "Test User",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })),
}));

describe("Model Router Integration Tests (Simplified Single-Table Architecture)", () => {
  // Helper function to get seeded test data and context
  async function setupTestData(db: TestDatabase) {
    // Use pre-seeded data instead of creating duplicates
    const organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary;
    const seededData = await getSeededTestData(db, organizationId);

    if (!seededData.adminRole || !seededData.user) {
      throw new Error(
        "Pre-seeded test data not found - check worker database setup",
      );
    }

    // Use seeded location (should always be available)
    const location = await db.query.locations.findFirst({
      where: eq(schema.locations.id, SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR),
    });

    if (!location) {
      throw new Error(`Seeded location ${seededData.location} not found`);
    }

    // Create OPDB models (global - use schema defaults)
    const [model1] = await db
      .insert(schema.models)
      .values({
        id: generateTestId("model-1"),
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
        // organizationId defaults to null (global OPDB)
        // isCustom defaults to false (OPDB model)
      })
      .returning();

    const [model2] = await db
      .insert(schema.models)
      .values({
        id: generateTestId("model-2"),
        name: "Attack from Mars",
        manufacturer: "Bally",
        year: 1995,
        // organizationId defaults to null (global OPDB)
        // isCustom defaults to false (OPDB model)
      })
      .returning();

    // Create machines to test machine counts
    await db.insert(schema.machines).values([
      {
        id: generateTestId("machine-1"),
        name: "Medieval Madness #1",
        qrCodeId: generateTestId("qr-1"),
        organizationId,
        locationId: location.id,
        modelId: model1.id,
        ownerId: seededData.user,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: generateTestId("machine-2"),
        name: "Medieval Madness #2",
        qrCodeId: generateTestId("qr-2"),
        organizationId,
        locationId: location.id,
        modelId: model1.id,
        ownerId: seededData.user,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: generateTestId("machine-3"),
        name: "Attack from Mars #1",
        qrCodeId: generateTestId("qr-3"),
        organizationId,
        locationId: location.id,
        modelId: model2.id,
        ownerId: seededData.user,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Get the seeded user for context
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, SEED_TEST_IDS.USERS.ADMIN),
    });

    if (!user) {
      throw new Error(`Seeded user ${seededData.user} not found`);
    }

    // Get the seeded organization for context
    const organization = await db.query.organizations.findFirst({
      where: eq(schema.organizations.id, organizationId),
    });

    if (!organization) {
      throw new Error(`Seeded organization ${organizationId} not found`);
    }

    // Create test context with seeded data
    const ctx: TRPCContext = {
      db: db,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_metadata: {},
        app_metadata: {
          organization_id: organizationId,
        },
      },
      organization: {
        id: organization.id,
        name: organization.name,
        subdomain: organization.subdomain,
      },
      organizationId: organizationId,
      supabase: {} as any, // Not used in this router
      headers: new Headers(),
      userPermissions: [
        "model:view",
        "model:create",
        "model:edit",
        "model:delete",
        "organization:manage",
      ],
      services: {} as any, // Not used in this router
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(() => ctx.logger),
        withRequest: vi.fn(() => ctx.logger),
        withUser: vi.fn(() => ctx.logger),
        withOrganization: vi.fn(() => ctx.logger),
        withContext: vi.fn(() => ctx.logger),
      } as any,
    };

    return {
      ctx,
      organizationId,
      user,
      location,
      models: { model1, model2 },
      seededData,
    };
  }

  describe("Model Retrieval Operations", () => {
    test("should return models with machine counts using real database operations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, models } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        const result = await caller.model.getAll();

        // Verify the result includes our test models (plus any seeded models)
        expect(result.length).toBeGreaterThanOrEqual(2);

        // Find Medieval Madness model (has 2 machines)
        const medievalMadness = result.find(
          (m) => m.name === "Medieval Madness" && m.id === models.model1.id,
        );
        expect(medievalMadness).toMatchObject({
          id: models.model1.id,
          name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
          isCustom: false,
          machineCount: 2, // Real count from database
        });

        // Find Attack from Mars model (has 1 machine)
        const attackFromMars = result.find(
          (m) => m.name === "Attack from Mars",
        );
        expect(attackFromMars).toMatchObject({
          id: models.model2.id,
          name: "Attack from Mars",
          manufacturer: "Bally",
          year: 1995,
          isCustom: false,
          machineCount: 1, // Real count from database
        });
      });
    });

    test("should return empty array when no models exist in organization", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create organization but no models or machines
        const organizationId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

        const [_org] = await db
          .insert(schema.organizations)
          .values({
            id: organizationId,
            name: "Empty Organization",
            subdomain: "empty",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [_testUser] = await db
          .insert(schema.users)
          .values({
            id: generateTestId("empty-user"),
            name: "Empty User",
            email: "empty@example.com",
            emailVerified: null,
          })
          .returning();

        const ctx: TRPCContext = {
          db: db,
          user: {
            id: testUser.id,
            email: "empty@example.com",
            name: "Empty User",
            user_metadata: {},
            app_metadata: {
              organization_id: organizationId,
            },
          },
          organization: {
            id: organizationId,
            name: "Empty Organization",
            subdomain: "empty",
          },
          organizationId: organizationId,
          supabase: {} as any,
          headers: new Headers(),
          userPermissions: ["model:view"],
          services: {} as any,
          logger: {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
            child: vi.fn(() => ctx.logger),
            withRequest: vi.fn(() => ctx.logger),
            withUser: vi.fn(() => ctx.logger),
            withOrganization: vi.fn(() => ctx.logger),
            withContext: vi.fn(() => ctx.logger),
          } as any,
        };

        const caller = appRouter.createCaller(ctx);
        const result = await caller.model.getAll();

        expect(result).toEqual([]);
      });
    });

    test("should enforce organizational scoping and isolation", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupTestData(db);

        // Create a second organization with its own models
        const [org2] = await db
          .insert(schema.organizations)
          .values({
            id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            name: "Competitor Organization",
            subdomain: "competitor",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create a custom model in org2 that should not be visible to org1
        await db.insert(schema.models).values({
          id: generateTestId("competitor-model"),
          name: "Competitor Model",
          manufacturer: "Competitor Corp",
          year: 2023,
          organizationId: org2.id, // Custom model belongs to org2
          isCustom: true, // Must explicitly set for custom models
        });

        const caller = appRouter.createCaller(ctx);
        const result = await caller.model.getAll();

        // Should only see models from primary organization
        expect(result).toHaveLength(2); // Only our test models
        expect(
          result.every((m) =>
            ["Medieval Madness", "Attack from Mars"].includes(m.name),
          ),
        ).toBe(true);
        expect(
          result.find((m) => m.name === "Competitor Model"),
        ).toBeUndefined();
      });
    });
  });

  describe("Model Individual Retrieval", () => {
    test("should return model by ID with real machine count", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, models } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        const result = await caller.model.getById({ id: models.model1.id });

        // Verify the result structure with real data
        expect(result).toMatchObject({
          id: models.model1.id,
          name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
          isCustom: false,
          machineCount: 2, // Real count from setupTestData
        });

        expect(result).toHaveProperty("machineCount");
        expect(typeof result.machineCount).toBe("number");
      });
    });

    test("should throw NOT_FOUND when model doesn't exist", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        await expect(
          caller.model.getById({ id: generateTestId("nonexistent") }),
        ).rejects.toThrow(TRPCError);

        await expect(
          caller.model.getById({ id: generateTestId("nonexistent") }),
        ).rejects.toThrow("Model not found or access denied");
      });
    });

    test("should throw NOT_FOUND when model exists but not in organization", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupTestData(db);

        // Create a model in a different organization
        const [org2] = await db
          .insert(schema.organizations)
          .values({
            id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            name: "Competitor Organization",
            subdomain: "competitor",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [otherOrgModel] = await db
          .insert(schema.models)
          .values({
            id: generateTestId("other-org-model"),
            name: "Other Org Model",
            manufacturer: "Other Corp",
            year: 2023,
            organizationId: org2.id, // Custom model belongs to org2
            isCustom: true, // Must explicitly set for custom models
          })
          .returning();

        const caller = appRouter.createCaller(ctx);

        // Should not be able to access model from different organization
        await expect(
          caller.model.getById({ id: otherOrgModel.id }),
        ).rejects.toThrow(TRPCError);

        await expect(
          caller.model.getById({ id: otherOrgModel.id }),
        ).rejects.toThrow("Model not found or access denied");
      });
    });

    test("should include accurate machine count in response", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const {
          ctx,
          models,
          organizationId,
          testUser: _testUser,
          location,
        } = await setupTestData(db);

        // Create additional machines for model2 to test different counts
        await db.insert(schema.machines).values([
          {
            id: generateTestId("machine-4"),
            name: "Attack from Mars #2",
            qrCodeId: generateTestId("qr-4"),
            organizationId,
            locationId: location.id,
            modelId: models.model2.id,
            ownerId: seededData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: generateTestId("machine-5"),
            name: "Attack from Mars #3",
            qrCodeId: generateTestId("qr-5"),
            organizationId,
            locationId: location.id,
            modelId: models.model2.id,
            ownerId: seededData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const caller = appRouter.createCaller(ctx);
        const result = await caller.model.getById({ id: models.model2.id });

        expect(result).toHaveProperty("machineCount");
        expect(result.machineCount).toBe(3); // 1 from setup + 2 additional = 3
        expect(typeof result.machineCount).toBe("number");
      });
    });
  });

  // Note: Model deletion operations removed - OPDB models are read-only in beta
  // Custom model deletion will be implemented in v1.x

  describe("Cross-Organizational Security Testing", () => {
    test("should enforce organizational boundaries across all operations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, models: _models } = await setupTestData(db);

        // Create a second organization with its own data
        const [org2] = await db
          .insert(schema.organizations)
          .values({
            id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            name: "Competitor Organization",
            subdomain: "competitor",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create custom models in org2 that should not be visible to org1
        await db.insert(schema.models).values([
          {
            id: generateTestId("competitor-model-1"),
            name: "Competitor Model 1",
            manufacturer: "Competitor Corp",
            year: 2023,
            organizationId: org2.id, // Custom model belongs to org2
            isCustom: true, // Must explicitly set for custom models
          },
          {
            id: generateTestId("competitor-model-2"),
            name: "Competitor Model 2",
            manufacturer: "Another Corp",
            year: 2024,
            organizationId: org2.id, // Custom model belongs to org2
            isCustom: true, // Must explicitly set for custom models
          },
        ]);

        const caller = appRouter.createCaller(ctx);

        // Test getAll - should only see primary org models
        const allModels = await caller.model.getAll();
        expect(allModels).toHaveLength(2); // Only our test models
        expect(
          allModels.every((m) =>
            ["Medieval Madness", "Attack from Mars"].includes(m.name),
          ),
        ).toBe(true);
        expect(
          allModels.find((m) => m.name.includes("Competitor")),
        ).toBeUndefined();

        // Test getById - should not access competitor org models
        await expect(
          caller.model.getById({ id: generateTestId("competitor-model-1") }),
        ).rejects.toThrow("Model not found or access denied");

        // Note: Delete operations removed - OPDB models are read-only in beta
      });
    });

    test("should maintain data integrity across organizations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx, organizationId: _organizationId } =
          await setupTestData(db);

        // Create context for competitor organization
        const [competitorUser] = await db
          .insert(schema.users)
          .values({
            id: generateTestId("competitor-user"),
            name: "Competitor User",
            email: "competitor@example.com",
            emailVerified: null,
          })
          .returning();

        const competitorCtx: TRPCContext = {
          db: db,
          user: {
            id: competitorUser.id,
            email: "competitor@example.com",
            name: "Competitor User",
            user_metadata: {},
            app_metadata: {
              organization_id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            },
          },
          organization: {
            id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            name: "Competitor Organization",
            subdomain: "competitor",
          },
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          supabase: {} as any,
          headers: new Headers(),
          userPermissions: [
            "model:view",
            "model:create",
            "model:edit",
            "model:delete",
            "organization:manage",
          ],
          services: {} as any,
          logger: {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
            child: vi.fn(() => competitorCtx.logger),
            withRequest: vi.fn(() => competitorCtx.logger),
            withUser: vi.fn(() => competitorCtx.logger),
            withOrganization: vi.fn(() => competitorCtx.logger),
            withContext: vi.fn(() => competitorCtx.logger),
          } as any,
        };

        const primaryCaller = appRouter.createCaller(ctx);
        const competitorCaller = appRouter.createCaller(competitorCtx);

        // Primary org should see global OPDB models (2) + no custom models
        const primaryModels = await primaryCaller.model.getAll();
        expect(primaryModels).toHaveLength(2); // Global OPDB models

        // Competitor org should see the same global OPDB models (2) since no custom models exist
        const competitorModels = await competitorCaller.model.getAll();
        expect(competitorModels).toHaveLength(2); // Same global OPDB models

        // Verify complete organizational isolation
        expect(primaryModels.every((m) => m.name !== "Competitor Model")).toBe(
          true,
        );
      });
    });
  });

  describe("Real Database Operations & Performance", () => {
    test("should perform accurate machine counting with complex relationships", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const {
          ctx,
          models: _models,
          organizationId,
          testUser: _testUser,
          location,
        } = await setupTestData(db);

        // Create additional OPDB model for complex test data
        const [newModel] = await db
          .insert(schema.models)
          .values({
            id: generateTestId("complex-model"),
            name: "Complex Model",
            manufacturer: "Complex Corp",
            year: 2023,
            // organizationId defaults to null (global OPDB)
            // isCustom defaults to false (OPDB model)
          })
          .returning();

        // Create many machines for this model to test counting accuracy
        const machineInserts = Array.from({ length: 7 }, (_, i) => ({
          id: generateTestId(`complex-machine-${i + 1}`),
          name: `Complex Machine #${i + 1}`,
          qrCodeId: generateTestId(`complex-qr-${i + 1}`),
          organizationId,
          locationId: location.id,
          modelId: newModel.id,
          ownerId: seededData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await db.insert(schema.machines).values(machineInserts);

        const caller = appRouter.createCaller(ctx);

        // Test getAll with accurate machine counts
        const allModels = await caller.model.getAll();
        expect(allModels).toHaveLength(3); // Original 2 + 1 new

        const complexModel = allModels.find((m) => m.name === "Complex Model");
        expect(complexModel).toBeDefined();
        expect(complexModel?.machineCount).toBe(7);

        // Test getById with accurate machine count
        const singleModel = await caller.model.getById({ id: newModel.id });
        expect(singleModel.machineCount).toBe(7);
        expect(singleModel.name).toBe("Complex Model");
      });
    });

    test("should handle database errors gracefully with real operations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { ctx } = await setupTestData(db);
        const caller = appRouter.createCaller(ctx);

        // Test with malformed ID (should handle gracefully)
        await expect(
          caller.model.getById({ id: "definitely-not-a-valid-id" }),
        ).rejects.toThrow("Model not found or access denied");

        // Test with empty string ID
        await expect(caller.model.getById({ id: "" })).rejects.toThrow(
          "Model not found or access denied",
        );
      });
    });

    // Note: Deletion business rules tests removed - OPDB models are read-only in beta
    // Custom model deletion will be implemented in v1.x
  });
});
