/**
 * E2E Tests: Authentication Flows
 *
 * Tests signup, login, protected routes, and logout functionality.
 */

import { test, expect } from "@playwright/test";

import { loginAs } from "../support/actions";
import { seededMember } from "../support/constants";

test.describe("Authentication", () => {
  test("signup flow - create new account and access dashboard", async ({
    page,
  }) => {
    // Navigate to signup page
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: "Sign Up" }).click();

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

    // Verify dashboard content
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByText("E2E Test User")
    ).toBeVisible();
    await expect(page.getByRole("main").getByText(testEmail)).toBeVisible();
  });

  test("login flow - sign in with existing account", async ({ page }) => {
    // Use test user created by seed.sql
    const testEmail = seededMember.email;
    const testPassword = seededMember.password;

    // Navigate to login page
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: "Sign In" }).click();

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

    // Verify dashboard content
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByText(seededMember.name)
    ).toBeVisible();
    await expect(page.getByRole("main").getByText(testEmail)).toBeVisible();
  });

  test("login flow - reject invalid credentials", async ({ page }) => {
    // Navigate to login page
    await page.goto("/login");

    // Fill out login form with wrong password
    await page.getByLabel("Email").fill(seededMember.email);
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
    await loginAs(page);

    // Click sign out button
    await page.getByRole("button", { name: "Sign Out" }).click();

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

    const strengthLabel = page.getByTestId("password-strength-label");
    await expect(strengthLabel).toBeVisible();
    await expect(strengthLabel).toHaveText(/Too weak|Weak|Fair|Good|Strong/);
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
    await loginAs(page);

    // Refresh the page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByText(seededMember.name)
    ).toBeVisible();
  });
});
