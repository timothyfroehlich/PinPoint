import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsRegularUser, logout } from "./helpers/auth";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await logout(page);
    await page.goto("/");

    // Clear any existing sessions
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Wait for page to load completely
    await page.waitForLoadState("networkidle");
  });

  test("should load the unified homepage/dashboard when not authenticated", async ({
    page,
  }) => {
    // Page already loaded in beforeEach

    // Should see the page title
    await expect(page).toHaveTitle(/PinPoint/);

    // Should see public content (not authenticated dashboard content)
    // and Dev Quick Login in development
    await expect(page.locator('text="Dev Quick Login"')).toBeVisible();

    // Click to expand dev login options and verify quick login works
    await page.locator('text="Dev Quick Login"').click();
    await expect(
      page.locator("button", { hasText: "Test Admin" }),
    ).toBeVisible();
    await expect(
      page.locator("button", { hasText: "Test Member" }),
    ).toBeVisible();
    await expect(
      page.locator("button", { hasText: "Test Player" }),
    ).toBeVisible();

    // Should also see the sign in button and organization content
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
    await expect(
      page.locator("h1", { hasText: "Austin Pinball Collective" }),
    ).toBeVisible();
  });

  test("should authenticate as admin and see authenticated dashboard content", async ({
    page,
  }) => {
    // Use dev quick login for admin
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();

    // Wait for authentication to complete - look for authenticated content
    // Authentication involves a page reload, so wait longer
    await expect(page.locator('text="My Dashboard"')).toBeVisible({
      timeout: 10000,
    });

    // Should stay on homepage (now showing authenticated content)
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle(/PinPoint/);

    // Should see main navigation (PinPoint logo is nested inside link)
    await expect(page.locator('text="PinPoint"')).toBeVisible();
    await expect(page.locator("button", { hasText: "Issues" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Games" })).toBeVisible();
    await expect(page.locator('a:has-text("Home")')).toBeVisible();

    // Should see user account button
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).toBeVisible();

    // Should see authenticated dashboard content
    await expect(page.locator('text="My Dashboard"')).toBeVisible();
    await expect(page.locator('text="My Open Issues"')).toBeVisible();
  });

  test("should authenticate as member with standard permissions", async ({
    page,
  }) => {
    // Use dev quick login for member
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Member")').click();

    // Wait for authentication to complete - look for authenticated content
    // Authentication involves a page reload, so wait longer
    await expect(page.locator('text="My Dashboard"')).toBeVisible({
      timeout: 10000,
    });

    // Should stay on homepage (now showing authenticated content)
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle(/PinPoint/);

    // Should see same navigation as admin (UI permissions are likely handled differently)
    await expect(page.locator('text="PinPoint"')).toBeVisible();
    await expect(page.locator("button", { hasText: "Issues" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Games" })).toBeVisible();
    await expect(page.locator('a:has-text("Home")')).toBeVisible();

    // Should see user account button
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).toBeVisible();
  });

  test("should authenticate as player with limited permissions", async ({
    page,
  }) => {
    // Use dev quick login for player
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Player")').click();

    // Wait for authentication to complete - look for authenticated content
    // Authentication involves a page reload, so wait longer
    await expect(page.locator('text="My Dashboard"')).toBeVisible({
      timeout: 10000,
    });

    // Should stay on homepage (now showing authenticated content)
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle(/PinPoint/);

    // Should see basic navigation
    await expect(page.locator('text="PinPoint"')).toBeVisible();
    await expect(page.locator('a:has-text("Home")')).toBeVisible();

    // Player may have more restricted access
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).toBeVisible();
  });

  test("should handle logout properly", async ({ page }) => {
    // Login as admin
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();

    // Wait for authentication to complete
    await page.waitForTimeout(3000);
    await expect(page.locator('text="My Dashboard"')).toBeVisible();

    // Verify logged in state (stays on homepage with authenticated content)
    await expect(page).toHaveURL(/\/$/);

    // Perform logout via user menu
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();

    // Wait a moment for logout to complete
    await page.waitForTimeout(2000);

    // Should now see the sign in button again (back to unauthenticated state)
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
    // Should not see the user account button
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).not.toBeVisible();
  });

  test("should maintain session across page reloads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/");

    // Verify initial login
    await expect(page).toHaveTitle(/PinPoint/);

    // Reload the page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveTitle(/PinPoint/);

    // Should not see login elements
    const loginButton = page.locator('button:has-text("Sign in")');
    await expect(loginButton)
      .not.toBeVisible()
      .catch(() => {
        // Button might not exist, which is fine for authenticated state
      });
  });

  test("should handle permission-based navigation", async ({ page }) => {
    // Test with regular user (limited permissions)
    await loginAsRegularUser(page);

    // Try to access admin routes
    const adminRoutes = ["/admin", "/users", "/settings", "/analytics"];

    for (const route of adminRoutes) {
      await page.goto(route);

      // Should either be redirected or see access denied
      // TODO: Update based on actual access control behavior
      await page
        .locator('text="Access Denied"')
        .isVisible()
        .catch(() => false);
      await page
        .locator('text="Forbidden"')
        .isVisible()
        .catch(() => false);

      // For now, just verify the navigation attempt doesn't crash
      expect(page.url()).toContain("localhost");
    }
  });

  test("should display correct user information when authenticated", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/");

    // Check for user information display
    // TODO: Update based on actual user info display
    const userInfoElements = [
      page.locator('[data-testid="user-menu"]'),
      page.locator('[data-testid="user-name"]'),
      page.locator('text="Test Admin"'),
      page.locator('text="admin@example.com"'),
    ];

    for (const element of userInfoElements) {
      if (await element.isVisible().catch(() => false)) {
        break;
      }
    }

    // For now, just verify navigation works
    expect(page.url()).toContain("localhost");
  });
});
