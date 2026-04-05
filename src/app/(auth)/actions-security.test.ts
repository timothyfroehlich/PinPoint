import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loginAction,
  signupAction,
  forgotPasswordAction,
  resetPasswordAction,
} from "./actions";

// Mock Next.js server modules
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
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
  checkLoginIpLimit: vi.fn().mockResolvedValue({ success: true, reset: 0 }),
  checkLoginAccountLimit: vi
    .fn()
    .mockResolvedValue({ success: true, reset: 0 }),
  checkSignupLimit: vi.fn().mockResolvedValue({ success: true, reset: 0 }),
  checkForgotPasswordLimit: vi
    .fn()
    .mockResolvedValue({ success: true, reset: 0 }),
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  formatResetTime: vi.fn().mockReturnValue("0s"),
}));

// Mock Supabase
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "~/lib/supabase/server";

describe("Auth Actions Security - Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signupAction should return generic error message on server error", async () => {
    const { AuthApiError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          error: new AuthApiError(
            "Database connection failed: 5432",
            500,
            "unexpected_failure"
          ),
          data: { user: null },
        }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "Password123!");
    formData.set("confirmPassword", "Password123!");
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");
    formData.set("termsAccepted", "on");

    const result = await signupAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).toBe("An unexpected error occurred during signup");
      expect(result.message).not.toContain("Database connection failed");
    }
  });

  it("signupAction should return specific error for duplicate email", async () => {
    const { AuthApiError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          error: new AuthApiError(
            "User already registered",
            409,
            "user_already_exists"
          ),
          data: { user: null },
        }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "taken@example.com");
    formData.set("password", "Password123!");
    formData.set("confirmPassword", "Password123!");
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");
    formData.set("termsAccepted", "on");

    const result = await signupAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EMAIL_TAKEN");
      expect(result.message).toBe("This email is already registered.");
    }
  });

  it("signupAction should return WEAK_PASSWORD for breached password", async () => {
    const { AuthWeakPasswordError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          error: new AuthWeakPasswordError("Password is too weak", 422, [
            "pwned",
          ]),
          data: { user: null },
        }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "Password123!");
    formData.set("confirmPassword", "Password123!");
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");
    formData.set("termsAccepted", "on");

    const result = await signupAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WEAK_PASSWORD");
      expect(result.message).toContain("data breach");
      expect(result.message).not.toContain("Password is too weak");
    }
  });

  it("signupAction should return CAPTCHA error for captcha_failed", async () => {
    const { AuthApiError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          error: new AuthApiError(
            "captcha protection: request disallowed (timeout-or-duplicate)",
            400,
            "captcha_failed"
          ),
          data: { user: null },
        }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "StrongUniquePass99!");
    formData.set("confirmPassword", "StrongUniquePass99!");
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");
    formData.set("termsAccepted", "on");

    const result = await signupAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CAPTCHA");
      expect(result.message).toContain("refresh");
      expect(result.message).not.toContain("timeout-or-duplicate");
    }
  });

  it("signupAction should return SERVER when createClient() throws", async () => {
    vi.mocked(createClient).mockRejectedValue(
      new Error("Missing SUPABASE_URL")
    );

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "StrongUniquePass99!");
    formData.set("confirmPassword", "StrongUniquePass99!");
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");
    formData.set("termsAccepted", "on");

    const result = await signupAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).not.toContain("SUPABASE_URL");
    }
  });

  it("forgotPasswordAction should surface CAPTCHA errors", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { AuthApiError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({
          error: new AuthApiError("captcha failed", 400, "captcha_failed"),
        }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CAPTCHA");
    }
  });

  it("forgotPasswordAction should return success for non-CAPTCHA errors (prevent enumeration)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { AuthApiError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({
          error: new AuthApiError(
            "SMTP connection timeout",
            500,
            "unexpected_failure"
          ),
        }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(true);
  });

  it("resetPasswordAction should return WEAK_PASSWORD for breached password", async () => {
    const { AuthWeakPasswordError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
        updateUser: vi.fn().mockResolvedValue({
          error: new AuthWeakPasswordError("Password is too weak", 422, [
            "pwned",
          ]),
        }),
        signOut: vi.fn(),
      },
    } as any);

    const formData = new FormData();
    formData.set("password", "Password123!");
    formData.set("confirmPassword", "Password123!");

    const result = await resetPasswordAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WEAK_PASSWORD");
      expect(result.message).toContain("data breach");
    }
  });

  it("resetPasswordAction should return SAME_PASSWORD for same_password error", async () => {
    const { AuthApiError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
        updateUser: vi.fn().mockResolvedValue({
          error: new AuthApiError("Same password", 422, "same_password"),
        }),
        signOut: vi.fn(),
      },
    } as any);

    const formData = new FormData();
    formData.set("password", "OldPassword123!");
    formData.set("confirmPassword", "OldPassword123!");

    const result = await resetPasswordAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SAME_PASSWORD");
      expect(result.message).toContain("different");
    }
  });

  it("resetPasswordAction should return generic error message on server error", async () => {
    const { AuthApiError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
        updateUser: vi.fn().mockResolvedValue({
          error: new AuthApiError(
            "Constraint violation: password_history",
            500,
            "unexpected_failure"
          ),
        }),
        signOut: vi.fn(),
      },
    } as any);

    const formData = new FormData();
    formData.set("password", "NewPassword123!");
    formData.set("confirmPassword", "NewPassword123!");

    const result = await resetPasswordAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).toBe("Failed to update password");
      expect(result.message).not.toContain("Constraint violation");
    }
  });

  it("loginAction should return CAPTCHA error for captcha_failed", async () => {
    const { AuthApiError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: new AuthApiError(
            "captcha protection: request disallowed",
            400,
            "captcha_failed"
          ),
          data: { user: null },
        }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "Password123!");

    const result = await loginAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CAPTCHA");
      expect(result.message).toContain("refresh");
    }
  });

  it("loginAction should return SERVER for network failures (AuthRetryableFetchError)", async () => {
    const { AuthRetryableFetchError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: new AuthRetryableFetchError("Network error", 0),
          data: { user: null },
        }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "Password123!");

    const result = await loginAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).toContain("Something went wrong");
    }
  });

  it("loginAction should return SERVER for 500-level errors instead of credential error", async () => {
    const { AuthApiError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: new AuthApiError(
            "Internal Server Error: Connection reset by peer",
            500,
            "unexpected_failure"
          ),
          data: { user: null },
        }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "Password123!");

    const result = await loginAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).toBe(
        "Something went wrong. Please try again later."
      );
      expect(result.message).not.toContain("Connection reset");
    }
  });

  it("loginAction should return generic AUTH error for credential failures", async () => {
    const { AuthApiError } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: new AuthApiError(
            "Invalid login credentials",
            400,
            "invalid_credentials"
          ),
          data: { user: null },
        }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "WrongPassword!");

    const result = await loginAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH");
      expect(result.message).toBe("Invalid email or password");
    }
  });
});
