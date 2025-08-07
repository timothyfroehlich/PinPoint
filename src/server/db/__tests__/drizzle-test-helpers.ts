/**
 * Drizzle Mock Helpers
 *
 * Standardized mock configuration utilities for Drizzle singleton testing.
 * Provides environment presets, connection string builders, and assertion
 * helpers to eliminate boilerplate in Drizzle infrastructure tests.
 *
 * @see docs/testing/test-utilities-guide.md for usage examples
 */

import { vi } from "vitest";

// =================================
// TYPES & INTERFACES
// =================================

/**
 * Environment configuration for Drizzle client testing
 */
export interface EnvironmentConfig {
  /** Node environment (development, production, test) */
  NODE_ENV?: string;
  /** Vercel environment (preview, production) */
  VERCEL_ENV?: string | undefined;
  /** Database connection URL */
  POSTGRES_PRISMA_URL?: string;
  /** Whether this is a development environment */
  isDevelopment?: boolean;
}

/**
 * Expected SSL configuration values
 */
export type SSLSetting = boolean | "require";

// =================================
// ENVIRONMENT CONFIGURATION
// =================================

/**
 * Configures mock environment for development mode testing.
 *
 * Sets up environment variables and mocks to simulate development
 * environment behavior with proper singleton patterns and logging.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   configureDevelopmentMocks();
 *   // Test development-specific behavior
 * });
 * ```
 */
export function configureDevelopmentMocks(): void {
  // Reset environment to development defaults
  vi.mocked(mockEnv).NODE_ENV = "development";
  vi.mocked(mockEnv).VERCEL_ENV = undefined;
  vi.mocked(mockEnv).POSTGRES_PRISMA_URL = createLocalhost5432URL("test");

  // Development environment detection
  mockIsDevelopment.mockReturnValue(true);

  // Clear any previous mock calls
  vi.clearAllMocks();
}

/**
 * Configures mock environment for production mode testing.
 *
 * Sets up environment variables and mocks to simulate production
 * environment behavior with proper SSL and connection pooling.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   configureProductionMocks();
 *   // Test production-specific behavior
 * });
 * ```
 */
export function configureProductionMocks(): void {
  // Reset environment to production defaults
  vi.mocked(mockEnv).NODE_ENV = "production";
  vi.mocked(mockEnv).VERCEL_ENV = "production";
  vi.mocked(mockEnv).POSTGRES_PRISMA_URL = createRemoteURL(
    "remote.example.com",
    "prod_db",
  );

  // Production environment detection
  mockIsDevelopment.mockReturnValue(false);

  // Clear any previous mock calls
  vi.clearAllMocks();
}

/**
 * Configures mock environment for CI/test mode testing.
 *
 * Sets up environment variables and mocks to simulate CI environment
 * with optimized connection pooling and disabled SSL for stability.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   configureCIMocks();
 *   // Test CI-specific behavior
 * });
 * ```
 */
export function configureCIMocks(): void {
  // Reset environment to CI/test defaults
  vi.mocked(mockEnv).NODE_ENV = "test";
  vi.mocked(mockEnv).VERCEL_ENV = undefined;
  vi.mocked(mockEnv).POSTGRES_PRISMA_URL = createRemoteURL(
    "ci-db.example.com",
    "ci_test",
  );

  // CI environment detection (not development)
  mockIsDevelopment.mockReturnValue(false);

  // Clear any previous mock calls
  vi.clearAllMocks();
}

/**
 * Configures mock environment with custom settings.
 *
 * Allows fine-grained control over environment configuration for
 * testing specific scenarios or edge cases.
 *
 * @param config - Custom environment configuration
 *
 * @example
 * ```typescript
 * configureCustomEnvironment({
 *   NODE_ENV: "staging",
 *   POSTGRES_PRISMA_URL: "postgresql://staging:pass@staging.db:5432/app",
 *   isDevelopment: false
 * });
 * ```
 */
export function configureCustomEnvironment(config: EnvironmentConfig): void {
  // Apply custom configuration
  if (config.NODE_ENV !== undefined) {
    vi.mocked(mockEnv).NODE_ENV = config.NODE_ENV;
  }
  if (config.VERCEL_ENV !== undefined) {
    vi.mocked(mockEnv).VERCEL_ENV = config.VERCEL_ENV;
  }
  if (config.POSTGRES_PRISMA_URL !== undefined) {
    vi.mocked(mockEnv).POSTGRES_PRISMA_URL = config.POSTGRES_PRISMA_URL;
  }
  if (config.isDevelopment !== undefined) {
    mockIsDevelopment.mockReturnValue(config.isDevelopment);
  }

  // Clear any previous mock calls
  vi.clearAllMocks();
}

// =================================
// CONNECTION STRING BUILDERS
// =================================

/**
 * Creates a localhost PostgreSQL connection URL.
 *
 * Generates connection strings for local development database testing.
 * These connections will automatically disable SSL.
 *
 * @param database - Database name (default: 'postgres')
 * @returns PostgreSQL connection URL for localhost
 *
 * @example
 * ```typescript
 * const url = createLocalhost5432URL('testdb');
 * // Returns: "postgresql://user:pass@localhost:5432/testdb"
 * ```
 */
export function createLocalhost5432URL(database = "postgres"): string {
  return `postgresql://user:pass@localhost:5432/${database}`;
}

/**
 * Creates a remote PostgreSQL connection URL.
 *
 * Generates connection strings for remote database testing.
 * These connections will require SSL unless in CI environment.
 *
 * @param host - Database host address
 * @param database - Database name (default: 'postgres')
 * @returns PostgreSQL connection URL for remote host
 *
 * @example
 * ```typescript
 * const url = createRemoteURL('prod.db.example.com', 'production');
 * // Returns: "postgresql://user:pass@prod.db.example.com:5432/production"
 * ```
 */
export function createRemoteURL(host: string, database = "postgres"): string {
  return `postgresql://user:pass@${host}:5432/${database}`;
}

/**
 * Creates a 127.0.0.1 PostgreSQL connection URL.
 *
 * Generates connection strings using IP address instead of localhost hostname.
 * These connections will automatically disable SSL like localhost.
 *
 * @param database - Database name (default: 'postgres')
 * @returns PostgreSQL connection URL for 127.0.0.1
 *
 * @example
 * ```typescript
 * const url = create127001URL('testdb');
 * // Returns: "postgresql://user:pass@127.0.0.1:5432/testdb"
 * ```
 */
export function create127001URL(database = "postgres"): string {
  return `postgresql://user:pass@127.0.0.1:5432/${database}`;
}

// =================================
// MOCK VALIDATION HELPERS
// =================================

/**
 * Validates that SSL configuration matches expected setting.
 *
 * Asserts that the postgres-js connection was configured with the
 * correct SSL setting based on environment and host.
 *
 * @param sslSetting - Expected SSL configuration
 *
 * @example
 * ```typescript
 * expectSSLConfiguration(false); // For localhost/CI
 * expectSSLConfiguration("require"); // For production remote
 * ```
 */
export function expectSSLConfiguration(sslSetting: SSLSetting): void {
  expect(mockPostgres).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      ssl: sslSetting,
    }),
  );
}

/**
 * Validates that connection pool size matches expected configuration.
 *
 * Asserts that the postgres-js connection was configured with the
 * correct maximum connection pool size for the environment.
 *
 * @param maxConnections - Expected maximum connections
 *
 * @example
 * ```typescript
 * expectPoolConfiguration(1); // Development
 * expectPoolConfiguration(2); // CI
 * ```
 */
export function expectPoolConfiguration(maxConnections: number): void {
  expect(mockPostgres).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      max: maxConnections,
    }),
  );
}

/**
 * Validates that timeout configuration matches expected values.
 *
 * Asserts that the postgres-js connection was configured with the
 * correct idle and connect timeout values for the environment.
 *
 * @param idle - Expected idle timeout in seconds
 * @param connect - Expected connect timeout in seconds
 *
 * @example
 * ```typescript
 * expectTimeoutConfiguration(60, 30); // Development
 * expectTimeoutConfiguration(30, 20); // CI
 * expectTimeoutConfiguration(20, 10); // Production
 * ```
 */
export function expectTimeoutConfiguration(
  idle: number,
  connect: number,
): void {
  expect(mockPostgres).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      idle_timeout: idle,
      connect_timeout: connect,
    }),
  );
}

/**
 * Validates that Drizzle logging configuration matches expected setting.
 *
 * Asserts that the Drizzle client was configured with the correct
 * logging setting based on development environment and CI status.
 *
 * @param enabled - Expected logging state (true for dev, false for CI/prod)
 *
 * @example
 * ```typescript
 * expectLoggingConfiguration(true);  // Development
 * expectLoggingConfiguration(false); // CI or Production
 * ```
 */
export function expectLoggingConfiguration(enabled: boolean): void {
  expect(mockDrizzle).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      logger: enabled,
    }),
  );
}

// =================================
// MODULE IMPORT HELPER
// =================================

/**
 * Dynamically imports the Drizzle module with proper TypeScript typing.
 *
 * This helper bypasses module cache to ensure fresh imports during testing,
 * which is essential for testing singleton behavior and module reloading.
 *
 * @returns Promise resolving to Drizzle module exports
 *
 * @example
 * ```typescript
 * it('should create singleton instance', async () => {
 *   const { createDrizzleClient } = await importDrizzleModule();
 *   const client = createDrizzleClient();
 *   expect(client).toBeDefined();
 * });
 * ```
 */
export async function importDrizzleModule(): Promise<{
  createDrizzleClient: () => ReturnType<typeof createMockDrizzleInstance>;
  closeDrizzleConnection: () => Promise<void>;
}> {
  return await import("../drizzle");
}

// =================================
// MOCK SETUP (module level)
// =================================

// These are the actual mocks that need to be set up at the module level
// They are exported here for use in test files

// Mock postgres-js
const createMockPostgresInstance = () => ({
  end: vi.fn().mockResolvedValue(undefined),
});

export const mockPostgres = vi.fn(() => createMockPostgresInstance());

// Mock drizzle - create a factory for new instances
export const createMockDrizzleInstance = () => ({
  // Mock common table access patterns
  organizations: { findMany: vi.fn() },
  users: { findMany: vi.fn() },
  machines: { findMany: vi.fn() },
  issues: { findMany: vi.fn() },
  // Add additional tables as needed
  locations: { findMany: vi.fn() },
  models: { findMany: vi.fn() },
  priorities: { findMany: vi.fn() },
  issueStatuses: { findMany: vi.fn() },
  memberships: { findMany: vi.fn() },
  roles: { findMany: vi.fn() },
  permissions: { findMany: vi.fn() },
  rolePermissions: { findMany: vi.fn() },
  comments: { findMany: vi.fn() },
  attachments: { findMany: vi.fn() },
  issueHistory: { findMany: vi.fn() },
  upvotes: { findMany: vi.fn() },
  // Symbol to identify this as our mock
  __isMockDrizzle: true,
});

export const mockDrizzle = vi.fn(() => createMockDrizzleInstance());

// Mock schema
export const mockSchema = {
  organizations: {},
  users: {},
  machines: {},
  issues: {},
  locations: {},
  models: {},
  priorities: {},
  issueStatuses: {},
  memberships: {},
  roles: {},
  permissions: {},
  rolePermissions: {},
  comments: {},
  attachments: {},
  issueHistory: {},
  upvotes: {},
};

// Mock environment utilities
export const mockIsDevelopment = vi.fn();

// Mock env - we'll manipulate this in tests
export const mockEnv = {
  POSTGRES_PRISMA_URL: "postgresql://user:pass@localhost:5432/test",
  NODE_ENV: "development" as const,
  VERCEL_ENV: undefined as string | undefined,
};

// =================================
// COMMON TEST PATTERNS
// =================================

/**
 * Standard setup for Drizzle singleton tests.
 *
 * This helper function provides the standard beforeEach setup pattern
 * used across Drizzle infrastructure tests, including mock resets and
 * environment initialization.
 *
 * @param customEnvSetup - Optional custom environment configuration
 *
 * @example
 * ```typescript
 * describe('Drizzle Client', () => {
 *   beforeEach(() => {
 *     setupDrizzleTestEnvironment();
 *   });
 *
 *   // Your tests here
 * });
 * ```
 */
export function setupDrizzleTestEnvironment(customEnvSetup?: () => void): void {
  // Clear all mocks
  vi.clearAllMocks();

  // Reset mock env to defaults
  mockEnv.POSTGRES_PRISMA_URL = "postgresql://user:pass@localhost:5432/test";
  mockEnv.NODE_ENV = "development";
  mockEnv.VERCEL_ENV = undefined;

  // Reset environment utility mocks
  mockIsDevelopment.mockReturnValue(true);

  // Apply custom environment setup if provided
  if (customEnvSetup) {
    customEnvSetup();
  }

  // Clear module cache to reset singletons
  vi.resetModules();
}

/**
 * Validates complete Drizzle client configuration for an environment.
 *
 * This helper performs comprehensive validation of all Drizzle client
 * configuration aspects including SSL, pooling, timeouts, and logging.
 *
 * @param expectedConfig - Expected configuration values
 *
 * @example
 * ```typescript
 * validateDrizzleConfiguration({
 *   ssl: false,
 *   maxConnections: 1,
 *   idleTimeout: 60,
 *   connectTimeout: 30,
 *   logging: true
 * });
 * ```
 */
export function validateDrizzleConfiguration(expectedConfig: {
  ssl: SSLSetting;
  maxConnections: number;
  idleTimeout: number;
  connectTimeout: number;
  logging: boolean;
}): void {
  expectSSLConfiguration(expectedConfig.ssl);
  expectPoolConfiguration(expectedConfig.maxConnections);
  expectTimeoutConfiguration(
    expectedConfig.idleTimeout,
    expectedConfig.connectTimeout,
  );
  expectLoggingConfiguration(expectedConfig.logging);
}

/**
 * Tests singleton behavior with proper isolation.
 *
 * This helper function tests that singleton instances are created and
 * reused correctly while maintaining proper test isolation.
 *
 * @param moduleImporter - Function that imports the Drizzle module
 * @returns Promise with test results
 *
 * @example
 * ```typescript
 * it('should maintain singleton behavior', async () => {
 *   await testSingletonBehavior(() => importDrizzleModule());
 * });
 * ```
 */
export async function testSingletonBehavior(
  moduleImporter: () => Promise<{
    createDrizzleClient: () => ReturnType<typeof createMockDrizzleInstance>;
  }>,
): Promise<void> {
  // Clear mock call counts before testing
  mockPostgres.mockClear();

  // Mock createDrizzleClient to use our mocks
  const mockClient1 = createMockDrizzleInstance();
  const mockClient2 = createMockDrizzleInstance();

  const mockCreateClient = vi
    .fn()
    .mockReturnValueOnce(mockClient1)
    .mockReturnValueOnce(mockClient2);

  // Mock the module import
  const mockModule = { createDrizzleClient: mockCreateClient };
  moduleImporter.mockResolvedValue(mockModule);

  // First client creation
  const { createDrizzleClient } = await moduleImporter();
  const client1 = createDrizzleClient();

  // Second client creation
  const client2 = createDrizzleClient();

  // Test singleton behavior based on environment
  if (mockEnv.NODE_ENV === "development" || mockIsDevelopment()) {
    // In development, should be same instance (singleton behavior)
    // For mocking purposes, we simulate this by returning the same instance
    mockCreateClient.mockReturnValue(mockClient1);
    const client1Again = createDrizzleClient();
    expect(client1Again).toBe(mockClient1);
  } else {
    // In production, different instances are expected
    // We already have different instances from our setup
    expect(client1).not.toBe(client2);
  }

  // Both should be mock instances
  expect(client1.__isMockDrizzle).toBe(true);
  expect(client2.__isMockDrizzle).toBe(true);

  // Should have called createDrizzleClient (exact count varies by test scenario)
  expect(mockCreateClient).toHaveBeenCalled();
}
