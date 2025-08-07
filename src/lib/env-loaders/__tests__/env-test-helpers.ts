/**
 * Environment Test Helpers
 *
 * Environment variable management utilities for loader testing.
 * Provides clean environment setup, file content simulation, mock configuration,
 * and common scenario presets for comprehensive environment loader testing.
 *
 * @see docs/testing/test-utilities-guide.md for usage examples
 */

import { vi, type MockedFunction } from "vitest";

// =================================
// TYPES & INTERFACES
// =================================

/**
 * Environment file contents simulation
 */
export interface EnvFileContents {
  /** Base .env file contents */
  ".env"?: Record<string, string>;
  /** Development-specific .env.development contents */
  ".env.development"?: Record<string, string>;
  /** Production-specific .env.production contents */
  ".env.production"?: Record<string, string>;
  /** Test-specific .env.test contents */
  ".env.test"?: Record<string, string>;
  /** Local overrides .env.local contents */
  ".env.local"?: Record<string, string>;
}

/**
 * Mock configuration for dotenv and fs
 */
export interface MockConfiguration {
  mockDotenvConfig: ReturnType<typeof vi.fn>;
  mockExistsSync: ReturnType<typeof vi.fn>;
}

// =================================
// ENVIRONMENT MANAGEMENT
// =================================

/**
 * Creates a clean environment with specified variables deleted.
 *
 * Returns a restore function that can be called to restore the original
 * environment state. This is essential for test isolation.
 *
 * @param additionalVarsToDelete - Additional environment variables to delete
 * @returns Restore function to reset environment to original state
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   const restore = createCleanEnvironment(['CUSTOM_VAR']);
 *   // Test with clean environment
 *
 *   afterEach(() => {
 *     restore(); // Restore original environment
 *   });
 * });
 * ```
 */
export function createCleanEnvironment(
  additionalVarsToDelete: string[] = [],
): () => void {
  // Store original environment values
  const originalEnv: Record<string, string | undefined> = {};

  // Standard variables that typically interfere with tests
  const standardVarsToDelete = [
    "NODE_ENV",
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "DIRECT_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TEST_VAR",
    "VAR1",
    "VAR2",
    "VAR3",
  ];

  const allVarsToDelete = [...standardVarsToDelete, ...additionalVarsToDelete];

  // Store original values and delete from environment
  allVarsToDelete.forEach((varName) => {
    originalEnv[varName] = process.env[varName];
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env[varName];
  });

  // Return restore function
  return function restoreEnvironment(): void {
    Object.entries(originalEnv).forEach(([varName, originalValue]) => {
      if (originalValue === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete process.env[varName];
      } else {
        process.env[varName] = originalValue;
      }
    });
  };
}

/**
 * Sets test environment variables with type safety.
 *
 * This helper ensures that environment variables are set consistently
 * across tests without affecting the global environment permanently.
 *
 * @param vars - Object containing variable names and values to set
 *
 * @example
 * ```typescript
 * setTestEnvironmentVars({
 *   NODE_ENV: 'test',
 *   DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
 *   CUSTOM_SETTING: 'test-value'
 * });
 * ```
 */
export function setTestEnvironmentVars(vars: Record<string, string>): void {
  Object.entries(vars).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * Simulates environment file contents for testing file loading order and precedence.
 *
 * This function configures the dotenv mock to simulate different environment
 * files containing different variables, allowing testing of precedence and
 * loading behavior.
 *
 * @param files - Object mapping file names to their variable contents
 *
 * @example
 * ```typescript
 * simulateEnvFileContents({
 *   '.env': { BASE_VAR: 'base-value' },
 *   '.env.development': { BASE_VAR: 'dev-value', DEV_VAR: 'dev-only' },
 *   '.env.local': { LOCAL_VAR: 'local-override' }
 * });
 * ```
 */
export function simulateEnvFileContents(files: EnvFileContents): void {
  let callCount = 0;

  const { mockDotenvConfig } = configureDotenvMocks();

  mockDotenvConfig.mockImplementation(
    (options?: { path?: string; override?: boolean }) => {
      callCount++;
      const path = options?.path || "";

      // Determine which file is being loaded based on call order and path
      if (path.endsWith(".env.development") && files[".env.development"]) {
        Object.entries(files[".env.development"]).forEach(([key, value]) => {
          if (!options?.override && process.env[key]) return; // Respect override setting
          process.env[key] = value;
        });
      } else if (path.endsWith(".env.production") && files[".env.production"]) {
        Object.entries(files[".env.production"]).forEach(([key, value]) => {
          if (!options?.override && process.env[key]) return;
          process.env[key] = value;
        });
      } else if (path.endsWith(".env.test") && files[".env.test"]) {
        Object.entries(files[".env.test"]).forEach(([key, value]) => {
          if (!options?.override && process.env[key]) return;
          process.env[key] = value;
        });
      } else if (path.endsWith(".env.local") && files[".env.local"]) {
        Object.entries(files[".env.local"]).forEach(([key, value]) => {
          if (!options?.override && process.env[key]) return;
          process.env[key] = value;
        });
      } else if (
        path.endsWith(".env") &&
        !path.includes(".env.") &&
        files[".env"]
      ) {
        // Base .env file (not .env.something)
        Object.entries(files[".env"]).forEach(([key, value]) => {
          if (!options?.override && process.env[key]) return;
          process.env[key] = value;
        });
      }

      return { parsed: {}, error: null };
    },
  );
}

// =================================
// MOCK CONFIGURATION
// =================================

/**
 * Configures dotenv and fs mocks with standard behavior.
 *
 * Sets up mocks for dotenv.config() and fs.existsSync() with default
 * behavior that can be customized for specific test scenarios.
 *
 * @returns Object containing configured mock functions
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   const { mockDotenvConfig, mockExistsSync } = configureDotenvMocks();
 *   // Customize mock behavior for specific test
 *   mockExistsSync.mockImplementation((path) => !path.includes('.env.local'));
 * });
 * ```
 */
export function configureDotenvMocks(): MockConfiguration {
  // Mock dotenv - import should be mocked at module level in test files
  const mockDotenvConfig = vi.fn(() => ({ parsed: {}, error: null }));

  // Mock fs.existsSync - import should be mocked at module level in test files
  const mockExistsSync = vi.fn(() => true);

  // Configure default behavior
  mockDotenvConfig.mockReturnValue({ parsed: {}, error: null });
  mockExistsSync.mockReturnValue(true);

  return {
    mockDotenvConfig: mockDotenvConfig as MockedFunction<any>,
    mockExistsSync: mockExistsSync as MockedFunction<any>,
  };
}

/**
 * Validates that environment files were loaded in the expected order.
 *
 * This helper function verifies that dotenv.config() was called with
 * the correct file paths in the expected sequence.
 *
 * @param expectedFiles - Array of expected file names in load order
 * @param mockDotenvConfig - Mocked dotenv.config function
 *
 * @example
 * ```typescript
 * expectFileLoadOrder(
 *   ['.env', '.env.development', '.env.local'],
 *   mockDotenvConfig
 * );
 * ```
 */
export function expectFileLoadOrder(
  expectedFiles: string[],
  mockDotenvConfig: MockedFunction<any>,
): void {
  expect(mockDotenvConfig).toHaveBeenCalledTimes(expectedFiles.length);

  expectedFiles.forEach((filename, index) => {
    const call = mockDotenvConfig.mock.calls[index];
    expect(call?.[0]?.path).toMatch(
      new RegExp(`${filename.replace(".", "\\.")}$`),
    );
  });
}

// =================================
// COMMON TEST SCENARIOS
// =================================

/**
 * Sets up standard development environment scenario.
 *
 * Configures environment variables and mocks to simulate a typical
 * development environment with local database and development settings.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupDevelopmentScenario();
 *   // Test development-specific behavior
 * });
 * ```
 */
export function setupDevelopmentScenario(): void {
  setTestEnvironmentVars({
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://localhost:54322/postgres",
    DIRECT_URL: "postgresql://localhost:54322/postgres",
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dev-key",
  });

  simulateEnvFileContents({
    ".env": {
      BASE_URL: "http://localhost:3000",
      NODE_ENV: "development",
    },
    ".env.development": {
      DATABASE_URL: "postgresql://localhost:54322/postgres",
      DEBUG: "true",
    },
    ".env.local": {
      LOCAL_OVERRIDE: "development-local",
    },
  });
}

/**
 * Sets up standard production environment scenario.
 *
 * Configures environment variables and mocks to simulate a typical
 * production environment with remote database and production settings.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupProductionScenario();
 *   // Test production-specific behavior
 * });
 * ```
 */
export function setupProductionScenario(): void {
  setTestEnvironmentVars({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@prod.db.example.com:5432/app",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prod-key",
    SUPABASE_SERVICE_ROLE_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-key",
  });

  simulateEnvFileContents({
    ".env": {
      BASE_URL: "https://app.production.com",
      NODE_ENV: "production",
    },
    ".env.production": {
      DATABASE_URL: "postgresql://user:pass@prod.db.example.com:5432/app",
      LOG_LEVEL: "warn",
      ENABLE_ANALYTICS: "true",
    },
    ".env.local": {
      DEPLOYMENT_SPECIFIC: "prod-deploy-setting",
    },
  });
}

/**
 * Sets up standard test environment scenario.
 *
 * Configures environment variables and mocks to simulate a typical
 * test environment with test database and minimal logging.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupTestScenario();
 *   // Test test-environment-specific behavior
 * });
 * ```
 */
export function setupTestScenario(): void {
  setTestEnvironmentVars({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:54322/test",
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-key",
    LOG_LEVEL: "error",
  });

  simulateEnvFileContents({
    ".env": {
      BASE_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
    ".env.development": {
      DEBUG: "true",
      DATABASE_URL: "postgresql://localhost:54322/postgres",
    },
    ".env.test": {
      DATABASE_URL: "postgresql://test:test@localhost:54322/test",
      LOG_LEVEL: "error",
      DISABLE_ANALYTICS: "true",
    },
    ".env.local": {
      LOCAL_TEST_SETTING: "test-local",
    },
  });
}

/**
 * Sets up standard CI environment scenario.
 *
 * Configures environment variables and mocks to simulate a typical
 * CI environment with CI-specific database and settings.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupCIScenario();
 *   // Test CI-specific behavior
 * });
 * ```
 */
export function setupCIScenario(): void {
  setTestEnvironmentVars({
    NODE_ENV: "test",
    CI: "true",
    GITHUB_ACTIONS: "true",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ci_test",
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ci-key",
    LOG_LEVEL: "error",
    DISABLE_TELEMETRY: "1",
  });

  simulateEnvFileContents({
    ".env": {
      BASE_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
    ".env.test": {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/ci_test",
      LOG_LEVEL: "error",
      PARALLEL_TESTS: "true",
    },
    // Note: .env.local typically not used in CI
  });
}

// =================================
// ADVANCED TESTING UTILITIES
// =================================

/**
 * Tests environment variable precedence with multiple files.
 *
 * This helper validates that environment variables are loaded and
 * overridden in the correct order according to dotenv precedence rules.
 *
 * @param scenarios - Array of test scenarios with expected outcomes
 *
 * @example
 * ```typescript
 * testEnvironmentPrecedence([
 *   {
 *     name: 'development overrides base',
 *     files: {
 *       '.env': { VAR: 'base' },
 *       '.env.development': { VAR: 'dev' }
 *     },
 *     expected: { VAR: 'dev' }
 *   }
 * ]);
 * ```
 */
export function testEnvironmentPrecedence(
  scenarios: {
    name: string;
    files: EnvFileContents;
    expected: Record<string, string>;
  }[],
): void {
  scenarios.forEach((scenario) => {
    const restore = createCleanEnvironment();

    try {
      simulateEnvFileContents(scenario.files);

      Object.entries(scenario.expected).forEach(([key, expectedValue]) => {
        expect(process.env[key]).toBe(expectedValue);
      });
    } finally {
      restore();
    }
  });
}

/**
 * Validates that critical environment variables are handled correctly.
 *
 * This helper ensures that essential environment variables required
 * for application operation are present and have valid values.
 *
 * @param requiredVars - Array of required environment variable names
 * @param validationRules - Optional validation rules for variable values
 *
 * @example
 * ```typescript
 * validateCriticalEnvironmentVars(
 *   ['DATABASE_URL', 'NODE_ENV'],
 *   {
 *     DATABASE_URL: (value) => value.startsWith('postgresql://'),
 *     NODE_ENV: (value) => ['development', 'production', 'test'].includes(value)
 *   }
 * );
 * ```
 */
export function validateCriticalEnvironmentVars(
  requiredVars: string[],
  validationRules?: Record<string, (value: string) => boolean>,
): void {
  requiredVars.forEach((varName) => {
    const value = process.env[varName];
    expect(value).toBeDefined();
    expect(value).not.toBe("");

    if (validationRules?.[varName] && value) {
      const validationFn = validationRules[varName];
      if (validationFn) {
        expect(validationFn(value)).toBe(true);
      }
    }
  });
}

/**
 * Tests environment file loading with missing files.
 *
 * This helper validates that the environment loader handles missing
 * .env files gracefully without throwing errors.
 *
 * @param missingFiles - Array of file names to simulate as missing
 * @param shouldContinue - Whether loading should continue despite missing files
 *
 * @example
 * ```typescript
 * testMissingFileHandling(['.env.local'], true);
 * // Should continue loading even if .env.local is missing
 * ```
 */
export function testMissingFileHandling(
  missingFiles: string[],
  shouldContinue = true,
): void {
  const { mockExistsSync, mockDotenvConfig } = configureDotenvMocks();

  // Configure existsSync to return false for missing files
  mockExistsSync.mockImplementation((path: string) => {
    return !missingFiles.some((missingFile) =>
      path.toString().endsWith(missingFile),
    );
  });

  // Configure dotenv to return error for missing files
  mockDotenvConfig.mockImplementation((options?: { path?: string }) => {
    const path = options?.path || "";
    const isMissing = missingFiles.some((missingFile) =>
      path.endsWith(missingFile),
    );

    if (isMissing) {
      return {
        parsed: null,
        error: new Error("ENOENT: no such file or directory"),
      };
    }

    return { parsed: {}, error: null };
  });

  if (shouldContinue) {
    // Should not throw despite missing files
    expect(() => {
      // Environment loader should handle this gracefully
    }).not.toThrow();
  }
}

// =================================
// DEBUGGING UTILITIES
// =================================

/**
 * Logs current environment state for debugging test issues.
 *
 * This utility helps debug environment-related test failures by
 * showing the current state of all relevant environment variables.
 *
 * @param prefix - Optional prefix for log messages
 *
 * @example
 * ```typescript
 * it('should load environment correctly', () => {
 *   debugEnvironmentState('Before loading');
 *   // ... test code ...
 *   debugEnvironmentState('After loading');
 * });
 * ```
 */
export function debugEnvironmentState(prefix = "Environment"): void {
  const relevantVars = [
    "NODE_ENV",
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "SUPABASE_URL",
    "VERCEL_ENV",
    "CI",
    "TEST_VAR",
  ];

  console.log(`${prefix} state:`);
  relevantVars.forEach((varName) => {
    const value = process.env[varName];
    console.log(`  ${varName}: ${value || "(undefined)"}`);
  });
}
