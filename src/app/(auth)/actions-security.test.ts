import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forgotPasswordAction, loginAction, signupAction, resetPasswordAction } from "./actions";

// Mock Next.js server modules
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
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

// Mock Rate Limiting
vi.mock("~/lib/rate-limit", () => ({
  checkLoginIpLimit: vi.fn(() => Promise.resolve({ success: true, reset: 0 })),
  checkLoginAccountLimit: vi.fn(() => Promise.resolve({ success: true, reset: 0 })),
  checkSignupLimit: vi.fn(() => Promise.resolve({ success: true, reset: 0 })),
  checkForgotPasswordLimit: vi.fn(() => Promise.resolve({ success: true, reset: 0 })),
  getClientIp: vi.fn(() => Promise.resolve("127.0.0.1")),
  formatResetTime: vi.fn(() => "1 minute"),
}));

import { createClient } from "~/lib/supabase/server";

interface MockSupabaseClient {
  auth: {
    signInWithPassword: ReturnType<typeof vi.fn>;
    signUp: ReturnType<typeof vi.fn>;
    resetPasswordForEmail: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
}

const createMockSupabase = (): MockSupabaseClient => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getUser: vi.fn(),
    signOut: vi.fn(),
  },
});

const mockCreateClient = (client: MockSupabaseClient): void => {
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>
  );
};

describe("Auth Actions Security - Error Sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("loginAction", () => {
    it("should return generic error message on authentication failure", async () => {
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" },
      } as any);
      mockCreateClient(mockSupabase);

      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "wrongpassword");

      const result = await loginAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("AUTH");
        expect(result.message).toBe("Invalid email or password");
        // Ensure raw Supabase error is NOT returned
        expect(result.message).not.toContain("credentials");
      }
    });

    it("should return generic error message on unexpected error", async () => {
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Database connection failed" },
      } as any);
      mockCreateClient(mockSupabase);

      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "password");

      const result = await loginAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("AUTH");
        expect(result.message).toBe("Invalid email or password");
        expect(result.message).not.toContain("Database");
      }
    });
  });

  describe("signupAction", () => {
    it("should return generic error message on server error", async () => {
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Some internal database error" },
      } as any);
      mockCreateClient(mockSupabase);

      const formData = new FormData();
      formData.set("firstName", "John");
      formData.set("lastName", "Doe");
      formData.set("email", "test@example.com");
      formData.set("password", "Password123!");
      formData.set("confirmPassword", "Password123!");

      const result = await signupAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("An unexpected error occurred");
        expect(result.message).not.toContain("database");
      }
    });

    it("should sanitize 'already registered' error", async () => {
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "User already registered" },
      } as any);
      mockCreateClient(mockSupabase);

      const formData = new FormData();
      formData.set("firstName", "John");
      formData.set("lastName", "Doe");
      formData.set("email", "taken@example.com");
      formData.set("password", "Password123!");
      formData.set("confirmPassword", "Password123!");

      const result = await signupAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("EMAIL_TAKEN");
        expect(result.message).toBe("Email already registered");
        // Even if the raw message was safe, we want to ensure we control the output
      }
    });
  });

  describe("forgotPasswordAction", () => {
    it("should return generic error message on failure", async () => {
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        error: { message: "Rate limit exceeded from upstream" },
      } as any);
      mockCreateClient(mockSupabase);

      const formData = new FormData();
      formData.set("email", "test@example.com");

      const result = await forgotPasswordAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("An unexpected error occurred");
        expect(result.message).not.toContain("Rate limit");
      }
    });
  });

  describe("resetPasswordAction", () => {
    it("should return generic error message on update failure", async () => {
      const mockSupabase = createMockSupabase();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      } as any);
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Password too weak (internal detail)" },
      } as any);
      mockCreateClient(mockSupabase);

      const formData = new FormData();
      formData.set("password", "Password123!");
      formData.set("confirmPassword", "Password123!");

      const result = await resetPasswordAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("An unexpected error occurred");
        expect(result.message).not.toContain("weak");
      }
    });
  });
});
