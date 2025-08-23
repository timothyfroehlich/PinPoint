import { afterAll, vi } from "vitest";
import { DrizzleClient } from "~/server/db/drizzle";

/**
 * Creates a deep mock of the DrizzleClient for isolated testing.
 * This ensures that each test file has its own fresh set of mocks
 * and prevents pollution between test suites.
 */
export const createIsolatedMockDb = () => {
  const db: any = {
    query: {
      // Add required tables here, e.g., users: { findFirst: vi.fn() }
    },
    // Add chained methods here, e.g., update: vi.fn()
  };

  // Setup chaining for methods
  // e.g., db.update.mockImplementation(() => db);

  return db as unknown as DrizzleClient;
};

/**
 * Aggressively cleans up all mocks and resets modules after all tests in a file have run.
 * This is crucial for preventing mock state from leaking into other test files,
 * especially when dealing with complex, stateful mocks or singletons.
 */
export const aggressiveCleanupAll = () => {
  afterAll(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await vi.resetModules();
  });
};
