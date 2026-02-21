/**
 * E2E Tests: Authentication Flows (Smoke)
 *
 * Tests login functionality only.
 * Signup, logout, and password reset are in e2e/full/auth-flows-extended.spec.ts.
 */

import { test, expect } from "@playwright/test";

test.describe("Authentication Smoke", () => {
  test("password toggle switches input type on login page", async ({
    page,
  }) => {
    await page.goto("/login");

    const passwordInput = page.getByLabel("Password");
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click the show-password toggle button
    const toggleButton = page.getByRole("button", { name: /show password/i });
    await toggleButton.click();

    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click again to hide
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("login flow - sign in with existing account", async ({
    page,
  }, testInfo) => {
    // Use test user created by seed.sql
    const testEmail = "member@test.com";
    const testPassword = "TestPassword123";

    // Navigate to login page via dashboard header
    await page.goto("/");
    const signInLink = page.getByTestId("nav-signin");
    await expect(signInLink).toBeVisible();
    await signInLink.click();

    // Verify we're on the login page (may include ?next= from HeaderSignInButton)
    await expect(page).toHaveURL(/\/login/);
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

    // Use project name to determine mobile vs desktop layout
    const isMobile = testInfo.project.name.includes("Mobile");

    // Verify dashboard content based on device type
    if (isMobile) {
      await expect(page.getByTestId("mobile-menu-trigger")).toBeVisible();
    } else {
      await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
    }

    await expect(page.getByTestId("quick-stats")).toBeVisible();
    await expect(page.getByTestId("stat-open-issues-value")).toBeVisible();
  });
});
