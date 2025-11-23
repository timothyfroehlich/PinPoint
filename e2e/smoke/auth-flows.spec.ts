/**
 * E2E Tests: Authentication Flows
 *
 * Tests signup, login, protected routes, logout, and password reset functionality.
 */

import { test, expect } from "@playwright/test";
import { getPasswordResetLink, deleteAllMessages } from "../support/mailpit";

test.describe("Authentication", () => {
  test("signup flow - create new account and access dashboard", async ({
    page,
  }) => {
    // Navigate to signup page
    await page.goto("/");
    await page.getByTestId("hero-signup").click();

    // Verify we're on the signup page
    await expect(page).toHaveURL("/signup");
    await expect(
      page.getByRole("heading", { name: "Create Account" })
    ).toBeVisible();

    // Fill out signup form
    const timestamp = Date.now();
    const testEmail = `e2e-test-${timestamp}@example.com`;

    await page.getByLabel("Name").fill("E2E Test User");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill("TestPassword123");

    // Submit form
    await page.getByRole("button", { name: "Create Account" }).click();

    // Should redirect to dashboard after successful signup
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Verify dashboard content (quick stats present)
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByTestId("quick-stats")).toBeVisible();
    await expect(page.getByTestId("stat-open-issues-value")).toBeVisible();
  });

  test("login flow - sign in with existing account", async ({ page }) => {
    // Use test user created by seed.sql
    const testEmail = "member@test.com";
    const testPassword = "TestPassword123";

    // Navigate to login page
    await page.goto("/");
    await page.getByTestId("hero-signin").click();

    // Verify we're on the login page
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

    // Fill out login form
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(testPassword);

    // Verify "Remember Me" checkbox is checked by default
    const rememberMeCheckbox = page.getByLabel(/Remember me/i);
    await expect(rememberMeCheckbox).toBeChecked();

    // Submit form
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should redirect to dashboard after successful login
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Verify dashboard content (quick stats present)
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByTestId("quick-stats")).toBeVisible();
    await expect(page.getByTestId("stat-open-issues-value")).toBeVisible();
  });

  test("protected route - redirect to login when not authenticated", async ({
    page,
  }) => {
    // Try to access dashboard without being logged in
    await page.goto("/dashboard");

    // Should redirect to login page
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  test("logout flow - sign out and verify redirect", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for dashboard to load
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();

    // Open user menu and click sign out
    await page.getByTestId("user-menu-button").click();
    await page
      .getByRole("menuitem", { name: "Sign Out" })
      .waitFor({ state: "visible" });
    await page.getByRole("menuitem", { name: "Sign Out" }).click();

    // Should redirect to home page
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "PinPoint" })).toBeVisible();

    // Verify we're logged out by trying to access dashboard
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });

  test("password reset flow - user journey only", async ({ page }) => {
    test.setTimeout(40000);
    const testEmail = `reset-e2e-${Date.now()}@example.com`;
    const oldPassword = "OldPassword123!";
    const newPassword = "NewPassword456!";

    await deleteAllMessages(testEmail);

    // Create account
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Password Reset Test");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(oldPassword);
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Sign out to start reset journey
    await page.getByTestId("user-menu-button").click();
    await page.getByRole("menuitem", { name: "Sign Out" }).click();
    await expect(page).toHaveURL("/");

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
    await page.goto(resetLink!, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/reset-password/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Set New Password" })
    ).toBeVisible();

    // Set new password and submit
    await page.getByLabel("New Password").fill(newPassword);
    await page.getByLabel("Confirm Password").fill(newPassword);
    await page.getByRole("button", { name: "Update Password" }).click();

    // Log in with new password (handle being auto-signed-in from reset flow)
    await page.goto("/login");
    if (await page.getByRole("heading", { name: "Dashboard" }).isVisible()) {
      await page.getByTestId("user-menu-button").click();
      await page.getByRole("menuitem", { name: "Sign Out" }).click();
      await page.goto("/login");
    }

    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();

    // Cleanup
    await page.getByTestId("user-menu-button").click();
    await page.getByRole("menuitem", { name: "Sign Out" }).click();
    await deleteAllMessages(testEmail);
  });
});
