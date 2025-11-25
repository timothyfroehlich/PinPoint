import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forgotPasswordAction } from "./actions";

/**
 * Security-Critical Unit Tests for Auth Actions
 *
 * Tests origin resolution and allowlist validation to prevent:
 * - Host header injection attacks
 * - Open redirect vulnerabilities
 * - Port configuration bugs (whack-a-mole problem)
 *
 * These tests would have caught commits eb912c6 and 48a071a
 * (missing worktree ports in allowlist).
 *
 * Mocking Strategy:
 * - Next.js headers() is mocked to return test-controlled header values
 * - Supabase client is mocked to avoid database dependencies
 * - Flash messages are mocked to avoid cookie operations
 * - Logger is mocked to avoid console output
 *
 * IMPORTANT: Server Actions are async functions that use Next.js server context.
 * We mock the entire server context (headers, cookies) and the Supabase client.
 */

// Mock Next.js server modules BEFORE importing the module under test
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
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

// Import mocked modules for type safety
import { headers } from "next/headers";
import { createClient } from "~/lib/supabase/server";

interface MockSupabaseClient {
  auth: {
    resetPasswordForEmail: ReturnType<
      typeof vi.fn<
        (
          email: string,
          options?: { redirectTo?: string }
        ) => Promise<{ error: { message: string } | null }>
      >
    >;
    getUser: ReturnType<typeof vi.fn<() => Promise<{ data: { user: null } }>>>;
  };
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const createMockSupabase = (): MockSupabaseClient => ({
  auth: {
    resetPasswordForEmail: vi.fn(() =>
      Promise.resolve<{ error: { message: string } | null }>({ error: null })
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

const expectRedirectToContain = (
  client: MockSupabaseClient,
  expectedOrigin: string
): void => {
  const callArgs =
    client.auth.resetPasswordForEmail.mock.calls.at(-1) ??
    client.auth.resetPasswordForEmail.mock.calls[0];

  expect(callArgs, "resetPasswordForEmail was not called").toBeDefined();

  const [, options] = callArgs;
  expect(options?.redirectTo).toContain(expectedOrigin);
};

describe("forgotPasswordAction - Origin Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    vi.unstubAllEnvs();
  });

  it("should use origin header when present", async () => {
    // Ensure we're not affected by the test runner's PORT env var
    vi.stubEnv("PORT", "3000");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    // Mock headers to return origin
    vi.mocked(headers).mockReturnValue({
      get: (key: string) => {
        if (key === "origin") return "http://localhost:3000";
        return null;
      },
    } as Headers);

    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(undefined, formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
    expectRedirectToContain(mockSupabase, "http://localhost:3000");
  });

  it("should fall back to x-forwarded-proto + x-forwarded-host when origin missing", async () => {
    // Ensure NEXT_PUBLIC_SITE_URL is not set
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    // Use http protocol to match the allowlist (http://localhost:3000)
    vi.mocked(headers).mockReturnValue({
      get: (key: string) => {
        if (key === "x-forwarded-proto") return "http";
        if (key === "x-forwarded-host") return "localhost:3000";
        if (key === "host") return "localhost:3000"; // host is checked, so return a valid one
        return null;
      },
    } as Headers);

    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(undefined, formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
    expectRedirectToContain(mockSupabase, "http://localhost:3000");
  });

  it("should fall back to NEXT_PUBLIC_SITE_URL when all headers missing", async () => {
    vi.mocked(headers).mockReturnValue({
      get: () => null,
    } as Headers);

    // Set env var using vi.stubEnv
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pinpoint.example.com");

    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(undefined, formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
    expectRedirectToContain(mockSupabase, "https://pinpoint.example.com");
  });

  it("should handle PORT environment variable for local dev", async () => {
    // Ensure NEXT_PUBLIC_SITE_URL is not set
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("PORT", "3100");

    // Make sure no host header is present so it falls back to PORT
    vi.mocked(headers).mockReturnValue({
      get: () => null,
    } as Headers);

    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(undefined, formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
    expectRedirectToContain(mockSupabase, "http://localhost:3100");
  });

  it("should handle referer header as ultimate fallback", async () => {
    vi.mocked(headers).mockReturnValue({
      get: (key: string) => {
        if (key === "referer") return "http://localhost:3200/forgot-password";
        return null;
      },
    } as Headers);

    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(undefined, formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
    expectRedirectToContain(mockSupabase, "http://localhost:3200");
  });
});

describe("forgotPasswordAction - Origin Allowlist Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const setupMockForOrigin = (origin: string) => {
    vi.mocked(headers).mockReturnValue({
      get: (key: string) => {
        if (key === "origin") return origin;
        return null;
      },
    } as Headers);

    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);
    return mockSupabase;
  };

  it("should accept localhost:3000 (main worktree)", async () => {
    const mockSupabase = setupMockForOrigin("http://localhost:3000");

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should accept localhost:3100 (secondary worktree)", async () => {
    const mockSupabase = setupMockForOrigin("http://localhost:3100");

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should accept localhost:3200 (review worktree)", async () => {
    const mockSupabase = setupMockForOrigin("http://localhost:3200");

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should accept localhost:3300 (antigravity worktree)", async () => {
    const mockSupabase = setupMockForOrigin("http://localhost:3300");

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should accept NEXT_PUBLIC_SITE_URL if set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pinpoint-staging.vercel.app");
    const mockSupabase = setupMockForOrigin(
      "https://pinpoint-staging.vercel.app"
    );

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should reject unknown origin (security)", async () => {
    // Ensure NEXT_PUBLIC_SITE_URL is not set
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    // Provide headers that construct an evil origin via host header
    vi.mocked(headers).mockResolvedValue({
      get: (key: string) => {
        if (key === "host") return "evil.com";
        return null;
      },
    } as never);

    const mockSupabase = {
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
    }
  });
});
