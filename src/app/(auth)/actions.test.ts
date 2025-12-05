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
 * Mocking Strategy:
 * - Next.js headers() is mocked to return test-controlled header values
 * - Supabase client is mocked to avoid database dependencies

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

  it("should fallback to localhost when NEXT_PUBLIC_SITE_URL is not set", async () => {
    // Ensure NEXT_PUBLIC_SITE_URL is not set
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("PORT", "3000"); // Allow localhost:3000

    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    // It should succeed by falling back to localhost
    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
    expectRedirectToContain(mockSupabase, "http://localhost:3000");
  });

  it("should use NEXT_PUBLIC_SITE_URL when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pinpoint.example.com");

    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(undefined, formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
    expectRedirectToContain(mockSupabase, "https://pinpoint.example.com");
  });

  it("should ignore other headers and use NEXT_PUBLIC_SITE_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pinpoint.example.com");

    // Provide headers that might otherwise confuse logic

    vi.mocked(headers).mockReturnValue({
      get: (key: string) => {
        if (key === "host") return "evil.com";
        return null;
      },
    } as any);

    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    await forgotPasswordAction(undefined, formData);

    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
    expectRedirectToContain(mockSupabase, "https://pinpoint.example.com");
  });
});

describe("forgotPasswordAction - Origin Allowlist Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should accept localhost:3000 when configured as site URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should accept localhost:3100 when configured as site URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3100");
    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
  });

  it("should accept any valid URL configured in NEXT_PUBLIC_SITE_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://any-valid-url.com");
    const mockSupabase = createMockSupabase();
    mockCreateClient(mockSupabase);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalled();
    expectRedirectToContain(mockSupabase, "https://any-valid-url.com");
  });
});
