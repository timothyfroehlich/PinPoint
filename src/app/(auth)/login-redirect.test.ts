import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loginAction } from "./actions";

/**
 * Unit Tests for Login Redirect Functionality
 *
 * Tests that loginAction correctly redirects to the "next" parameter
 * when provided in the form data, or falls back to /dashboard.
 *
 * Mocking Strategy:
 * - Next.js redirect() is mocked to capture the redirect URL
 * - Supabase client is mocked to simulate successful authentication
 * - Rate limiting is mocked to always allow requests
 * - Logger is mocked to avoid console output
 */

// Mock Next.js server modules BEFORE importing the module under test
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT: ${url}`);
  }),
}));

// Mock Supabase client
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock rate limiting
vi.mock("~/lib/rate-limit", () => ({
  checkLoginIpLimit: vi.fn(() => Promise.resolve({ success: true })),
  checkLoginAccountLimit: vi.fn(() => Promise.resolve({ success: true })),
  getClientIp: vi.fn(() => Promise.resolve("127.0.0.1")),
  formatResetTime: vi.fn((ms: number) => `${ms}ms`),
}));

// Import mocked modules
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";

interface MockSupabaseClient {
  auth: {
    signInWithPassword: ReturnType<
      typeof vi.fn<
        (params: { email: string; password: string }) => Promise<{
          data: { user: { id: string; email: string } };
          error: null;
        }>
      >
    >;
    getUser: ReturnType<typeof vi.fn<() => Promise<{ data: { user: null } }>>>;
  };
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const createMockSupabase = (): MockSupabaseClient => ({
  auth: {
    signInWithPassword: vi.fn(() =>
      Promise.resolve({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
        error: null,
      })
    ),
    getUser: vi.fn(() =>
      Promise.resolve<{ data: { user: null } }>({ data: { user: null } })
    ),
  },
});

const mockCreateClient = (client: MockSupabaseClient): void => {
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as SupabaseClient
  );
};

describe("loginAction - Redirect Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should redirect to /dashboard when no next parameter is provided", async () => {
    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "TestPassword123");
    formData.set("rememberMe", "on");

    await loginAction(undefined, formData);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/dashboard");
  });

  it("should redirect to the next parameter when provided", async () => {
    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "TestPassword123");
    formData.set("rememberMe", "on");
    formData.set("next", "/settings");

    await loginAction(undefined, formData);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/settings");
  });

  it("should redirect to /dashboard when next parameter is empty string", async () => {
    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "TestPassword123");
    formData.set("rememberMe", "on");
    formData.set("next", "");

    await loginAction(undefined, formData);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/dashboard");
  });

  it("should handle various protected routes in next parameter", async () => {
    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const testCases = ["/machines", "/issues/123", "/m/abc-def", "/settings"];

    for (const nextPath of testCases) {
      vi.clearAllMocks();

      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "TestPassword123");
      formData.set("next", nextPath);

      await loginAction(undefined, formData);

      expect(vi.mocked(redirect)).toHaveBeenCalledWith(nextPath);
    }
  });
});
