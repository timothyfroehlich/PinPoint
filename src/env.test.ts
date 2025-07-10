import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

describe("Environment Variable Migration", () => {
  // Store original env values
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to ensure fresh env.js import
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it("should validate required environment variables", async () => {
    // Set up minimal required environment variables
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.OPDB_API_TOKEN = "test-token";
    process.env.AUTH_SECRET = "test-secret";

    // Dynamic import to get fresh env object
    const { env } = await import("~/env.js");

    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toBe("postgresql://test:test@localhost:5432/test");
    expect(env.OPDB_API_TOKEN).toBe("test-token");
    expect(env.AUTH_SECRET).toBe("test-secret");
  });

  it("should provide default values for optional environment variables", async () => {
    // Set up minimal required environment variables
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.OPDB_API_TOKEN = "test-token";
    process.env.AUTH_SECRET = "test-secret";

    // Dynamic import to get fresh env object
    const { env } = await import("~/env.js");

    // Test defaults
    expect(env.OPDB_API_URL).toBe("https://opdb.org/api");
    expect(env.DEFAULT_ORG_SUBDOMAIN).toBe("apc");
    expect(env.IMAGE_STORAGE_PROVIDER).toBe("local");
    expect(env.NEXT_PUBLIC_NODE_ENV).toBe("development");
  });

  it("should handle optional environment variables", async () => {
    // Set up required environment variables
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.OPDB_API_TOKEN = "test-token";
    process.env.AUTH_SECRET = "test-secret";

    // Set optional ones
    process.env.PINBALL_MAP_API_KEY = "test-pinball-key";
    process.env.OPDB_API_KEY = "test-opdb-key";
    process.env.VERCEL_URL = "test.vercel.app";
    process.env.PORT = "3001";

    // Dynamic import to get fresh env object
    const { env } = await import("~/env.js");

    expect(env.PINBALL_MAP_API_KEY).toBe("test-pinball-key");
    expect(env.OPDB_API_KEY).toBe("test-opdb-key");
    expect(env.VERCEL_URL).toBe("test.vercel.app");
    expect(env.PORT).toBe("3001");
  });

  it("should handle missing optional environment variables", async () => {
    // Set up minimal required environment variables
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.OPDB_API_TOKEN = "test-token";
    process.env.AUTH_SECRET = "test-secret";

    // Don't set optional ones
    delete process.env.PINBALL_MAP_API_KEY;
    delete process.env.OPDB_API_KEY;
    delete process.env.VERCEL_URL;
    delete process.env.PORT;

    // Dynamic import to get fresh env object
    const { env } = await import("~/env.js");

    expect(env.PINBALL_MAP_API_KEY).toBeUndefined();
    expect(env.OPDB_API_KEY).toBeUndefined();
    expect(env.VERCEL_URL).toBeUndefined();
    expect(env.PORT).toBeUndefined();
  });

  it("should validate IMAGE_STORAGE_PROVIDER enum", async () => {
    // Set up required environment variables
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.OPDB_API_TOKEN = "test-token";
    process.env.AUTH_SECRET = "test-secret";
    process.env.IMAGE_STORAGE_PROVIDER = "vercel-blob";

    // Dynamic import to get fresh env object
    const { env } = await import("~/env.js");

    expect(env.IMAGE_STORAGE_PROVIDER).toBe("vercel-blob");
  });

  it("should fail validation for invalid IMAGE_STORAGE_PROVIDER", async () => {
    // Set up required environment variables
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.OPDB_API_TOKEN = "test-token";
    process.env.AUTH_SECRET = "test-secret";
    process.env.IMAGE_STORAGE_PROVIDER = "invalid-provider";

    // Dynamic import should throw validation error
    await expect(async () => {
      await import("~/env.js");
    }).rejects.toThrow();
  });
});