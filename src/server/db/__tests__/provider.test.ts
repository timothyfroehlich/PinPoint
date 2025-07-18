// DatabaseProvider is globally mocked in setup.ts for the dependency injection pattern
// This test ensures the global mock is properly configured

import { DatabaseProvider, getGlobalDatabaseProvider } from "../provider";

describe("DatabaseProvider", () => {
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
