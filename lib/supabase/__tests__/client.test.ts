import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock @supabase/ssr
const mockClient = {
  auth: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
} as unknown as SupabaseClient;

const mockCreateBrowserClient = vi.fn(() => mockClient);

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mockCreateBrowserClient,
}));

// Mock environment
vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  },
}));

describe("Supabase Browser Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createClient", () => {
    it("should create a browser client with correct configuration", async () => {
      const { createClient } = await import("../client");

      createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key",
      );
    });

    it("should return a client with expected methods", async () => {
      const { createClient } = await import("../client");
      const client = createClient();

      expect(client).toHaveProperty("auth");
      expect(client).toHaveProperty("from");
      expect(client.auth).toHaveProperty("getSession");
      expect(client.auth).toHaveProperty("signInWithPassword");
      expect(client.auth).toHaveProperty("signOut");
    });
  });

  describe("getClient", () => {
    it("should return the same instance on multiple calls", async () => {
      const { getClient } = await import("../client");

      const client1 = getClient();
      const client2 = getClient();

      expect(client1).toBe(client2);
    });

    it("should create client only once for singleton pattern", async () => {
      // Clear the module cache to reset singleton
      vi.resetModules();

      const { getClient } = await import("../client");

      getClient();
      getClient();
      getClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledTimes(1);
    });

    it("should return client with expected structure", async () => {
      const { getClient } = await import("../client");
      const client = getClient();

      expect(client).toHaveProperty("auth");
      expect(client).toHaveProperty("from");
    });
  });

  describe("Environment Integration", () => {
    it("should use environment variables correctly", async () => {
      const { createClient } = await import("../client");

      createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key",
      );
    });
  });

  describe("Type Safety", () => {
    it("should return properly typed client", async () => {
      const { createClient } = await import("../client");
      const client = createClient();

      // These should not cause TypeScript errors
      expect(typeof client.auth.getSession).toBe("function");
      expect(typeof client.from).toBe("function");
    });

    it("should export correct types", async () => {
      const clientModule = await import("../client");

      expect(clientModule).toHaveProperty("createClient");
      expect(clientModule).toHaveProperty("getClient");
    });
  });
});
