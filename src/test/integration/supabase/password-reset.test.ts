import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { confirmTestUserEmail } from "~/test/helpers/supabase";

/**
 * Integration tests for password reset flow
 *
 * These tests validate password reset actions against a real Supabase instance.
 * Requires Supabase to be running (supabase start).
 *
 * Note: Full E2E flow (including email links) is tested in e2e/smoke/auth-flows.spec.ts
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

describe("Password Reset Integration Tests", () => {
  beforeAll(() => {
    // Ensure we're in a test environment (Supabase may return 127.0.0.1 or localhost)
    expect(supabaseUrl).toMatch(/127\.0\.0\.1|localhost/);
  });

  describe("Forgot password flow", () => {
    it("should send password reset email for existing user", async () => {
      const testEmail = `reset-test-${Date.now()}@example.com`;

      // Create user first
      const { data: signupData } = await supabase.auth.signUp({
        email: testEmail,
        password: "OldPassword123",
        options: {
          data: {
            name: "Reset Test User",
          },
        },
      });

      if (signupData.user) {
        await confirmTestUserEmail(adminSupabase, signupData.user);
      }

      expect(signupData.user).toBeDefined();

      // Request password reset
      const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
        redirectTo: "http://localhost:3000/reset-password",
      });

      expect(error).toBeNull();

      // Cleanup
      if (signupData.user) {
        await supabase.auth.admin.deleteUser(signupData.user.id);
      }
    });

    it("should not reveal if email does not exist", async () => {
      // Request password reset for non-existent email
      const { error } = await supabase.auth.resetPasswordForEmail(
        "nonexistent-user-12345@example.com",
        {
          redirectTo: "http://localhost:3000/reset-password",
        }
      );

      // Supabase doesn't error for non-existent emails (prevents enumeration)
      expect(error).toBeNull();
    });
  });

  describe("Reset password flow", () => {
    it("should update password for authenticated user", async () => {
      const testEmail = `update-pass-${Date.now()}@example.com`;
      const oldPassword = "OldPassword123";
      const newPassword = "NewPassword456";

      // Create and login user
      // Create and login user
      const { data: signupData } = await supabase.auth.signUp({
        email: testEmail,
        password: oldPassword,
        options: {
          data: {
            name: "Update Password Test",
          },
        },
      });

      if (signupData.user) {
        await confirmTestUserEmail(adminSupabase, signupData.user);
      }

      const { data: loginData } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: oldPassword,
      });

      expect(loginData.user).toBeDefined();

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      expect(updateError).toBeNull();

      // Sign out
      await supabase.auth.signOut();

      // Verify can login with new password
      const { data: newLoginData, error: newLoginError } =
        await supabase.auth.signInWithPassword({
          email: testEmail,
          password: newPassword,
        });

      expect(newLoginError).toBeNull();
      expect(newLoginData.user).toBeDefined();
      expect(newLoginData.user?.email).toBe(testEmail);

      // Verify cannot login with old password
      await supabase.auth.signOut();
      const { error: oldPasswordError } =
        await supabase.auth.signInWithPassword({
          email: testEmail,
          password: oldPassword,
        });

      expect(oldPasswordError).toBeDefined();
      expect(oldPasswordError?.message).toContain("Invalid");

      // Cleanup
      if (loginData.user) {
        await supabase.auth.admin.deleteUser(loginData.user.id);
      }
    });

    it("should reject password update when not authenticated", async () => {
      // Ensure we're signed out
      await supabase.auth.signOut();

      // Try to update password without being authenticated
      const { error } = await supabase.auth.updateUser({
        password: "NewPassword123",
      });

      // Should fail because user is not authenticated
      expect(error).toBeDefined();
    });
  });
});
