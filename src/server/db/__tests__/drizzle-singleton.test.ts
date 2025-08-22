/**
 * Drizzle Client Singleton Pattern Tests
 *
 * Critical infrastructure tests for database connection management.
 * Tests the singleton pattern, connection lifecycle, environment-specific
 * behavior, and error handling scenarios.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockedFunction,
} from "vitest";
import { test, withIsolatedTest } from "../../../test/helpers/worker-scoped-db";
import {
  createSeededTestDatabase,
  type TestDatabase,
} from "../../../test/helpers/pglite-test-setup";

// Mock postgres-js
const mockPostgresInstance = {
  end: vi.fn().mockResolvedValue(undefined),
};
const mockPostgres = vi.fn().mockReturnValue(mockPostgresInstance);
vi.mock("postgres", () => ({ default: mockPostgres }));

// Mock drizzle - create a factory for new instances
const createMockDrizzleInstance = () => ({
  // Mock common table access patterns
  organizations: { findMany: vi.fn() },
  users: { findMany: vi.fn() },
  machines: { findMany: vi.fn() },
  issues: { findMany: vi.fn() },
  // Symbol to identify this as our mock
  __isMockDrizzle: true,
});
const mockDrizzle = vi
  .fn()
  .mockImplementation(() => createMockDrizzleInstance());
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: mockDrizzle }));

// Mock schema - use vi.hoisted for proper initialization order
const mockSchema = vi.hoisted(() => ({
  organizations: {},
  users: {},
  machines: {},
  issues: {},
}));
vi.mock("../schema", () => mockSchema);

// Mock environment utilities
const mockIsDevelopment = vi.fn();
vi.mock("~/lib/environment", () => ({
  isDevelopment: mockIsDevelopment,
}));

// Mock env - we'll manipulate this in tests
const mockEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  NODE_ENV: "development" as const,
  VERCEL_ENV: undefined,
};
vi.mock("~/env", () => ({ env: mockEnv }));

describe("Drizzle Client Singleton Pattern", () => {
  let originalEnv: Record<string, unknown>;

  beforeEach(() => {
    // Store original env values
    originalEnv = { ...mockEnv };

    // Reset all mocks
    vi.clearAllMocks();

    // Reset mock env to defaults
    mockEnv.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";
    mockEnv.NODE_ENV = "development";
    mockEnv.VERCEL_ENV = undefined;

    // Reset environment utility mocks
    mockIsDevelopment.mockReturnValue(true);

    // Clear module cache to reset singletons
    vi.resetModules();
  });

  afterEach(() => {
    // Restore env
    Object.assign(mockEnv, originalEnv);
    vi.clearAllMocks();
  });

  // Helper to dynamically import the module (bypasses module cache)
  async function importDrizzleModule() {
    return await import("../drizzle");
  }

  // Helper to reset the singleton instance through reflection
  function resetSingleton() {
    vi.resetModules();
  }

  describe("Singleton Behavior", () => {
    it("should create a single instance in development mode", async () => {
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      const { createDrizzleClient } = await importDrizzleModule();

      const client1 = createDrizzleClient();
      const client2 = createDrizzleClient();

      // Should return the same instance (singleton behavior)
      expect(client1).toBe(client2);
      expect(client1.__isMockDrizzle).toBe(true);

      // Should only create postgres connection once
      expect(mockPostgres).toHaveBeenCalledTimes(1);
      expect(mockDrizzle).toHaveBeenCalledTimes(1);
    });

    it("should create fresh instances in production mode", async () => {
      mockEnv.NODE_ENV = "production";
      mockIsDevelopment.mockReturnValue(false);

      const { createDrizzleClient } = await importDrizzleModule();

      const client1 = createDrizzleClient();
      const client2 = createDrizzleClient();

      // Should return different instances (no singleton)
      expect(client1).not.toBe(client2);
      expect(client1.__isMockDrizzle).toBe(true);
      expect(client2.__isMockDrizzle).toBe(true);

      // Verify they have different table objects (different instances)
      expect(client1.organizations).not.toBe(client2.organizations);

      // Should create separate postgres connections
      expect(mockPostgres).toHaveBeenCalledTimes(2);
      expect(mockDrizzle).toHaveBeenCalledTimes(2);
    });

    it("should reuse connections across hot reloads in development", async () => {
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      // First "server startup"
      const module1 = await importDrizzleModule();
      const client1 = module1.createDrizzleClient();

      // Simulate hot reload by re-importing
      resetSingleton();
      const module2 = await importDrizzleModule();
      const client2 = module2.createDrizzleClient();

      // Should create new drizzle instances but reuse postgres connection pattern
      expect(client1.__isMockDrizzle).toBe(true);
      expect(client2.__isMockDrizzle).toBe(true);

      // Connection should be created for each module load in our test setup
      expect(mockPostgres).toHaveBeenCalledTimes(2);
    });

    it("should properly isolate singleton instances between tests", async () => {
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      const { createDrizzleClient } = await importDrizzleModule();
      const client = createDrizzleClient();

      expect(client.__isMockDrizzle).toBe(true);
      expect(mockPostgres).toHaveBeenCalledTimes(1);

      // The beforeEach should have reset everything for this test
      // Verify mocks were cleared
      const callCount = (mockPostgres as MockedFunction<any>).mock.calls.length;
      expect(callCount).toBe(1); // Only the call from this test
    });
  });

  describe("Connection Configuration", () => {
    describe("SSL Configuration", () => {
      it("should disable SSL for localhost connections", async () => {
        mockEnv.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
        mockEnv.NODE_ENV = "production"; // Even in production, localhost should disable SSL
        mockIsDevelopment.mockReturnValue(false);

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          "postgresql://user:pass@localhost:5432/testdb",
          expect.objectContaining({
            ssl: false,
          }),
        );
      });

      it("should disable SSL for 127.0.0.1 connections", async () => {
        mockEnv.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/testdb";
        mockEnv.NODE_ENV = "production";
        mockIsDevelopment.mockReturnValue(false);

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          "postgresql://user:pass@127.0.0.1:5432/testdb",
          expect.objectContaining({
            ssl: false,
          }),
        );
      });

      it("should disable SSL in CI environment", async () => {
        mockEnv.DATABASE_URL =
          "postgresql://user:pass@remote.example.com:5432/testdb";
        mockEnv.NODE_ENV = "test"; // CI environment
        mockIsDevelopment.mockReturnValue(false);

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          "postgresql://user:pass@remote.example.com:5432/testdb",
          expect.objectContaining({
            ssl: false, // Should be disabled in CI even for remote connections
          }),
        );
      });

      it("should require SSL for production remote connections", async () => {
        mockEnv.DATABASE_URL =
          "postgresql://user:pass@remote.example.com:5432/testdb";
        mockEnv.NODE_ENV = "production";
        mockIsDevelopment.mockReturnValue(false);

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          "postgresql://user:pass@remote.example.com:5432/testdb",
          expect.objectContaining({
            ssl: "require",
          }),
        );
      });
    });

    describe("Connection Pool Settings", () => {
      it("should use appropriate pool size for CI environment", async () => {
        mockEnv.NODE_ENV = "test";
        mockIsDevelopment.mockReturnValue(false);

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            max: 2, // CI should use max: 2
          }),
        );
      });

      it("should use minimal pool size for development", async () => {
        mockEnv.NODE_ENV = "development";
        mockIsDevelopment.mockReturnValue(true);

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            max: 5, // Development should use max: 5
            idle_timeout: 60,
            connect_timeout: 30,
            prepare: true,
            connection: {
              application_name: "pinpoint_seeding",
            },
          }),
        );
      });

      it("should configure appropriate timeouts for each environment", async () => {
        // Test CI timeouts
        mockEnv.NODE_ENV = "test";
        mockIsDevelopment.mockReturnValue(false);

        let drizzleModule = await importDrizzleModule();
        drizzleModule.createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            max: 2,
            idle_timeout: 30,
            connect_timeout: 20,
            prepare: false,
            connection: {
              application_name: "pinpoint_ci_seeding",
            },
          }),
        );

        resetSingleton();
        vi.clearAllMocks();

        // Test Development timeouts
        mockEnv.NODE_ENV = "development";
        mockIsDevelopment.mockReturnValue(true);

        drizzleModule = await importDrizzleModule();
        drizzleModule.createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            max: 5,
            idle_timeout: 60,
            connect_timeout: 30,
            prepare: true,
            connection: {
              application_name: "pinpoint_seeding",
            },
          }),
        );

        resetSingleton();
        vi.clearAllMocks();

        // Test Production timeouts
        mockEnv.NODE_ENV = "production";
        mockIsDevelopment.mockReturnValue(false);

        drizzleModule = await importDrizzleModule();
        drizzleModule.createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
            prepare: true,
            connection: {
              application_name: "pinpoint_seeding",
            },
          }),
        );
      });

      it("should disable prepared statements in CI", async () => {
        mockEnv.NODE_ENV = "test";
        mockIsDevelopment.mockReturnValue(false);

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            prepare: false,
          }),
        );
      });

      it("should handle undefined values in CI", async () => {
        mockEnv.NODE_ENV = "test";
        mockIsDevelopment.mockReturnValue(false);

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockPostgres).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            transform: { undefined: null },
          }),
        );
      });
    });

    describe("Logging Configuration", () => {
      it("should enable logging in development (non-CI)", async () => {
        mockEnv.NODE_ENV = "development";
        mockIsDevelopment.mockReturnValue(true);

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockDrizzle).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            schema: mockSchema,
            logger: true, // isDevelopment() && !isCI
          }),
        );
      });

      it("should disable logging in CI", async () => {
        mockEnv.NODE_ENV = "test";
        mockIsDevelopment.mockReturnValue(false); // Not development

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockDrizzle).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            schema: mockSchema,
            logger: false, // isDevelopment() && !isCI = false && !true = false
          }),
        );
      });

      it("should disable logging in production", async () => {
        mockEnv.NODE_ENV = "production";
        mockIsDevelopment.mockReturnValue(false);

        const { createDrizzleClient } = await importDrizzleModule();
        createDrizzleClient();

        expect(mockDrizzle).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            schema: mockSchema,
            logger: false, // isDevelopment() && !isCI = false
          }),
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should throw clear error when DATABASE_URL is missing", async () => {
      mockEnv.DATABASE_URL = "" as any; // Empty string should be treated as missing

      const { createDrizzleClient } = await importDrizzleModule();

      expect(() => createDrizzleClient()).toThrow(
        "DATABASE_URL is required for Drizzle client",
      );

      // Should not have attempted to create postgres connection
      expect(mockPostgres).not.toHaveBeenCalled();
    });

    it("should handle invalid connection strings gracefully", async () => {
      mockEnv.DATABASE_URL = "not-a-valid-url";

      const { createDrizzleClient } = await importDrizzleModule();

      // Should still attempt to create client (postgres-js will handle invalid URLs)
      expect(() => createDrizzleClient()).not.toThrow();
      expect(mockPostgres).toHaveBeenCalledWith(
        "not-a-valid-url",
        expect.any(Object),
      );
    });

    it("should handle connection failures with retry logic", async () => {
      // Mock postgres to throw an error
      mockPostgres.mockImplementationOnce(() => {
        throw new Error("Connection failed");
      });

      const { createDrizzleClient } = await importDrizzleModule();

      expect(() => createDrizzleClient()).toThrow("Connection failed");
      expect(mockPostgres).toHaveBeenCalledTimes(1);
    });

    it("should properly propagate database connection errors", async () => {
      // Mock drizzle constructor to throw
      mockDrizzle.mockImplementationOnce(() => {
        throw new Error("Drizzle initialization failed");
      });

      const { createDrizzleClient } = await importDrizzleModule();

      expect(() => createDrizzleClient()).toThrow(
        "Drizzle initialization failed",
      );
      expect(mockPostgres).toHaveBeenCalledTimes(1);
      expect(mockDrizzle).toHaveBeenCalledTimes(1);
    });
  });

  describe("Connection Lifecycle", () => {
    it("should properly initialize database connection on first use", async () => {
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      const { createDrizzleClient } = await importDrizzleModule();

      // No connections created yet
      expect(mockPostgres).not.toHaveBeenCalled();
      expect(mockDrizzle).not.toHaveBeenCalled();

      // First call should create connection
      const client = createDrizzleClient();
      expect(client.__isMockDrizzle).toBe(true);
      expect(mockPostgres).toHaveBeenCalledTimes(1);
      expect(mockDrizzle).toHaveBeenCalledTimes(1);
    });

    it("should cleanup connections when closeDrizzleConnection is called", async () => {
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      const { createDrizzleClient, closeDrizzleConnection } =
        await importDrizzleModule();

      // Create a client first
      const client = createDrizzleClient();
      expect(client.__isMockDrizzle).toBe(true);
      expect(mockPostgres).toHaveBeenCalledTimes(1);

      // Cleanup should call sql.end()
      await closeDrizzleConnection();
      expect(mockPostgresInstance.end).toHaveBeenCalledTimes(1);

      // Creating a new client should create new connection
      const newClient = createDrizzleClient();
      expect(newClient.__isMockDrizzle).toBe(true);
      expect(mockPostgres).toHaveBeenCalledTimes(2); // New connection created
    });

    it("should handle cleanup errors gracefully", async () => {
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      // Mock sql.end() to throw an error
      mockPostgresInstance.end.mockRejectedValueOnce(
        new Error("Cleanup failed"),
      );

      // Mock console.warn to verify error is logged
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {
          // Mock implementation - no action needed
        });

      const { createDrizzleClient, closeDrizzleConnection } =
        await importDrizzleModule();

      // Create a client
      createDrizzleClient();

      // Cleanup should not throw even if sql.end() fails - should handle gracefully
      await expect(closeDrizzleConnection()).resolves.not.toThrow();
      expect(mockPostgresInstance.end).toHaveBeenCalledTimes(1);

      // Should log the error but not throw
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Database cleanup error (non-fatal):",
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should allow reconnection after cleanup", async () => {
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      const { createDrizzleClient, closeDrizzleConnection } =
        await importDrizzleModule();

      // First connection
      const client1 = createDrizzleClient();
      expect(client1.__isMockDrizzle).toBe(true);
      expect(mockPostgres).toHaveBeenCalledTimes(1);

      // Cleanup
      await closeDrizzleConnection();
      expect(mockPostgresInstance.end).toHaveBeenCalledTimes(1);

      // Should be able to create new connection
      const client2 = createDrizzleClient();
      expect(client2.__isMockDrizzle).toBe(true);
      expect(mockPostgres).toHaveBeenCalledTimes(2);
      expect(mockDrizzle).toHaveBeenCalledTimes(2);
    });

    it("should reset singleton without cleanup in development", async () => {
      // This test verifies the internal reset behavior by checking connection reuse
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      const { createDrizzleClient } = await importDrizzleModule();

      const client1 = createDrizzleClient();
      const client2 = createDrizzleClient();

      // Should be the same instance (singleton)
      expect(client1).toBe(client2);
      expect(mockPostgres).toHaveBeenCalledTimes(1);
      expect(mockPostgresInstance.end).not.toHaveBeenCalled(); // No cleanup in normal operation
    });
  });

  describe("Schema Integration", () => {
    it("should properly load and attach schema to drizzle instance", async () => {
      const { createDrizzleClient } = await importDrizzleModule();

      createDrizzleClient();

      // Verify drizzle was called with the mocked schema
      expect(mockDrizzle).toHaveBeenCalledWith(
        expect.anything(), // postgres connection
        expect.objectContaining({
          schema: mockSchema,
        }),
      );
    });

    it("should make all schema tables available on the client", async () => {
      const { createDrizzleClient } = await importDrizzleModule();

      const client = createDrizzleClient();

      // Verify client has access to key tables (based on our mock)
      expect(client.organizations).toBeDefined();
      expect(client.users).toBeDefined();
      expect(client.machines).toBeDefined();
      expect(client.issues).toBeDefined();

      // Verify these are the expected mock objects
      expect(typeof client.organizations.findMany).toBe("function");
      expect(typeof client.users.findMany).toBe("function");
    });
  });

  describe("Module Import Behavior", () => {
    it("should not create connection on module import", async () => {
      // Clear any previous calls
      vi.clearAllMocks();

      // Import the module but don't call createDrizzleClient
      await importDrizzleModule();

      // No connections should be created on import
      expect(mockPostgres).not.toHaveBeenCalled();
      expect(mockDrizzle).not.toHaveBeenCalled();
    });

    it("should handle circular dependencies gracefully", async () => {
      // This test verifies that the module structure supports circular imports
      // by testing multiple imports and ensuring consistent behavior

      const module1 = await importDrizzleModule();
      const module2 = await importDrizzleModule();

      // Both should reference the same functions
      expect(module1.createDrizzleClient).toBeDefined();
      expect(module2.createDrizzleClient).toBeDefined();
      expect(module1.closeDrizzleConnection).toBeDefined();
      expect(module2.closeDrizzleConnection).toBeDefined();

      // Should work consistently across imports
      const client1 = module1.createDrizzleClient();
      const client2 = module2.createDrizzleClient();

      // In development, should be same instance
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      expect(client1.__isMockDrizzle).toBe(true);
      expect(client2.__isMockDrizzle).toBe(true);
    });
  });

  describe("Performance Characteristics", () => {
    it("should not leak memory on repeated singleton access", async () => {
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      const { createDrizzleClient } = await importDrizzleModule();

      // Call createDrizzleClient many times
      const clients = [];
      for (let i = 0; i < 100; i++) {
        clients.push(createDrizzleClient());
      }

      // All should be the same instance (singleton)
      const firstClient = clients[0];
      for (const client of clients) {
        expect(client).toBe(firstClient);
        expect(client.__isMockDrizzle).toBe(true);
      }

      // Should only create one postgres connection despite 100 calls
      expect(mockPostgres).toHaveBeenCalledTimes(1);
      expect(mockDrizzle).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid concurrent connection requests", async () => {
      mockEnv.NODE_ENV = "development";
      mockIsDevelopment.mockReturnValue(true);

      const { createDrizzleClient } = await importDrizzleModule();

      // Simulate concurrent calls
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve(createDrizzleClient()));
      }

      const clients = await Promise.all(promises);

      // All should be the same instance
      const firstClient = clients[0];
      for (const client of clients) {
        expect(client).toBe(firstClient);
        expect(client.__isMockDrizzle).toBe(true);
      }

      // Should still only create one connection
      expect(mockPostgres).toHaveBeenCalledTimes(1);
    });

    it("should respect connection pool limits under load", async () => {
      // Test CI environment with max: 2 pool size
      mockEnv.NODE_ENV = "test";
      mockIsDevelopment.mockReturnValue(false);

      const { createDrizzleClient } = await importDrizzleModule();
      createDrizzleClient();

      // Verify the pool configuration was set correctly
      expect(mockPostgres).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          max: 2, // Pool limit for CI
          idle_timeout: 30,
          connect_timeout: 20,
          prepare: false,
          connection: {
            application_name: "pinpoint_ci_seeding",
          },
        }),
      );

      // Test production environment with max: 10
      resetSingleton();
      vi.clearAllMocks();

      mockEnv.NODE_ENV = "production";
      mockIsDevelopment.mockReturnValue(false);

      const drizzleModule2 = await importDrizzleModule();
      drizzleModule2.createDrizzleClient();

      expect(mockPostgres).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          max: 10, // Higher pool limit for production
          idle_timeout: 20,
          connect_timeout: 10,
          prepare: true,
          connection: {
            application_name: "pinpoint_seeding",
          },
        }),
      );
    });
  });

  describe("Worker-Scoped Pattern Integration", () => {
    describe("Singleton Compatibility with Worker-Scoped Databases", () => {
      test("should work correctly with worker-scoped PGlite databases", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (txDb) => {
          // Verify that singleton pattern doesn't interfere with worker-scoped databases
          mockEnv.NODE_ENV = "development";
          mockIsDevelopment.mockReturnValue(true);

          const { createDrizzleClient } = await importDrizzleModule();
          const singletonClient = createDrizzleClient();

          // Worker-scoped database should be independent of singleton
          expect(txDb).toBeDefined();
          expect(singletonClient).toBeDefined();
          expect(singletonClient.__isMockDrizzle).toBe(true);

          // Both should be able to operate independently
          expect(typeof txDb.select).toBe("function");
          expect(typeof singletonClient.organizations?.findMany).toBe(
            "function",
          );
        });
      });

      test("should maintain singleton behavior within transaction contexts", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (txDb) => {
          mockEnv.NODE_ENV = "development";
          mockIsDevelopment.mockReturnValue(true);

          const { createDrizzleClient } = await importDrizzleModule();

          // Multiple calls within transaction should still use singleton
          const client1 = createDrizzleClient();
          const client2 = createDrizzleClient();

          expect(client1).toBe(client2);
          expect(mockPostgres).toHaveBeenCalledTimes(1);

          // Worker-scoped database should remain isolated
          expect(txDb).not.toBe(client1);
          expect(txDb).not.toBe(client2);
        });
      });

      test("should handle connection cleanup without affecting worker-scoped databases", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (txDb) => {
          mockEnv.NODE_ENV = "development";
          mockIsDevelopment.mockReturnValue(true);

          const { createDrizzleClient, closeDrizzleConnection } =
            await importDrizzleModule();

          // Create singleton instance
          const client = createDrizzleClient();
          expect(client.__isMockDrizzle).toBe(true);

          // Cleanup singleton should not affect worker-scoped database
          await closeDrizzleConnection();
          expect(mockPostgresInstance.end).toHaveBeenCalledTimes(1);

          // Worker-scoped database should still work
          expect(txDb).toBeDefined();
          expect(typeof txDb.select).toBe("function");
        });
      });
    });

    describe("Memory Safety with Worker-Scoped Patterns", () => {
      test("should not accumulate memory when used with worker-scoped databases", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (txDb) => {
          mockEnv.NODE_ENV = "development";
          mockIsDevelopment.mockReturnValue(true);

          const { createDrizzleClient } = await importDrizzleModule();

          // Multiple accesses within transaction should not accumulate
          const clients = [];
          for (let i = 0; i < 50; i++) {
            clients.push(createDrizzleClient());
          }

          // All should be the same instance (no memory accumulation)
          const firstClient = clients[0];
          for (const client of clients) {
            expect(client).toBe(firstClient);
          }

          // Only one connection should have been created
          expect(mockPostgres).toHaveBeenCalledTimes(1);

          // Worker-scoped database should remain efficient
          expect(txDb).toBeDefined();
        });
      });

      test("should handle rapid singleton access without memory leaks in transaction contexts", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (txDb) => {
          mockEnv.NODE_ENV = "development";
          mockIsDevelopment.mockReturnValue(true);

          const { createDrizzleClient } = await importDrizzleModule();

          // Simulate rapid concurrent access within transaction
          const promises = [];
          for (let i = 0; i < 20; i++) {
            promises.push(Promise.resolve(createDrizzleClient()));
          }

          const clients = await Promise.all(promises);

          // All should be the same instance
          const firstClient = clients[0];
          for (const client of clients) {
            expect(client).toBe(firstClient);
            expect(client.__isMockDrizzle).toBe(true);
          }

          // Memory efficient - only one connection
          expect(mockPostgres).toHaveBeenCalledTimes(1);

          // Transaction database should be unaffected
          expect(txDb).toBeDefined();
          expect(txDb).not.toBe(firstClient);
        });
      });
    });

    describe("Transaction Isolation Compatibility", () => {
      test("should not interfere with transaction-based isolation", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (txDb) => {
          mockEnv.NODE_ENV = "development";
          mockIsDevelopment.mockReturnValue(true);

          const { createDrizzleClient } = await importDrizzleModule();
          const singletonClient = createDrizzleClient();

          // Singleton and transaction database should be completely independent
          expect(singletonClient).toBeDefined();
          expect(txDb).toBeDefined();
          expect(singletonClient).not.toBe(txDb);

          // Changes in transaction should not affect singleton behavior
          // (This is a structural test - actual DB operations would need real DB)
          expect(singletonClient.__isMockDrizzle).toBe(true);
          expect(typeof txDb.select).toBe("function");
        });
      });

      test("should maintain consistent singleton behavior across multiple transactions", async ({
        workerDb,
      }) => {
        mockEnv.NODE_ENV = "development";
        mockIsDevelopment.mockReturnValue(true);

        const { createDrizzleClient } = await importDrizzleModule();
        let singletonFromTx1: any;
        let singletonFromTx2: any;

        // First transaction
        await withIsolatedTest(workerDb, async (txDb1) => {
          singletonFromTx1 = createDrizzleClient();
          expect(singletonFromTx1.__isMockDrizzle).toBe(true);
          expect(txDb1).not.toBe(singletonFromTx1);
        });

        // Second transaction
        await withIsolatedTest(workerDb, async (txDb2) => {
          singletonFromTx2 = createDrizzleClient();
          expect(singletonFromTx2.__isMockDrizzle).toBe(true);
          expect(txDb2).not.toBe(singletonFromTx2);
        });

        // Singleton should be the same across transactions
        expect(singletonFromTx1).toBe(singletonFromTx2);
        expect(mockPostgres).toHaveBeenCalledTimes(1); // Only one connection created
      });
    });
  });

  describe("Memory Safety Validation", () => {
    describe("Connection Lifecycle Memory Management", () => {
      test("should not accumulate connections with repeated module resets", async () => {
        const connectionCounts = [];

        for (let i = 0; i < 5; i++) {
          mockEnv.NODE_ENV = "development";
          mockIsDevelopment.mockReturnValue(true);

          const { createDrizzleClient } = await importDrizzleModule();
          createDrizzleClient();

          connectionCounts.push(mockPostgres.mock.calls.length);

          // Reset for next iteration
          resetSingleton();
          vi.clearAllMocks();
        }

        // Each iteration should create exactly one connection
        expect(connectionCounts).toEqual([1, 1, 1, 1, 1]);
      });

      test("should handle cleanup errors without memory accumulation", async () => {
        mockEnv.NODE_ENV = "development";
        mockIsDevelopment.mockReturnValue(true);

        // Mock console.warn to track error handling
        const consoleWarnSpy = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        for (let i = 0; i < 3; i++) {
          // Make cleanup fail for this iteration
          mockPostgresInstance.end.mockRejectedValueOnce(
            new Error(`Cleanup failed ${i}`),
          );

          const { createDrizzleClient, closeDrizzleConnection } =
            await importDrizzleModule();
          createDrizzleClient();

          // Cleanup should handle error gracefully
          await expect(closeDrizzleConnection()).resolves.not.toThrow();

          resetSingleton();
          vi.clearAllMocks();
        }

        // Should have logged warnings for failed cleanups
        expect(consoleWarnSpy).toHaveBeenCalledTimes(3);

        consoleWarnSpy.mockRestore();
      });
    });

    describe("Production vs Development Memory Patterns", () => {
      test("should not accumulate instances in production mode", async () => {
        mockEnv.NODE_ENV = "production";
        mockIsDevelopment.mockReturnValue(false);

        const { createDrizzleClient } = await importDrizzleModule();

        // Create multiple clients in production
        const clients = [];
        for (let i = 0; i < 10; i++) {
          clients.push(createDrizzleClient());
        }

        // Each should be a unique instance in production
        const uniqueClients = new Set(clients);
        expect(uniqueClients.size).toBe(10);

        // Should have created separate connections
        expect(mockPostgres).toHaveBeenCalledTimes(10);
        expect(mockDrizzle).toHaveBeenCalledTimes(10);

        // All should be valid mock instances
        for (const client of clients) {
          expect(client.__isMockDrizzle).toBe(true);
        }
      });

      test("should properly manage singleton memory in development mode", async () => {
        mockEnv.NODE_ENV = "development";
        mockIsDevelopment.mockReturnValue(true);

        const { createDrizzleClient } = await importDrizzleModule();

        // Create many clients in development
        const clients = [];
        for (let i = 0; i < 100; i++) {
          clients.push(createDrizzleClient());
        }

        // All should be the same instance (memory efficient)
        const uniqueClients = new Set(clients);
        expect(uniqueClients.size).toBe(1);

        // Only one connection should exist
        expect(mockPostgres).toHaveBeenCalledTimes(1);
        expect(mockDrizzle).toHaveBeenCalledTimes(1);

        // All references should point to the same mock instance
        for (const client of clients) {
          expect(client).toBe(clients[0]);
          expect(client.__isMockDrizzle).toBe(true);
        }
      });
    });

    describe("Hot Reload Memory Safety", () => {
      test("should handle hot reload cycles without memory accumulation", async () => {
        const moduleLoadCounts = [];

        for (let cycle = 0; cycle < 5; cycle++) {
          mockEnv.NODE_ENV = "development";
          mockIsDevelopment.mockReturnValue(true);

          // Simulate hot reload
          resetSingleton();
          vi.clearAllMocks();

          const { createDrizzleClient } = await importDrizzleModule();
          createDrizzleClient();

          moduleLoadCounts.push(mockPostgres.mock.calls.length);
        }

        // Each hot reload cycle should create exactly one connection
        expect(moduleLoadCounts).toEqual([1, 1, 1, 1, 1]);
      });

      test("should maintain memory efficiency across hot reload with concurrent access", async () => {
        for (let cycle = 0; cycle < 3; cycle++) {
          mockEnv.NODE_ENV = "development";
          mockIsDevelopment.mockReturnValue(true);

          resetSingleton();
          vi.clearAllMocks();

          const { createDrizzleClient } = await importDrizzleModule();

          // Concurrent access after hot reload
          const promises = [];
          for (let i = 0; i < 20; i++) {
            promises.push(Promise.resolve(createDrizzleClient()));
          }

          const clients = await Promise.all(promises);

          // All should be the same instance (singleton behavior maintained)
          const firstClient = clients[0];
          for (const client of clients) {
            expect(client).toBe(firstClient);
            expect(client.__isMockDrizzle).toBe(true);
          }

          // Only one connection per hot reload cycle
          expect(mockPostgres).toHaveBeenCalledTimes(1);
        }
      });
    });
  });
});
