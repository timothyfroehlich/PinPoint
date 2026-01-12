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
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          error: { message: "Database connection failed: 5432" },
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

    const result = await signupAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).toBe("An unexpected error occurred during signup"); // Generic message
      expect(result.message).not.toContain("Database connection failed"); // No leak
    }
  });

  it("signupAction should return specific error for duplicate email", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          error: { message: "User already registered" },
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

    const result = await signupAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EMAIL_TAKEN");
      expect(result.message).toBe("This email is already registered");
    }
  });

  it("forgotPasswordAction should return generic error message on server error", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        resetPasswordForEmail: vi
          .fn()
          .mockResolvedValue({ error: { message: "SMTP connection timeout" } }),
      },
    } as any);

    const formData = new FormData();
    formData.set("email", "test@example.com");

    const result = await forgotPasswordAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
      expect(result.message).toBe("Failed to send password reset email"); // Generic message
      expect(result.message).not.toContain("SMTP"); // No leak
    }
  });

  it("resetPasswordAction should return generic error message on server error", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
        updateUser: vi.fn().mockResolvedValue({
          error: { message: "Constraint violation: password_history" },
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
      expect(result.message).toBe("Failed to update password"); // Generic message
      expect(result.message).not.toContain("Constraint violation"); // No leak
    }
  });

  it("loginAction should return generic error message on server error", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: "Internal Server Error: Connection reset by peer" },
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
      expect(result.code).toBe("AUTH");
      expect(result.message).toBe("Invalid email or password"); // Sanitized message
      expect(result.message).not.toContain("Connection reset"); // No leak
    }
  });
});
