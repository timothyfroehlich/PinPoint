import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  signupAction,
  forgotPasswordAction,
  resetPasswordAction,
} from "./actions";

// Mock dependencies
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("~/lib/rate-limit", () => ({
  checkSignupLimit: vi.fn().mockResolvedValue({ success: true }),
  checkForgotPasswordLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  formatResetTime: vi.fn(),
}));

// Mock URL helper
vi.mock("~/lib/url", () => ({
  getSiteUrl: vi.fn().mockReturnValue("http://localhost:3000"),
}));

import { createClient } from "~/lib/supabase/server";

describe("Security: Error Handling in Auth Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const sensitiveError =
    "Connection failed to postgres://user:pass@db.internal:5432/secrets";
  const genericError = "An unexpected error occurred";

  it("should NOT leak raw database errors in signup action", async () => {
    // Mock Supabase failure
    const mockSupabase = {
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: sensitiveError },
        }),
      },
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const formData = new FormData();
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");
    formData.set("email", "john@example.com");
    formData.set("password", "SecurePass123!");
    formData.set("confirmPassword", "SecurePass123!");

    const result = await signupAction(undefined, formData);

    // Verify the error is generic
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).toBe(genericError);
      expect(result.message).not.toContain("postgres://");
    }
  });

  it("should NOT leak raw database errors in forgot password action", async () => {
    const mockSupabase = {
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({
          error: { message: sensitiveError },
        }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const formData = new FormData();
    formData.set("email", "john@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).toBe(genericError);
    }
  });

  it("should NOT leak raw database errors in reset password action", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
        }),
        updateUser: vi.fn().mockResolvedValue({
          error: { message: sensitiveError },
        }),
        signOut: vi.fn(),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const formData = new FormData();
    formData.set("password", "NewPass123!");
    formData.set("confirmPassword", "NewPass123!");

    const result = await resetPasswordAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).toBe(genericError);
    }
  });
});
