import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  resetPasswordAction,
  forgotPasswordAction,
} from "~/app/(auth)/actions";

/**
 * Integration tests for auth Server Action error paths
 *
 * These tests validate error handling in auth Server Actions.
 * Requires Supabase to be running (supabase start).
 *
 * Note: Happy paths are tested in E2E tests.
 * These tests focus on error conditions that need integration with Supabase.
 */

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: vi.fn((header: string) => {
      if (header === "host") return "localhost:3000";
      if (header === "x-forwarded-proto") return "http";
      return null;
    }),
  })),
  cookies: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(() => []),
    delete: vi.fn(),
  })),
}));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase env vars for integration tests");
}

const supabase = createClient(supabaseUrl, supabaseKey);

describe("Auth Actions - Error Path Integration Tests", () => {
  let testUserId: string | null = null;

  beforeAll(() => {
    // Ensure we're in a test environment
    expect(supabaseUrl).toMatch(/127\.0\.0\.1|localhost/);
  });

  afterEach(async () => {
    // Clean up test user if created
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
      testUserId = null;
    }
    // Ensure we're signed out
    await supabase.auth.signOut();
    vi.unstubAllEnvs();
  });

  describe("resetPasswordAction - Error Paths", () => {
    it("should return SERVER error when user not authenticated", async () => {
      // Ensure no user is signed in
      await supabase.auth.signOut();

      const formData = new FormData();
      formData.set("password", "NewPassword123!");
      formData.set("confirmPassword", "NewPassword123!");

      const result = await resetPasswordAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Not authenticated");
      }
    });

    it("should return VALIDATION error for password mismatch", async () => {
      const formData = new FormData();
      formData.set("password", "Password123!");
      formData.set("confirmPassword", "DifferentPassword123!");

      const result = await resetPasswordAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });

    it("should return VALIDATION error for weak password", async () => {
      const formData = new FormData();
      formData.set("password", "weak");
      formData.set("confirmPassword", "weak");

      const result = await resetPasswordAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });

    it("should return VALIDATION error for missing password", async () => {
      const formData = new FormData();
      formData.set("confirmPassword", "Password123!");

      const result = await resetPasswordAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });
  });

  describe("forgotPasswordAction - Error Paths", () => {
    beforeEach(() => {
      // Ensure site URL is configured for fail-closed origin validation
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    });

    it("should return VALIDATION error for invalid email format", async () => {
      const formData = new FormData();
      formData.set("email", "not-an-email");

      const result = await forgotPasswordAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });

    it("should return VALIDATION error for missing email", async () => {
      const formData = new FormData();

      const result = await forgotPasswordAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });

    it("should succeed even for non-existent email (prevents enumeration)", async () => {
      const formData = new FormData();
      formData.set("email", "nonexistent-user-12345@example.com");

      const result = await forgotPasswordAction(undefined, formData);

      // Should succeed to prevent email enumeration attacks
      expect(result.ok).toBe(true);
    });
  });
});
