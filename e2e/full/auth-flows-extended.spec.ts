/**
 * E2E Tests: Extended Authentication Flows
 *
 * Tests signup, protected routes, logout, and password reset functionality.
 * These are part of the full suite, not the smoke suite.
 */

import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../support/actions.js";
import { seededMember } from "../support/constants.js";
import { submitFormAndWaitForRedirect } from "../support/page-helpers.js";
import { getPasswordResetLink } from "../support/mailpit.js";

// Removed local signOut helper in favor of shared action

test.describe("Extended Authentication", () => {
  test("signup flow - create new account and access dashboard", async ({
    page,
  }, testInfo) => {
    // Navigate to signup page via visible sign-up button (mobile or desktop header)
    await page.goto("/");
    const signupBtn = page
      .locator('[data-testid="nav-signup"],[data-testid="mobile-nav-signup"]')
      .filter({ visible: true });
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
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm Password").fill(password);
    await page.getByLabel(/terms of service/i).check();

    // Submit form
    await page.getByRole("button", { name: "Create Account" }).click();

    // Local env has enable_confirmations = false, so we are redirected to dashboard immediately
    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

    // Verify dashboard content (quick stats present)
    await expect(page.getByTestId("quick-stats")).toBeVisible();
    await expect(page.getByTestId("stat-open-issues-value")).toBeVisible();
  });

  test("protected route - redirect to login when not authenticated", async ({
    page,
  }) => {
    // Try to access protected page (settings) without being logged in
    await page.goto("/settings");

    // Should redirect to login page with next parameter
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/next=%2Fsettings/);
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  test("protected route redirect - login and redirect to original destination", async ({
    page,
  }) => {
    // Try to access protected page (settings) without being logged in
    await page.goto("/settings");

    // Should redirect to login page with next parameter
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/next=%2Fsettings/);

    // Fill out login form with seeded test user
    const testEmail = seededMember.email;
    const testPassword = seededMember.password;

    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password", { exact: true }).fill(testPassword);

    // Submit form and wait for redirect
    await submitFormAndWaitForRedirect(
      page,
      page.getByRole("button", { name: "Sign In" }),
      { awayFrom: "/login?next=%2Fsettings" }
    );

    // Should redirect back to original destination (settings) after successful login
    await expect(page).toHaveURL("/settings", { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true })
    ).toBeVisible();
  });

  test("logout flow - sign out and verify redirect", async ({
    page,
  }, testInfo) => {
    // Login first using helper
    await loginAs(page, testInfo, seededMember);

    // Wait for dashboard to load
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByTestId("quick-stats")).toBeVisible();

    // Sign out via header
    await logout(page);

    // Verify we're logged out (sign-in button visible in mobile or desktop header)
    const signIn = page
      .locator('[data-testid="nav-signin"],[data-testid="mobile-nav-signin"]')
      .filter({ visible: true });
    await expect(signIn).toBeVisible();
  });

  test("password reset flow - user journey only", async ({ page }) => {
    test.setTimeout(40000);
    const testEmail = `reset-e2e-extended-${Date.now()}@example.com`;
    const oldPassword = "OldPassword123!";
    const newPassword = "NewPassword456!";

    // Create account
    await page.goto("/signup");
    await page.getByLabel("First Name").fill("Password Reset");
    await page.getByLabel("Last Name").fill("Test");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password", { exact: true }).fill(oldPassword);
    await page.getByLabel("Confirm Password").fill(oldPassword);
    await page.getByLabel(/terms of service/i).check();
    await page.getByRole("button", { name: "Create Account" }).click();

    // Local env has enable_confirmations = false, so we are redirected to dashboard immediately
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Sign out to start reset journey
    await logout(page);

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

    // The action redirects to /login after successful password update
    await expect(page).toHaveURL("/login", { timeout: 15000 });

    // Safari ITP fix: Wait for page to fully load and stabilize after redirect
    // This ensures cookies are properly cleared and the form is ready
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

    // Now log in with the new password
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByTestId("quick-stats")).toBeVisible();

    // Cleanup
    await logout(page);
  });
});
