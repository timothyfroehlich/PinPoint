/**
 * E2E Tests: Extended Authentication Flows
 *
 * Tests signup, protected routes, logout, and password reset functionality.
 * These are part of the full suite, not the smoke suite.
 */

import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../support/actions.js";
import { seededMember } from "../support/constants.js";
import { getPasswordResetLink, deleteAllMessages } from "../support/mailpit.js";
import { confirmUserEmail } from "../support/supabase-admin.js";

// Removed local signOut helper in favor of shared action

test.describe("Extended Authentication", () => {
  test("signup flow - create new account and access dashboard", async ({
    page,
  }) => {
    // Navigate to signup page
    await page.goto("/");
    const signupBtn = page.getByTestId("nav-signup");
    await expect(signupBtn).toBeVisible({ timeout: 5000 });
    await signupBtn.click();

    // Verify we're on the signup page
    await expect(page).toHaveURL(/\/signup/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Create Account" })
    ).toBeVisible();

    // Fill out signup form
    const timestamp = Date.now();
    const testEmail = `e2e-test-extended-${timestamp}@example.com`;
    const password = "TestPassword123";

    await page.getByLabel("First Name").fill("E2E Test");
    await page.getByLabel("Last Name").fill("User");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(password);

    // Submit form
    await page.getByRole("button", { name: "Create Account" }).click();

    // user is created but shown a confirmation message
    // Verify success message is displayed
    await expect(page.getByText("Check your email")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("We sent a confirmation link")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Login" })).toBeVisible();

    // Now go to login
    await page.getByRole("link", { name: "Go to Login" }).click();
    await expect(page).toHaveURL("/login");

    // Auto-confirm the user's email using admin API
    await confirmUserEmail(testEmail);

    // Now login to establish session
    await loginAs(page, testInfo, { email: testEmail, password });

    // Should redirect to dashboard after successful login
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Verify dashboard content (quick stats present)
    await expect(page.getByTestId("quick-stats")).toBeVisible();
    await expect(page.getByTestId("stat-open-issues-value")).toBeVisible();
  });

  test("protected route - redirect to login when not authenticated", async ({
    page,
  }) => {
    // Try to access protected page (issues) without being logged in
    await page.goto("/issues");
    await page.waitForURL("/login"); // Explicitly wait for the redirect

    // Should redirect to login page
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  test("logout flow - sign out and verify redirect", async ({ page }, testInfo) => {
    // Login first using helper
    await loginAs(page, testInfo, seededMember);

    // Wait for dashboard to load
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByTestId("quick-stats")).toBeVisible();

    // Sign out via header
    await logout(page);

    // Verify we're logged out
    await expect(page.getByTestId("nav-signin")).toBeVisible();
  });

  test("password reset flow - user journey only", async ({ page }) => {
    test.setTimeout(40000);
    const testEmail = `reset-e2e-extended-${Date.now()}@example.com`;
    const oldPassword = "OldPassword123!";
    const newPassword = "NewPassword456!";

    await deleteAllMessages(testEmail);

    // Create account
    await page.goto("/signup");
    await page.getByLabel("First Name").fill("Password Reset");
    await page.getByLabel("Last Name").fill("Test");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(oldPassword);
    await page.getByRole("button", { name: "Create Account" }).click();

    // With email confirmations enabled, wait for confirmation message
    await expect(page.getByText("Check your email")).toBeVisible({
      timeout: 10000,
    });

    // Go to login manually
    await page.goto("/login");

    // Auto-confirm and login
    await confirmUserEmail(testEmail);
    await page.goto("/login");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(oldPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Sign out to start reset journey
    await logout(page);

    await deleteAllMessages(testEmail);

    // Request reset
    await page.goto("/forgot-password");
    await expect(
      page.getByRole("heading", { name: "Reset Password" })
    ).toBeVisible();
    await page.getByLabel("Email").fill(testEmail);
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(
      page.getByText(/you will receive a password reset link/i)
    ).toBeVisible();

    // Follow reset link from email
    const resetLink = await getPasswordResetLink(testEmail);
    expect(resetLink).toBeTruthy();
    await page.goto(resetLink, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/reset-password/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Set New Password" })
    ).toBeVisible();

    // Set new password and submit
    await page.getByLabel("New Password").fill(newPassword);
    await page.getByLabel("Confirm Password").fill(newPassword);
    await page.getByRole("button", { name: "Update Password" }).click();

    // Log in with new password (handle being auto-signed-in from reset flow)
    // Log in with new password (handle being auto-signed-in from reset flow)
    await page.goto("/login");
    // Check if we were redirected to dashboard (meaning we are logged in)
    if (page.url().includes("/dashboard")) {
      await logout(page);
      await page.goto("/login");
    }

    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByTestId("quick-stats")).toBeVisible();

    // Cleanup
    await logout(page);
    await deleteAllMessages(testEmail);
  });
});
