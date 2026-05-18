/**
 * E2E Tests: Authentication Flows (Smoke)
 *
 * Tests login, protected-route redirect, and logout functionality.
 * Signup is covered by auth-actions.test.ts (integration).
 * Password reset email test is in e2e/full/email-and-notifications.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../support/actions.js";
import { TEST_USERS } from "../support/constants";

test.describe("Username Account Login", () => {
  test("login with username (no @) redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");

    // Type just the username, not the email
    await page.getByLabel("Email").fill("testuser");
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Verify we're logged in — AppHeader is always visible
    await expect(page.getByTestId("app-header")).toBeVisible();
  });
});

test.describe("Authentication Smoke", () => {
  test("login flow - sign in with existing account", async ({ page }) => {
    // Navigate to login page via header sign-in button (unified AppHeader)
    await page.goto("/");
    const signInLink = page.getByTestId("nav-signin");
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

    // Verify dashboard content — AppHeader is always visible
    await expect(page.getByTestId("app-header")).toBeVisible();

    await expect(page.getByTestId("quick-stats")).toBeVisible();
    await expect(page.getByTestId("stat-open-issues-value")).toBeVisible();
  });

  test("protected route redirect - login with ?next= and land on original destination", async ({
    page,
  }) => {
    // Visit a protected page without auth — middleware appends ?next=
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/next=%2Fsettings/);

    // Log in using the seeded member account
    await page.getByLabel("Email").fill(TEST_USERS.member.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(TEST_USERS.member.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should land on the originally requested page, not /dashboard
    await expect(page).toHaveURL("/settings", { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true })
    ).toBeVisible();
  });

  test("logout flow - sign out and verify unauthenticated state", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, TEST_USERS.member);
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByTestId("quick-stats")).toBeVisible();

    await logout(page, testInfo);

    // Header should show sign-in button, confirming session is cleared
    await expect(page.getByTestId("nav-signin")).toBeVisible();
  });
});
