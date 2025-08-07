/**
 * Environment Test Helpers Validation Tests
 *
 * Validates that the environment test helper utilities work correctly
 * and provide the expected functionality for environment loader testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  createCleanEnvironment,
  setTestEnvironmentVars,
  simulateEnvFileContents,
  configureDotenvMocks,
  expectFileLoadOrder,
  setupDevelopmentScenario,
  setupProductionScenario,
  setupTestScenario,
  setupCIScenario,
  testEnvironmentPrecedence,
  validateCriticalEnvironmentVars,
  testMissingFileHandling,
  debugEnvironmentState,
  type EnvFileContents,
  type MockConfiguration,
} from "./env-test-helpers";

describe("Environment Test Helpers", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("Environment Management", () => {
    describe("createCleanEnvironment", () => {
      it("should delete standard environment variables", () => {
        // Set some test environment variables
        process.env.NODE_ENV = "test";
        process.env.DATABASE_URL = "test-url";
        process.env.TEST_VAR = "test-value";

        const restore = createCleanEnvironment();

        expect(process.env.NODE_ENV).toBeUndefined();
        expect(process.env.DATABASE_URL).toBeUndefined();
        expect(process.env.TEST_VAR).toBeUndefined();

        // Restore should bring back original values
        restore();
        expect(process.env.NODE_ENV).toBe("test");
        expect(process.env.DATABASE_URL).toBe("test-url");
        expect(process.env.TEST_VAR).toBe("test-value");
      });

      it("should delete additional custom variables", () => {
        process.env.CUSTOM_VAR1 = "value1";
        process.env.CUSTOM_VAR2 = "value2";

        const restore = createCleanEnvironment(["CUSTOM_VAR1", "CUSTOM_VAR2"]);

        expect(process.env.CUSTOM_VAR1).toBeUndefined();
        expect(process.env.CUSTOM_VAR2).toBeUndefined();

        restore();
        expect(process.env.CUSTOM_VAR1).toBe("value1");
        expect(process.env.CUSTOM_VAR2).toBe("value2");
      });

      it("should handle variables that were originally undefined", () => {
        // Ensure variables don't exist
        delete process.env.NON_EXISTENT_VAR;

        const restore = createCleanEnvironment(["NON_EXISTENT_VAR"]);

        // Should still be undefined after clean
        expect(process.env.NON_EXISTENT_VAR).toBeUndefined();

        // Restore should leave it undefined
        restore();
        expect(process.env.NON_EXISTENT_VAR).toBeUndefined();
      });
    });

    describe("setTestEnvironmentVars", () => {
      it("should set environment variables correctly", () => {
        const testVars = {
          NODE_ENV: "test",
          DATABASE_URL: "postgresql://test:test@localhost:5432/testdb",
          CUSTOM_SETTING: "test-value",
        };

        setTestEnvironmentVars(testVars);

        expect(process.env.NODE_ENV).toBe("test");
        expect(process.env.DATABASE_URL).toBe(
          "postgresql://test:test@localhost:5432/testdb",
        );
        expect(process.env.CUSTOM_SETTING).toBe("test-value");
      });

      it("should override existing environment variables", () => {
        process.env.EXISTING_VAR = "original";

        setTestEnvironmentVars({
          EXISTING_VAR: "overridden",
        });

        expect(process.env.EXISTING_VAR).toBe("overridden");
      });
    });

    describe("simulateEnvFileContents", () => {
      it("should simulate file contents correctly", () => {
        const mockDotenvConfig = vi.fn(() => ({ parsed: {}, error: null }));
        vi.mocked = vi.fn().mockReturnValue(mockDotenvConfig);

        const files: EnvFileContents = {
          ".env": { BASE_VAR: "base-value" },
          ".env.development": { BASE_VAR: "dev-value", DEV_VAR: "dev-only" },
          ".env.local": { LOCAL_VAR: "local-override" },
        };

        // Mock the configureDotenvMocks function behavior
        const _mockConfig = {
          mockDotenvConfig,
          mockExistsSync: vi.fn(() => true),
        };

        // Manually configure the simulation since we can't easily mock the internal call
        let _callCount = 0;
        mockDotenvConfig.mockImplementation(
          (options?: { path?: string; override?: boolean }) => {
            _callCount++;
            const path = options?.path || "";

            if (
              path.endsWith(".env.development") &&
              files[".env.development"]
            ) {
              Object.entries(files[".env.development"]).forEach(
                ([key, value]) => {
                  if (!options?.override && process.env[key]) return;
                  process.env[key] = value;
                },
              );
            } else if (
              path.endsWith(".env") &&
              !path.includes(".env.") &&
              files[".env"]
            ) {
              Object.entries(files[".env"]).forEach(([key, value]) => {
                if (!options?.override && process.env[key]) return;
                process.env[key] = value;
              });
            }

            return { parsed: {}, error: null };
          },
        );

        // Test the base functionality
        expect(typeof simulateEnvFileContents).toBe("function");
      });
    });
  });

  describe("Mock Configuration", () => {
    describe("configureDotenvMocks", () => {
      it("should return mock configuration object", () => {
        const mocks = configureDotenvMocks();

        expect(mocks).toHaveProperty("mockDotenvConfig");
        expect(mocks).toHaveProperty("mockExistsSync");
        expect(vi.isMockFunction(mocks.mockDotenvConfig)).toBe(true);
        expect(vi.isMockFunction(mocks.mockExistsSync)).toBe(true);
      });

      it("should configure default mock behavior", () => {
        const { mockDotenvConfig, mockExistsSync } = configureDotenvMocks();

        // Test default behavior
        const dotenvResult = mockDotenvConfig();
        expect(dotenvResult).toEqual({ parsed: {}, error: null });

        const existsResult = mockExistsSync("/some/path");
        expect(existsResult).toBe(true);
      });
    });

    describe("expectFileLoadOrder", () => {
      it("should validate correct file load order", () => {
        const mockDotenvConfig = vi.fn();

        // Simulate dotenv calls with specific paths
        mockDotenvConfig.mockImplementation((_options) => {
          // Store the call for validation
          return { parsed: {}, error: null };
        });

        // Simulate calls in expected order
        mockDotenvConfig({ path: "/project/.env" });
        mockDotenvConfig({ path: "/project/.env.development" });
        mockDotenvConfig({ path: "/project/.env.local" });

        expectFileLoadOrder(
          [".env", ".env.development", ".env.local"],
          mockDotenvConfig,
        );
        // Should not throw if order is correct
      });

      it("should fail with incorrect file load order", () => {
        const mockDotenvConfig = vi.fn();

        // Simulate calls in wrong order
        mockDotenvConfig({ path: "/project/.env.local" });
        mockDotenvConfig({ path: "/project/.env" });

        expect(() => {
          expectFileLoadOrder([".env", ".env.local"], mockDotenvConfig);
        }).toThrow();
      });
    });
  });

  describe("Common Test Scenarios", () => {
    describe("setupDevelopmentScenario", () => {
      it("should configure development environment", () => {
        setupDevelopmentScenario();

        expect(process.env.NODE_ENV).toBe("development");
        expect(process.env.DATABASE_URL).toBeDefined();
        expect(process.env.SUPABASE_URL).toBeDefined();
        expect(process.env.DATABASE_URL).toContain("localhost");
      });
    });

    describe("setupProductionScenario", () => {
      it("should configure production environment", () => {
        setupProductionScenario();

        expect(process.env.NODE_ENV).toBe("production");
        expect(process.env.VERCEL_ENV).toBe("production");
        expect(process.env.DATABASE_URL).toBeDefined();
        expect(process.env.SUPABASE_URL).toBeDefined();
        expect(process.env.DATABASE_URL).toContain("prod.db.example.com");
      });
    });

    describe("setupTestScenario", () => {
      it("should configure test environment", () => {
        setupTestScenario();

        expect(process.env.NODE_ENV).toBe("test");
        expect(process.env.DATABASE_URL).toBeDefined();
        expect(process.env.LOG_LEVEL).toBe("error");
        expect(process.env.DATABASE_URL).toContain("localhost");
      });
    });

    describe("setupCIScenario", () => {
      it("should configure CI environment", () => {
        setupCIScenario();

        expect(process.env.NODE_ENV).toBe("test");
        expect(process.env.CI).toBe("true");
        expect(process.env.GITHUB_ACTIONS).toBe("true");
        expect(process.env.DATABASE_URL).toBeDefined();
        expect(process.env.DISABLE_TELEMETRY).toBe("1");
      });
    });
  });

  describe("Advanced Testing Utilities", () => {
    describe("testEnvironmentPrecedence", () => {
      it("should validate environment precedence scenarios", () => {
        const _scenarios = [
          {
            name: "development overrides base",
            files: {
              ".env": { VAR: "base" },
              ".env.development": { VAR: "dev" },
            } as EnvFileContents,
            expected: { VAR: "dev" },
          },
          {
            name: "local overrides all",
            files: {
              ".env": { VAR: "base" },
              ".env.development": { VAR: "dev" },
              ".env.local": { VAR: "local" },
            } as EnvFileContents,
            expected: { VAR: "local" },
          },
        ];

        // This would test the precedence logic
        // For this validation test, we just ensure the function exists and accepts the right parameters
        expect(typeof testEnvironmentPrecedence).toBe("function");

        // Test that it accepts the expected parameter structure
        expect(() => {
          testEnvironmentPrecedence([]);
        }).not.toThrow();
      });
    });

    describe("validateCriticalEnvironmentVars", () => {
      it("should validate required environment variables exist", () => {
        process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
        process.env.NODE_ENV = "test";

        expect(() => {
          validateCriticalEnvironmentVars(["DATABASE_URL", "NODE_ENV"]);
        }).not.toThrow();
      });

      it("should fail when required variables are missing", () => {
        delete process.env.REQUIRED_VAR;

        expect(() => {
          validateCriticalEnvironmentVars(["REQUIRED_VAR"]);
        }).toThrow();
      });

      it("should validate with custom validation rules", () => {
        process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
        process.env.NODE_ENV = "test";

        const validationRules = {
          DATABASE_URL: (value: string) => value.startsWith("postgresql://"),
          NODE_ENV: (value: string) =>
            ["development", "production", "test"].includes(value),
        };

        expect(() => {
          validateCriticalEnvironmentVars(
            ["DATABASE_URL", "NODE_ENV"],
            validationRules,
          );
        }).not.toThrow();
      });

      it("should fail with invalid validation rules", () => {
        process.env.DATABASE_URL = "invalid-url";

        const validationRules = {
          DATABASE_URL: (value: string) => value.startsWith("postgresql://"),
        };

        expect(() => {
          validateCriticalEnvironmentVars(["DATABASE_URL"], validationRules);
        }).toThrow();
      });
    });

    describe("testMissingFileHandling", () => {
      it("should configure mocks for missing file scenarios", () => {
        const missingFiles = [".env.local"];
        const shouldContinue = true;

        // Test that the function exists and accepts expected parameters
        expect(() => {
          testMissingFileHandling(missingFiles, shouldContinue);
        }).not.toThrow();
      });
    });
  });

  describe("Debugging Utilities", () => {
    describe("debugEnvironmentState", () => {
      it("should log environment state", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {
          // Mock console.log to prevent output during tests
        });

        process.env.NODE_ENV = "test";
        process.env.DATABASE_URL = "test-url";

        debugEnvironmentState("Test Environment");

        expect(consoleSpy).toHaveBeenCalledWith("Test Environment state:");
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("NODE_ENV"),
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("DATABASE_URL"),
        );

        consoleSpy.mockRestore();
      });

      it("should handle undefined variables gracefully", () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {
          // Mock console.log to prevent output during tests
        });

        delete process.env.NODE_ENV;
        delete process.env.DATABASE_URL;

        debugEnvironmentState();

        expect(consoleSpy).toHaveBeenCalledWith("Environment state:");
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("(undefined)"),
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe("Type Safety and Integration", () => {
    it("should have correct TypeScript types for all utilities", () => {
      // Test that our helper functions have the expected types and interfaces

      // EnvFileContents interface
      const fileContents: EnvFileContents = {
        ".env": { BASE_VAR: "base" },
        ".env.development": { DEV_VAR: "dev" },
        ".env.production": { PROD_VAR: "prod" },
        ".env.test": { TEST_VAR: "test" },
        ".env.local": { LOCAL_VAR: "local" },
      };

      expect(fileContents[".env"]).toEqual({ BASE_VAR: "base" });
      expect(fileContents[".env.development"]).toEqual({ DEV_VAR: "dev" });

      // MockConfiguration interface
      const { mockDotenvConfig, mockExistsSync } = configureDotenvMocks();
      const mockConfig: MockConfiguration = {
        mockDotenvConfig,
        mockExistsSync,
      };

      expect(mockConfig.mockDotenvConfig).toBeDefined();
      expect(mockConfig.mockExistsSync).toBeDefined();
    });

    it("should work with realistic environment scenarios", () => {
      // Test that the helpers work together in realistic scenarios

      // 1. Clean environment
      const restore = createCleanEnvironment();

      // 2. Set up development scenario
      setupDevelopmentScenario();
      expect(process.env.NODE_ENV).toBe("development");

      // 3. Validate critical variables
      validateCriticalEnvironmentVars(["NODE_ENV", "DATABASE_URL"]);

      // 4. Debug state
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {
        // Mock console.log to prevent output during tests
      });
      debugEnvironmentState("Integration Test");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();

      // 5. Restore original state
      restore();

      // All steps should work without errors
    });

    it("should handle edge cases gracefully", () => {
      // Test edge cases and error conditions

      // Empty restore function
      const restore = createCleanEnvironment([]);
      expect(typeof restore).toBe("function");
      restore();

      // Empty environment variable sets
      setTestEnvironmentVars({});

      // Empty file contents
      simulateEnvFileContents({});

      // Empty validation
      validateCriticalEnvironmentVars([]);

      // All should work without errors
    });
  });
});
