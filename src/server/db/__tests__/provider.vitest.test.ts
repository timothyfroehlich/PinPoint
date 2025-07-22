// DatabaseProvider is globally mocked in setup.ts for the dependency injection pattern
// This test ensures the global mock is properly configured

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatabaseProvider, getGlobalDatabaseProvider } from "../provider";

// Mock the database provider at the module level for Vitest
vi.mock("~/server/db", () => ({
  createPrismaClient: vi.fn().mockReturnValue({
    $disconnect: vi.fn().mockResolvedValue(undefined),
    organization: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  }),
}));

describe("DatabaseProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("should be mocked by global setup", () => {
    // The global mock should be in place
    const provider = new DatabaseProvider();
    expect(provider).toBeDefined();

    // The provider should have mocked methods
    expect(typeof provider.getClient).toBe("function");
    expect(typeof provider.disconnect).toBe("function");
    expect(typeof provider.reset).toBe("function");
  });

  it("global provider should be mocked", () => {
    const globalProvider = getGlobalDatabaseProvider();
    expect(globalProvider).toBeDefined();
    expect(typeof globalProvider.getClient).toBe("function");
  });
});
