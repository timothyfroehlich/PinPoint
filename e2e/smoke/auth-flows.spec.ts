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

  test("login flow - reject invalid credentials", async ({ page }) => {
    // Navigate to login page
    await page.goto("/login");

    // Fill out login form with wrong password
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("WrongPassword123");

    // Submit form
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should stay on login page and show error
    await expect(page).toHaveURL("/login");
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
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

  test("signup validation - enforce minimum password length", async ({
    page,
  }) => {
    await page.goto("/signup");

    // Try to submit with short password
    await page.getByLabel("Name").fill("Test User");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("short"); // Less than 8 characters

    // Browser validation should prevent submission
    const passwordInput = page.getByLabel("Password");
    await expect(passwordInput).toHaveAttribute("minlength", "8");
  });

  test("password strength indicator - show feedback for weak passwords", async ({
    page,
  }) => {
    await page.goto("/signup");

    // Fill in name and email
    await page.getByLabel("Name").fill("Test User");
    await page.getByLabel("Email").fill("test@example.com");

    // Type a weak password
    await page.getByLabel("Password").fill("password");

    // Wait for password strength indicator to appear
    // (Client component needs time to load zxcvbn and calculate)
    await expect(
      page
        .locator('[class*="password-strength"]')
        .or(page.getByText(/weak|fair|good/i))
    ).toBeVisible({ timeout: 2000 });

    // Should show strength indicator (checking for common weak password feedback)
    const pageContent = await page.content();
    const hasStrengthIndicator =
      pageContent.includes("Too weak") ||
      pageContent.includes("Weak") ||
      pageContent.includes("Fair");

    expect(hasStrengthIndicator).toBe(true);
  });

  test("link navigation - switch between login and signup", async ({
    page,
  }) => {
    // Start on login page
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

    // Click "Sign up" link
    await page.getByRole("link", { name: "Sign up" }).click();

    // Should navigate to signup page
    await expect(page).toHaveURL("/signup");
    await expect(
      page.getByRole("heading", { name: "Create Account" })
    ).toBeVisible();

    // Click "Sign in" link
    await page.getByRole("link", { name: "Sign in" }).click();

    // Should navigate back to login page
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  test("auth state persistence - session survives page refresh", async ({
    page,
  }) => {
    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for dashboard
    await expect(page).toHaveURL("/dashboard");

    // Refresh the page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByTestId("user-menu-name")).toBeVisible();
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

  test("password reset - expired/invalid link shows error", async ({
    page,
  }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveURL("/forgot-password");
    await expect(
      page.getByRole("heading", { name: "Reset Password" })
    ).toBeVisible();
  });

  test("forgot password - validates email format", async ({ page }) => {
    await page.goto("/forgot-password");

    // Try to submit with invalid email
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    // Browser validation should prevent submission
    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("required");
  });
});
