import { describe, it, expect, vi, beforeEach } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

// Mock Next.js cookies
const mockCookieStore = {
  getAll: vi.fn(() => [
    { name: "sb-access-token", value: "test-token" },
    { name: "sb-refresh-token", value: "test-refresh" },
  ]),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Mock @supabase/ssr
const mockServerClient = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
} as unknown as SupabaseClient;

const mockCreateServerClient = vi.fn(() => mockServerClient);

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

// Mock environment
vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  },
}));

describe("Supabase Server Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createClient", () => {
    it("should create a server client with correct configuration", async () => {
      const { createClient } = await import("../server");

      await createClient();

      expect(mockCreateServerClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key",
        expect.any(Object),
      );
    });

    it("should return a client with expected methods", async () => {
      const { createClient } = await import("../server");
      const client = await createClient();

      expect(client).toHaveProperty("auth");
      expect(client).toHaveProperty("from");
      expect(client.auth).toHaveProperty("getSession");
      expect(client.auth).toHaveProperty("getUser");
    });

    it("should handle async cookies correctly", async () => {
      const { createClient } = await import("../server");

      const clientPromise = createClient();
      expect(clientPromise).toBeInstanceOf(Promise);

      const client = await clientPromise;
      expect(client).toBeDefined();
    });
  });

  describe("createAdminClient", () => {
    it("should create admin client with service role key", async () => {
      const { createAdminClient } = await import("../server");

      await createAdminClient();

      expect(mockCreateServerClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-service-role-key",
        expect.any(Object),
      );
    });

    it("should return a client with expected methods", async () => {
      const { createAdminClient } = await import("../server");
      const client = await createAdminClient();

      expect(client).toHaveProperty("auth");
      expect(client).toHaveProperty("from");
    });
  });

  describe("Environment Integration", () => {
    it("should use correct environment variables for regular client", async () => {
      const { createClient } = await import("../server");

      await createClient();

      expect(mockCreateServerClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key",
        expect.any(Object),
      );
    });

    it("should use correct environment variables for admin client", async () => {
      const { createAdminClient } = await import("../server");

      await createAdminClient();

      expect(mockCreateServerClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-service-role-key",
        expect.any(Object),
      );
    });
  });

  describe("Next.js Integration", () => {
    it("should properly integrate with Next.js cookies", async () => {
      const { cookies } = await import("next/headers");
      const { createClient } = await import("../server");

      await createClient();

      expect(cookies).toHaveBeenCalled();
    });
  });

  describe("Type Safety", () => {
    it("should export correct types", async () => {
      const serverModule = await import("../server");

      expect(serverModule).toHaveProperty("createClient");
      expect(serverModule).toHaveProperty("createAdminClient");
    });

    it("should return properly typed clients", async () => {
      const { createClient, createAdminClient } = await import("../server");

      const client = await createClient();
      const adminClient = await createAdminClient();

      expect(client).toHaveProperty("auth");
      expect(client).toHaveProperty("from");
      expect(adminClient).toHaveProperty("auth");
      expect(adminClient).toHaveProperty("from");
    });
  });
});
