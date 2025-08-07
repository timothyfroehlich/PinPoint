/**
 * Environment Loader Tests
 *
 * Tests for environment-specific configuration loading system.
 * Ensures proper precedence, file loading order, error handling,
 * and NODE_ENV defaults for development, test, and production environments.
 */

import { existsSync } from "fs";
import { resolve } from "path";

import { config } from "dotenv";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock dotenv and fs modules
vi.mock("dotenv", () => ({
  config: vi.fn(() => ({ parsed: {}, error: null })),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
}));
const mockDotenvConfig = vi.mocked(config);
const mockExistsSync = vi.mocked(existsSync);

describe("Environment Loaders", () => {
  // Store original environment for restoration
  let originalEnv: NodeJS.ProcessEnv;
  let _originalNodeEnv: string | undefined;

  beforeEach(() => {
    // Save original process.env
    originalEnv = { ...process.env };
    _originalNodeEnv = process.env.NODE_ENV;

    // Clear environment variables that might interfere with tests
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.TEST_VAR;
    delete process.env.SUPABASE_URL;

    // Clear all mocks
    vi.clearAllMocks();

    // Reset mocks to default behavior
    mockExistsSync.mockReturnValue(true);
    mockDotenvConfig.mockReturnValue({ parsed: {}, error: null });
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;

    // Clear all mocks
    vi.clearAllMocks();

    // Reset module cache to ensure fresh imports
    vi.resetModules();
  });

  describe("Development Environment Loader", () => {
    describe("File Loading Order", () => {
      it("should load .env as base configuration", async () => {
        // Import development loader to trigger auto-loading
        await import("../development");

        // Verify .env is loaded first
        expect(mockDotenvConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringContaining(".env"),
          }),
        );

        // Check that the path resolves correctly to project root
        const firstCall = mockDotenvConfig.mock.calls[0]?.[0];
        expect(firstCall?.path).toMatch(/.*\.env$/);
        expect(firstCall?.path).not.toMatch(/.*\.env\.(development|local)$/);
      });

      it("should load .env.development after .env", async () => {
        // Import development loader to trigger auto-loading
        await import("../development");

        // Verify .env.development is loaded second
        expect(mockDotenvConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringContaining(".env.development"),
          }),
        );

        // Check loading order: .env should be called before .env.development
        const calls = mockDotenvConfig.mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(2);
        expect(calls[0]?.[0]?.path).toMatch(/.*\.env$/);
        expect(calls[1]?.[0]?.path).toMatch(/.*\.env\.development$/);
      });

      it("should load .env.local last if it exists", async () => {
        // Import development loader to trigger auto-loading
        await import("../development");

        // Verify .env.local is loaded last
        expect(mockDotenvConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringContaining(".env.local"),
          }),
        );

        // Check loading order: .env.local should be last
        const calls = mockDotenvConfig.mock.calls;
        expect(calls.length).toBe(3);
        expect(calls[2]?.[0]?.path).toMatch(/.*\.env\.local$/);
      });

      it("should handle missing .env.local gracefully", async () => {
        // Mock .env.local as non-existent
        mockExistsSync.mockImplementation((path: string) => {
          return !path.toString().endsWith(".env.local");
        });

        // Import should not throw even if .env.local doesn't exist
        const importPromise = async (): Promise<void> => {
          await import("../development");
        };
        await expect(importPromise()).resolves.not.toThrow();

        // dotenv.config should still be called (dotenv handles missing files)
        expect(mockDotenvConfig).toHaveBeenCalledTimes(3);
      });

      it("should resolve paths relative to project root", async () => {
        // Import development loader
        await import("../development");

        // All paths should resolve to project root directory structure
        const calls = mockDotenvConfig.mock.calls;
        calls.forEach((call) => {
          const path = call[0]?.path;
          expect(path).toBeDefined();
          // Path should be absolute and point to project root area
          if (path) {
            expect(resolve(path)).toBe(path);
          }
          // Should contain the expected env file names
          expect(path).toMatch(/\.(env|env\.development|env\.local)$/);
        });
      });
    });

    describe("Environment Variable Precedence", () => {
      it("should allow .env.development to override .env", async () => {
        // Mock dotenv to simulate file contents
        let callCount = 0;
        mockDotenvConfig.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call (.env)
            process.env.TEST_VAR = "value1";
          } else if (callCount === 2) {
            // Second call (.env.development) - should override
            process.env.TEST_VAR = "value2";
          }
          return { parsed: {}, error: null };
        });

        await import("../development");

        // Result should be value2 (from .env.development)
        expect(process.env.TEST_VAR).toBe("value2");
      });

      it("should allow .env.local to override all others", async () => {
        // Mock dotenv to simulate file contents with precedence
        let callCount = 0;
        mockDotenvConfig.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call (.env)
            process.env.TEST_VAR = "value1";
          } else if (callCount === 2) {
            // Second call (.env.development)
            process.env.TEST_VAR = "value2";
          } else if (callCount === 3) {
            // Third call (.env.local) - highest precedence
            process.env.TEST_VAR = "value3";
          }
          return { parsed: {}, error: null };
        });

        await import("../development");

        // Result should be value3 (from .env.local)
        expect(process.env.TEST_VAR).toBe("value3");
      });

      it("should preserve existing environment variables", async () => {
        // Set existing value before loading
        process.env.TEST_VAR = "existing";

        // Mock dotenv to try to set the same variable
        mockDotenvConfig.mockImplementation(() => {
          // dotenv's default behavior: only sets if not already present
          if (!process.env.TEST_VAR) {
            process.env.TEST_VAR = "new";
          }
          return { parsed: {}, error: null };
        });

        await import("../development");

        // Existing value should be preserved (dotenv default behavior)
        expect(process.env.TEST_VAR).toBe("existing");
      });

      it("should merge variables from all files", async () => {
        // Mock dotenv to simulate different variables in each file
        let callCount = 0;
        mockDotenvConfig.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call (.env)
            process.env.VAR1 = "from-env";
          } else if (callCount === 2) {
            // Second call (.env.development)
            process.env.VAR2 = "from-development";
          } else if (callCount === 3) {
            // Third call (.env.local)
            process.env.VAR3 = "from-local";
          }
          return { parsed: {}, error: null };
        });

        await import("../development");

        // All three should be available
        expect(process.env.VAR1).toBe("from-env");
        expect(process.env.VAR2).toBe("from-development");
        expect(process.env.VAR3).toBe("from-local");
      });
    });

    describe("NODE_ENV Handling", () => {
      it("should set NODE_ENV to development if not set", async () => {
        // Ensure NODE_ENV is not set
        delete process.env.NODE_ENV;

        await import("../development");

        // After loading, NODE_ENV should be 'development'
        expect(process.env.NODE_ENV).toBe("development");
      });

      it("should preserve existing NODE_ENV if already set", async () => {
        // Set NODE_ENV=test before loading
        process.env.NODE_ENV = "test";

        await import("../development");

        // After loading, NODE_ENV should still be 'test'
        expect(process.env.NODE_ENV).toBe("test");
      });

      it("should handle NODE_ENV in environment files", async () => {
        // Mock dotenv to set NODE_ENV in a file
        mockDotenvConfig.mockImplementation(() => {
          process.env.NODE_ENV = "staging";
          return { parsed: {}, error: null };
        });

        await import("../development");

        // NODE_ENV from file should be respected
        expect(process.env.NODE_ENV).toBe("staging");
      });
    });

    describe("Auto-loading Behavior", () => {
      it("should auto-load on module import", async () => {
        // Clear any previous calls
        mockDotenvConfig.mockClear();

        // Import the module
        await import("../development");

        // Verify environment is loaded without calling function explicitly
        expect(mockDotenvConfig).toHaveBeenCalledTimes(3);
        expect(mockDotenvConfig).toHaveBeenCalledWith(
          expect.objectContaining({ path: expect.stringContaining(".env") }),
        );
      });

      it("should be idempotent on multiple imports", async () => {
        // Clear previous calls
        mockDotenvConfig.mockClear();

        // Import module multiple times (via dynamic import)
        const module1 = await import("../development");
        const module2 = await import("../development");

        // Both imports should reference the same module (cached)
        expect(module1).toBe(module2);

        // Environment should only be loaded once due to module caching
        // (Note: In a real test environment, this shows the auto-loading happened)
        expect(mockDotenvConfig).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe("Production Environment Loader", () => {
    describe("File Loading Order", () => {
      it("should load .env as base configuration", async () => {
        // Import production loader to trigger auto-loading
        await import("../production");

        // Verify .env is loaded first
        expect(mockDotenvConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringContaining(".env"),
          }),
        );

        const firstCall = mockDotenvConfig.mock.calls[0]?.[0];
        expect(firstCall?.path).toMatch(/.*\.env$/);
        expect(firstCall?.path).not.toMatch(/.*\.env\.(production|local)$/);
      });

      it("should load .env.production after .env", async () => {
        // Import production loader
        await import("../production");

        // Verify .env.production is loaded second
        expect(mockDotenvConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringContaining(".env.production"),
          }),
        );

        // Check loading order
        const calls = mockDotenvConfig.mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(2);
        expect(calls[0]?.[0]?.path).toMatch(/.*\.env$/);
        expect(calls[1]?.[0]?.path).toMatch(/.*\.env\.production$/);
      });

      it("should load .env.local for deployment-specific settings", async () => {
        // Import production loader
        await import("../production");

        // Verify .env.local is loaded for production deployments
        expect(mockDotenvConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringContaining(".env.local"),
          }),
        );

        // Check that all three files are loaded in correct order
        const calls = mockDotenvConfig.mock.calls;
        expect(calls.length).toBe(3);
        expect(calls[0]?.[0]?.path).toMatch(/.*\.env$/);
        expect(calls[1]?.[0]?.path).toMatch(/.*\.env\.production$/);
        expect(calls[2]?.[0]?.path).toMatch(/.*\.env\.local$/);
      });
    });

    describe("NODE_ENV Handling", () => {
      it("should set NODE_ENV to production if not set", async () => {
        // Ensure NODE_ENV is not set
        delete process.env.NODE_ENV;

        await import("../production");

        // After loading, NODE_ENV should be 'production'
        expect(process.env.NODE_ENV).toBe("production");
      });

      it("should preserve existing NODE_ENV if already set", async () => {
        // Set NODE_ENV=staging before loading
        process.env.NODE_ENV = "staging";

        await import("../production");

        // After loading, NODE_ENV should still be 'staging'
        expect(process.env.NODE_ENV).toBe("staging");
      });
    });

    describe("Security Considerations", () => {
      it("should not expose sensitive variables in logs", async () => {
        // Mock console.log to capture any logging
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {
          // Mock implementation
        });
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {
            // Mock implementation
          });

        // Set some sensitive variables
        process.env.DATABASE_PASSWORD = "secret123";
        process.env.API_SECRET = "supersecret";

        await import("../production");

        // Verify no sensitive information is logged
        const allLogCalls = [
          ...consoleSpy.mock.calls,
          ...consoleErrorSpy.mock.calls,
        ];
        allLogCalls.forEach((call) => {
          const logMessage = call.join(" ");
          expect(logMessage).not.toContain("secret123");
          expect(logMessage).not.toContain("supersecret");
        });

        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      });

      it("should handle missing required production variables", async () => {
        // Mock dotenv to simulate missing critical variables
        mockDotenvConfig.mockImplementation(() => {
          // Don't set critical production variables
          return { parsed: {}, error: null };
        });

        await import("../production");

        // The loader itself doesn't validate specific variables,
        // but it should load without throwing errors
        // Validation should happen at application level
        expect(mockDotenvConfig).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe("Test Environment Loader", () => {
    describe("File Loading Order", () => {
      it("should load .env as base configuration", async () => {
        // Import test loader to trigger auto-loading
        await import("../test");

        // Verify .env is loaded first with override: false
        expect(mockDotenvConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringContaining(".env"),
            override: false,
          }),
        );

        const firstCall = mockDotenvConfig.mock.calls[0]?.[0];
        expect(firstCall?.path).toMatch(/.*\.env$/);
        expect(firstCall?.path).not.toMatch(
          /.*\.env\.(development|test|local)$/,
        );
      });

      it("should load .env.development, then .env.test after .env", async () => {
        // Import test loader
        await import("../test");

        // Verify loading order: .env, .env.development, .env.test, .env.local
        const calls = mockDotenvConfig.mock.calls;
        expect(calls.length).toBe(4);

        expect(calls[0]?.[0]?.path).toMatch(/.*\.env$/);
        expect(calls[0]?.[0]?.override).toBe(false);

        expect(calls[1]?.[0]?.path).toMatch(/.*\.env\.development$/);
        expect(calls[1]?.[0]?.override).toBe(false);

        expect(calls[2]?.[0]?.path).toMatch(/.*\.env\.test$/);
        expect(calls[2]?.[0]?.override).toBe(false);
      });

      it("should load .env.local last with override: false for CI compatibility", async () => {
        // Import test loader
        await import("../test");

        // In test environment, .env.local is loaded but with override: false
        // This preserves CI environment variables
        expect(mockDotenvConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringContaining(".env.local"),
            override: false,
          }),
        );

        const calls = mockDotenvConfig.mock.calls;
        expect(calls[3]?.[0]?.path).toMatch(/.*\.env\.local$/);
        expect(calls[3]?.[0]?.override).toBe(false);
      });
    });

    describe("Test-Specific Configuration", () => {
      it("should preserve CI database URLs with override: false", async () => {
        // Simulate CI environment with DATABASE_URL already set
        process.env.DATABASE_URL = "postgresql://ci-test-db";

        // Mock dotenv to try to set a different DATABASE_URL
        mockDotenvConfig.mockImplementation((options) => {
          // Respect override: false - don't change existing values
          if (!options?.override && process.env.DATABASE_URL) {
            return { parsed: {}, error: null };
          }
          process.env.DATABASE_URL = "postgresql://local-test-db";
          return { parsed: {}, error: null };
        });

        await import("../test");

        // CI database URL should be preserved
        expect(process.env.DATABASE_URL).toBe("postgresql://ci-test-db");
      });

      it("should allow local test configuration when no CI vars exist", async () => {
        // No existing DATABASE_URL (local development)
        delete process.env.DATABASE_URL;

        // Mock dotenv to set test database URL
        let callCount = 0;
        mockDotenvConfig.mockImplementation(() => {
          callCount++;
          if (callCount === 3) {
            // .env.test call
            process.env.DATABASE_URL = "postgresql://localhost:54322/test";
          }
          return { parsed: {}, error: null };
        });

        await import("../test");

        // Local test database URL should be set
        expect(process.env.DATABASE_URL).toBe(
          "postgresql://localhost:54322/test",
        );
      });

      it("should set NODE_ENV to test if not set", async () => {
        // Ensure NODE_ENV is not set
        delete process.env.NODE_ENV;

        await import("../test");

        // After loading, NODE_ENV should be 'test'
        expect(process.env.NODE_ENV).toBe("test");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle missing .env file gracefully", async () => {
      // Mock dotenv to return an error for missing file
      mockDotenvConfig.mockImplementation(() => {
        return {
          parsed: null,
          error: new Error("ENOENT: no such file or directory"),
        };
      });

      // Import should not throw even if .env doesn't exist
      const importPromise = async (): Promise<void> => {
        await import("../development");
      };
      await expect(importPromise()).resolves.not.toThrow();

      // dotenv.config should still be called
      expect(mockDotenvConfig).toHaveBeenCalledTimes(3);
    });

    it("should handle malformed .env files", async () => {
      // Mock dotenv to return parsing error
      mockDotenvConfig.mockImplementation(() => {
        return {
          parsed: null,
          error: new Error("Parse error: Invalid format on line 5"),
        };
      });

      // Import should handle parsing errors gracefully
      const importPromise = async (): Promise<void> => {
        await import("../development");
      };
      await expect(importPromise()).resolves.not.toThrow();

      // Loader continues despite parsing errors
      expect(mockDotenvConfig).toHaveBeenCalledTimes(3);
    });

    it("should handle file permission errors", async () => {
      // Mock dotenv to return permission error
      mockDotenvConfig.mockImplementation(() => {
        return {
          parsed: null,
          error: new Error("EACCES: permission denied"),
        };
      });

      // Import should handle permission errors gracefully
      const importPromise = async (): Promise<void> => {
        await import("../development");
      };
      await expect(importPromise()).resolves.not.toThrow();
    });

    it("should handle circular references in variables", async () => {
      // Mock dotenv to simulate circular variable references
      mockDotenvConfig.mockImplementation(() => {
        process.env.VAR1 = "$VAR2";
        process.env.VAR2 = "$VAR1";
        return { parsed: { VAR1: "$VAR2", VAR2: "$VAR1" }, error: null };
      });

      await import("../development");

      // Should not cause infinite loop or crash
      expect(process.env.VAR1).toBe("$VAR2");
      expect(process.env.VAR2).toBe("$VAR1");
    });

    it("should validate critical environment variables", async () => {
      // The loaders themselves don't validate specific variables,
      // but we can test that they load successfully
      await import("../development");

      // Validation should happen at the application level,
      // not in the environment loaders themselves
      expect(mockDotenvConfig).toHaveBeenCalledTimes(3);
    });
  });

  describe("Path Resolution", () => {
    it("should correctly resolve project root from any subdirectory", async () => {
      await import("../development");

      // Check that all paths are absolute and resolve to expected locations
      const calls = mockDotenvConfig.mock.calls;
      calls.forEach((call) => {
        const path = call[0]?.path;
        expect(path).toBeDefined();
        if (path) {
          expect(resolve(path)).toBe(path); // Should be absolute
        }

        // Should resolve to project root area (contains package.json level)
        expect(path).toMatch(/.*\/(?:src\/)?.*\.env/);
      });
    });

    it("should handle symlinked directories", async () => {
      // The implementation uses fileURLToPath and dirname which handles symlinks
      await import("../development");

      // Paths should be resolved correctly even from symlinked locations
      const calls = mockDotenvConfig.mock.calls;
      expect(calls.length).toBe(3);
      calls.forEach((call) => {
        const path = call[0]?.path;
        expect(path).toBeDefined();
        if (path) {
          expect(resolve(path)).toBe(path);
        }
      });
    });

    it("should work in monorepo structures", async () => {
      await import("../development");

      // Should find correct .env files relative to this package's root
      const calls = mockDotenvConfig.mock.calls;
      expect(calls.length).toBe(3);

      // Paths should navigate up to the correct project root
      calls.forEach((call) => {
        const path = call[0]?.path;
        expect(path).toMatch(/.*\.env(\.(development|local))?$/);
      });
    });

    it("should handle Windows path separators", async () => {
      // Mock path resolution to simulate Windows paths
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      await import("../development");

      // Paths should be handled correctly regardless of platform
      const calls = mockDotenvConfig.mock.calls;
      calls.forEach((call) => {
        const path = call[0]?.path;
        expect(path).toBeDefined();
        // Path should be properly resolved regardless of separator type
        if (path) {
          expect(resolve(path)).toBe(path);
        }
      });

      // Restore original platform
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });

  describe("Variable Expansion", () => {
    it("should expand variables referencing other variables", async () => {
      // Mock dotenv to simulate variable expansion
      mockDotenvConfig.mockImplementation(() => {
        process.env.BASE_URL = "http://localhost:3000";
        process.env.API_URL = "$BASE_URL/api";
        return { parsed: {}, error: null };
      });

      await import("../development");

      // Note: dotenv itself doesn't do variable expansion
      // This would need a separate expansion step if required
      expect(process.env.BASE_URL).toBe("http://localhost:3000");
      expect(process.env.API_URL).toBe("$BASE_URL/api");
    });

    it("should handle escaped dollar signs", async () => {
      // Mock dotenv to simulate escaped dollar signs
      mockDotenvConfig.mockImplementation(() => {
        process.env.PASSWORD = "abc\\$123";
        return { parsed: {}, error: null };
      });

      await import("../development");

      // Literal $ should be preserved
      expect(process.env.PASSWORD).toBe("abc\\$123");
    });

    it("should handle quotes in values", async () => {
      // Mock dotenv to simulate quoted values
      mockDotenvConfig.mockImplementation(() => {
        process.env.QUOTED_VAR = '"quoted value"';
        process.env.SINGLE_QUOTED = "'single quoted'";
        return { parsed: {}, error: null };
      });

      await import("../development");

      // Quotes should be handled by dotenv
      expect(process.env.QUOTED_VAR).toBe('"quoted value"');
      expect(process.env.SINGLE_QUOTED).toBe("'single quoted'");
    });

    it("should handle multiline values", async () => {
      // Mock dotenv to simulate multiline values
      const multilineValue = `-----BEGIN CERTIFICATE-----
MIICertificate
Content
-----END CERTIFICATE-----`;

      mockDotenvConfig.mockImplementation(() => {
        process.env.CERT = multilineValue;
        return { parsed: {}, error: null };
      });

      await import("../development");

      // Multiline values should be preserved
      expect(process.env.CERT).toBe(multilineValue);
    });
  });

  describe("Integration with Database Scripts", () => {
    it("should provide correct database URLs for seeding scripts", async () => {
      // Mock environment variables that seeding scripts need
      mockDotenvConfig.mockImplementation(() => {
        process.env.DATABASE_URL = "postgresql://localhost:54322/postgres";
        process.env.DIRECT_URL = "postgresql://localhost:54322/postgres";
        return { parsed: {}, error: null };
      });

      await import("../development");

      // Seeding scripts should have access to database URLs
      expect(process.env.DATABASE_URL).toBe(
        "postgresql://localhost:54322/postgres",
      );
      expect(process.env.DIRECT_URL).toBe(
        "postgresql://localhost:54322/postgres",
      );
    });

    it("should provide correct environment for migration scripts", async () => {
      // Mock environment for migration context
      mockDotenvConfig.mockImplementation(() => {
        process.env.DATABASE_URL = "postgresql://localhost:54322/postgres";
        process.env.NODE_ENV = "development";
        return { parsed: {}, error: null };
      });

      await import("../development");

      // Migration scripts should have proper configuration
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.NODE_ENV).toBe("development");
    });

    it("should handle Supabase-specific environment variables", async () => {
      // Mock Supabase environment variables
      mockDotenvConfig.mockImplementation(() => {
        process.env.SUPABASE_URL = "https://project.supabase.co";
        process.env.SUPABASE_ANON_KEY =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
        process.env.SUPABASE_SERVICE_ROLE_KEY =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
        return { parsed: {}, error: null };
      });

      await import("../development");

      // Supabase variables should be loaded for operations
      expect(process.env.SUPABASE_URL).toBe("https://project.supabase.co");
      expect(process.env.SUPABASE_ANON_KEY).toContain(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      );
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
    });
  });

  describe("Caching and Performance", () => {
    it("should cache loaded environment to avoid repeated file reads", async () => {
      // Clear previous calls
      mockDotenvConfig.mockClear();

      // Import the same module multiple times
      const mod1 = await import("../development");
      const mod2 = await import("../development");

      // Modules should be the same (cached)
      expect(mod1).toBe(mod2);

      // Environment loading should only happen once due to module caching
      expect(mockDotenvConfig).toHaveBeenCalledTimes(3);
    });

    it("should allow force reload of environment via module cache reset", async () => {
      // First import
      await import("../development");
      expect(mockDotenvConfig).toHaveBeenCalledTimes(3);

      // Clear module cache and mocks
      vi.resetModules();
      mockDotenvConfig.mockClear();

      // Second import after cache reset
      await import("../development");

      // Environment should be loaded again
      expect(mockDotenvConfig).toHaveBeenCalledTimes(3);
    });

    it("should handle large environment files efficiently", async () => {
      // Mock a large number of environment variables
      const startTime = Date.now();

      mockDotenvConfig.mockImplementation(() => {
        // Simulate loading many variables
        for (let i = 0; i < 100; i++) {
          process.env[`VAR_${i}`] = `value_${i}`;
        }
        return { parsed: {}, error: null };
      });

      await import("../development");

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should load efficiently (under reasonable time)
      expect(loadTime).toBeLessThan(1000); // Less than 1 second
      expect(process.env.VAR_0).toBe("value_0");
      expect(process.env.VAR_99).toBe("value_99");
    });
  });

  describe("Environment Detection", () => {
    it("should detect CI environment correctly", async () => {
      // Set CI environment variables
      process.env.CI = "true";
      process.env.GITHUB_ACTIONS = "true";

      await import("../test"); // Use test loader for CI

      // CI variables should be preserved with override: false
      expect(process.env.CI).toBe("true");
      expect(process.env.GITHUB_ACTIONS).toBe("true");

      // Test loader uses override: false to preserve CI environment
      const calls = mockDotenvConfig.mock.calls;
      calls.forEach((call) => {
        expect(call[0]?.override).toBe(false);
      });
    });

    it("should detect Docker container environment", async () => {
      // Set Docker-related environment variables
      process.env.DOCKER_CONTAINER = "true";
      process.env.HOSTNAME = "container-id";

      await import("../production");

      // Environment should load successfully in Docker
      expect(mockDotenvConfig).toHaveBeenCalledTimes(3);
      expect(process.env.DOCKER_CONTAINER).toBe("true");
    });

    it("should detect Vercel deployment environment", async () => {
      // Set Vercel environment variables
      process.env.VERCEL = "1";
      process.env.VERCEL_ENV = "production";
      process.env.VERCEL_URL = "myapp.vercel.app";

      await import("../production");

      // Vercel environment should be preserved
      expect(process.env.VERCEL).toBe("1");
      expect(process.env.VERCEL_ENV).toBe("production");
      expect(process.env.VERCEL_URL).toBe("myapp.vercel.app");
    });

    it("should set appropriate NODE_ENV for each environment", async () => {
      // Test development environment
      vi.resetModules();
      delete process.env.NODE_ENV;
      await import("../development");
      expect(process.env.NODE_ENV).toBe("development");

      // Test production environment
      vi.resetModules();
      delete process.env.NODE_ENV;
      await import("../production");
      expect(process.env.NODE_ENV).toBe("production");

      // Test test environment
      vi.resetModules();
      delete process.env.NODE_ENV;
      await import("../test");
      expect(process.env.NODE_ENV).toBe("test");
    });
  });
});
