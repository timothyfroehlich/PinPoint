import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Integration tests for authentication actions
 *
 * These tests validate auth actions against a real Supabase instance.
 * Requires Supabase to be running (supabase start).
 *
 * Note: Validation schemas are covered by unit tests; this file focuses on
 * Supabase behavior (auth flows) against a real instance.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase env vars for integration tests");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

describe("Authentication Integration Tests", () => {
  beforeAll(() => {
    // Ensure we're in a test environment (Supabase may return 127.0.0.1 or localhost)
    expect(supabaseUrl).toMatch(/127\.0\.0\.1|localhost/);
  });

  describe("Signup flow", () => {
    it("should create a new user with Supabase", async () => {
      const testEmail = `test-${Date.now()}@example.com`;

      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: "TestPassword123",
        options: {
          data: {
            name: "Integration Test User",
          },
        },
      });

      if (data.user) {
        const { error: confirmError } =
          await adminSupabase.auth.admin.updateUserById(data.user.id, {
            email_confirm: true,
          });
        if (confirmError) throw confirmError;
      }

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe(testEmail);

      // Cleanup
      if (data.user) {
        await supabase.auth.admin.deleteUser(data.user.id);
      }
    });

    it("should reject duplicate email", async () => {
      const testEmail = `duplicate-${Date.now()}@example.com`;

      // Create first user
      const { data: firstData } = await supabase.auth.signUp({
        email: testEmail,
        password: "TestPassword123",
        options: {
          data: {
            name: "First User",
          },
        },
      });

      // Try to create second user with same email
      const { error: duplicateError } = await supabase.auth.signUp({
        email: testEmail,
        password: "DifferentPassword456",
        options: {
          data: {
            name: "Second User",
          },
        },
      });

      expect(duplicateError).toBeDefined();
      // Supabase might return "already registered" or a rate limit message
      const msg = duplicateError?.message ?? "";
      const isDuplicate =
        msg.includes("already registered") || msg.includes("security purposes");
      expect(isDuplicate).toBe(true);

      // Cleanup
      if (firstData.user) {
        await supabase.auth.admin.deleteUser(firstData.user.id);
      }
    });
  });

  describe("Login flow", () => {
    it("should authenticate existing user", async () => {
      const testEmail = `login-test-${Date.now()}@example.com`;

      // Create user first
      const { data: signupData } = await supabase.auth.signUp({
        email: testEmail,
        password: "TestPassword123",
        options: {
          data: {
            name: "Login Test User",
          },
        },
      });

      if (signupData.user) {
        const { error: confirmError } =
          await adminSupabase.auth.admin.updateUserById(signupData.user.id, {
            email_confirm: true,
          });
        if (confirmError) throw confirmError;
      }

      expect(signupData.user).toBeDefined();

      // Now try to log in
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: testEmail,
          password: "TestPassword123",
        });

      expect(loginError).toBeNull();
      expect(loginData.user).toBeDefined();
      expect(loginData.user?.email).toBe(testEmail);

      // Cleanup
      if (signupData.user) {
        await supabase.auth.admin.deleteUser(signupData.user.id);
      }
    });

    it("should reject wrong password", async () => {
      const testEmail = `wrong-pass-${Date.now()}@example.com`;

      // Create user
      const { data: signupData } = await supabase.auth.signUp({
        email: testEmail,
        password: "CorrectPassword123",
        options: {
          data: {
            name: "Wrong Password Test",
          },
        },
      });

      if (signupData.user) {
        await adminSupabase.auth.admin.updateUserById(signupData.user.id, {
          email_confirm: true,
        });
      }

      // Try to log in with wrong password
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: "WrongPassword456",
      });

      expect(loginError).toBeDefined();
      expect(loginError?.message).toContain("Invalid");

      // Cleanup
      if (signupData.user) {
        await supabase.auth.admin.deleteUser(signupData.user.id);
      }
    });

    it("should reject non-existent email", async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: "nonexistent@example.com",
        password: "AnyPassword123",
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid");
    });
  });

  describe("Logout flow", () => {
    it("should sign out authenticated user", async () => {
      const testEmail = `logout-test-${Date.now()}@example.com`;

      // Create and login user
      const { data: signupData } = await supabase.auth.signUp({
        email: testEmail,
        password: "TestPassword123",
        options: {
          data: {
            name: "Logout Test User",
          },
        },
      });

      if (signupData.user) {
        await adminSupabase.auth.admin.updateUserById(signupData.user.id, {
          email_confirm: true,
        });
      }

      const { data: loginData } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: "TestPassword123",
      });

      expect(loginData.user).toBeDefined();

      // Sign out
      const { error: signOutError } = await supabase.auth.signOut();
      expect(signOutError).toBeNull();

      // Verify user is signed out
      const {
        data: { user },
      } = await supabase.auth.getUser();
      expect(user).toBeNull();

      // Cleanup (may need admin client since we're signed out)
      if (loginData.user) {
        await supabase.auth.admin.deleteUser(loginData.user.id);
      }
    });
  });
});
