import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Integration tests for auth page redirect logic
 *
 * These tests validate the auth state checks that Server Components use
 * to decide whether to redirect authenticated users to the dashboard.
 *
 * Note: We test the auth state logic, not the Server Component rendering.
 * The actual redirect behavior is tested in E2E tests.
 *
 * Requires Supabase to be running (supabase start).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase env vars for integration tests");
}

const supabase = createClient(supabaseUrl, supabaseKey);

describe("Auth Pages - Server Component Auth Logic", () => {
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
  });

  describe("ForgotPasswordPage auth redirect logic", () => {
    it("should detect authenticated user who should be redirected to dashboard", async () => {
      // Create and sign in a test user
      const testEmail = `auth-page-test-${Date.now()}@example.com`;
      const { data: signupData } = await supabase.auth.signUp({
        email: testEmail,
        password: "TestPassword123",
        options: {
          data: {
            name: "Auth Page Test User",
          },
        },
      });

      expect(signupData.user).toBeDefined();
      testUserId = signupData.user?.id ?? null;

      // Sign in the user
      const { data: loginData } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: "TestPassword123",
      });

      expect(loginData.user).toBeDefined();

      // This is the auth check that ForgotPasswordPage does
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // When user is authenticated, page should redirect to dashboard
      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUserId);
      // In the actual Server Component, this would trigger: redirect("/dashboard")
    });

    it("should detect unauthenticated user who should see the form", async () => {
      // Ensure no user is signed in
      await supabase.auth.signOut();

      // This is the auth check that ForgotPasswordPage does
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // When user is not authenticated, page should show the form
      expect(user).toBeNull();
      // In the actual Server Component, this means no redirect happens
    });
  });

  describe("ResetPasswordPage auth redirect logic", () => {
    it("should detect authenticated user (via reset link) who should see the form", async () => {
      // Create and sign in a test user
      const testEmail = `reset-page-test-${Date.now()}@example.com`;
      const { data: signupData } = await supabase.auth.signUp({
        email: testEmail,
        password: "TestPassword123",
        options: {
          data: {
            name: "Reset Page Test User",
          },
        },
      });

      expect(signupData.user).toBeDefined();
      testUserId = signupData.user?.id ?? null;

      // Sign in the user (simulates being authenticated via reset link)
      const { data: loginData } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: "TestPassword123",
      });

      expect(loginData.user).toBeDefined();

      // This is the auth check that ResetPasswordPage does
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // When user is authenticated (via reset link), page should show the form
      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUserId);
      // In the actual Server Component, this means no redirect to /forgot-password
    });

    it("should detect unauthenticated user who should be redirected to forgot-password", async () => {
      // Ensure no user is signed in
      await supabase.auth.signOut();

      // This is the auth check that ResetPasswordPage does
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // When user is not authenticated, page should redirect to /forgot-password
      expect(user).toBeNull();
      // In the actual Server Component, this would trigger: redirect("/forgot-password")
    });
  });
});
