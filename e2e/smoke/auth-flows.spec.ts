/**
 * E2E Tests: Authentication Flows (Smoke)
 *
 * Tests login functionality only.
 * Signup, logout, and protected-route tests are in e2e/full/auth-flows-extended.spec.ts.
 * Password reset email test is in e2e/full/email-and-notifications.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { TEST_USERS } from "../support/constants";

test.describe("Username Account Login", () => {
  test("login with username (no @) redirects to dashboard", async ({
    page,
  }, testInfo) => {
    await page.goto("/login");

    // Type just the username, not the email
    await page.getByLabel("Email").fill("testuser");
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Verify we're logged in
    const isMobile = testInfo.project.name.includes("Mobile");
    if (isMobile) {
      await expect(page.getByTestId("mobile-header")).toBeVisible();
    } else {
      await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
    }
  });
});

test.describe("Authentication Smoke", () => {
  test("password toggle switches input type on login page", async ({
    page,
  }) => {
    await page.goto("/login");

    const passwordInput = page.getByLabel("Password", { exact: true });
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click the show-password toggle button
    await page.getByRole("button", { name: /show password/i }).click();

    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click again to hide (aria-label is now "Hide password")
    await page.getByRole("button", { name: /hide password/i }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("login flow - sign in with existing account", async ({
    page,
  }, testInfo) => {
    // Navigate to login page via header sign-in button (mobile or desktop)
    await page.goto("/");
    const signInLink = page
      .locator('[data-testid="nav-signin"],[data-testid="mobile-nav-signin"]')
      .filter({ visible: true });
    await expect(signInLink).toBeVisible();
    await signInLink.click();

    // Verify we're on the login page (may include ?next= from HeaderSignInButton)
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();

    // Fill out login form
    await page.getByLabel("Email").fill(TEST_USERS.member.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(TEST_USERS.member.password);

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
      await expect(page.getByTestId("mobile-header")).toBeVisible();
    } else {
      await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
    }

    await expect(page.getByTestId("quick-stats")).toBeVisible();
    await expect(page.getByTestId("stat-open-issues-value")).toBeVisible();
  });
});
