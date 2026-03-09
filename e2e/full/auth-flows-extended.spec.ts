/**
 * E2E Tests: Extended Authentication Flows
 *
 * Tests signup, protected routes, and logout functionality.
 * Password reset email test is in e2e/full/email-and-notifications.spec.ts.
 * These are part of the full suite, not the smoke suite.
 */

import { test, expect } from "@playwright/test";

import { loginAs, logout } from "../support/actions.js";
import { seededMember } from "../support/constants.js";

test.describe("Extended Authentication", () => {
  test("signup flow - create new account and access dashboard", async ({
    page,
  }, testInfo) => {
    // Navigate to signup page via visible sign-up button (mobile or desktop header)
    await page.goto("/");
    const isMobile = testInfo.project.name.includes("Mobile");
    const signupBtn = isMobile
      ? page.getByTestId("mobile-nav-signup")
      : page.getByTestId("nav-signup");
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

    // Submit form
    await page.getByRole("button", { name: "Sign In" }).click();

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
    await logout(page, testInfo);

    // Verify we're logged out (sign-in button visible in mobile or desktop header)
    const isMobile = testInfo.project.name.includes("Mobile");
    const signIn = isMobile
      ? page.getByTestId("mobile-nav-signin")
      : page.getByTestId("nav-signin");
    await expect(signIn).toBeVisible();
  });
});
