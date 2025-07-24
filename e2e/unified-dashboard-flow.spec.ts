import { test, expect } from "@playwright/test";

test.describe("Unified Dashboard Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Start each test from a clean state
    await page.goto("/");

    // Clear any existing sessions
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test("should load public dashboard without authentication", async ({
    page,
  }) => {
    // Verify public content is visible immediately
    await expect(page).toHaveTitle(/PinPoint/);

    // Should see organization name and information
    await expect(page.locator("h1")).toContainText("Austin Pinball Collective");

    // Should see locations and machine counts
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=locations •")).toBeVisible();
    await expect(page.locator("text=pinball machines")).toBeVisible();

    // Should see navigation with sign in option
    await expect(
      page
        .locator("text=Sign In")
        .or(page.locator("button:has-text('Sign In')")),
    ).toBeVisible();

    // Should NOT see authenticated content yet
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
    await expect(page.locator("text=My Open Issues")).not.toBeVisible();
  });

  test("should show enhanced content after login", async ({ page }) => {
    // Start with public content verification
    await expect(page.locator("text=Our Locations")).toBeVisible();

    // Login via dev quick login
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();

    // Wait for authentication to complete
    await page.waitForTimeout(3000);

    // Should still see public content
    await expect(page.locator("text=Our Locations")).toBeVisible();

    // Should now ALSO see authenticated content
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    await expect(page.locator("text=My Open Issues")).toBeVisible();

    // Should see authenticated navigation
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).toBeVisible();
    await expect(page.locator("text=Issues")).toBeVisible();
    await expect(page.locator("text=Games")).toBeVisible();

    // Should NOT see sign in button anymore
    await expect(page.locator("text=Sign In")).not.toBeVisible();
  });

  test("should return to public-only content after logout", async ({
    page,
  }) => {
    // First, log in to get authenticated state
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(3000);

    // Verify authenticated content is present
    await expect(page.locator("text=My Dashboard")).toBeVisible();

    // Perform logout
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();

    // Wait for logout to complete and redirect
    await page.waitForTimeout(3000);

    // Should be back on homepage
    await expect(page).toHaveURL(/\/$/);

    // Should see public content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=Austin Pinball Collective")).toBeVisible();

    // Should NOT see authenticated content
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
    await expect(page.locator("text=My Open Issues")).not.toBeVisible();

    // Should see sign in option again
    await expect(
      page
        .locator("text=Sign In")
        .or(page.locator("button:has-text('Sign In')")),
    ).toBeVisible();

    // Should NOT see user account button
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).not.toBeVisible();
  });

  test("should support switching between different user types", async ({
    page,
  }) => {
    // Start with admin login
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(3000);

    // Verify admin authenticated content
    await expect(page.locator("text=My Dashboard")).toBeVisible();

    // Logout
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();
    await page.waitForTimeout(3000);

    // Verify back to public content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();

    // Login as different user (Member)
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Member")').click();
    await page.waitForTimeout(3000);

    // Should see authenticated content for member
    await expect(page.locator("text=My Dashboard")).toBeVisible();

    // Should still see public content too
    await expect(page.locator("text=Our Locations")).toBeVisible();

    // Test another user switch - logout and login as Player
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();
    await page.waitForTimeout(3000);

    // Login as Player
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Player")').click();
    await page.waitForTimeout(3000);

    // Should see appropriate content for player
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    await expect(page.locator("text=Our Locations")).toBeVisible();
  });

  test("should handle session persistence across page reloads", async ({
    page,
  }) => {
    // Login first
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(3000);

    // Verify authenticated state
    await expect(page.locator("text=My Dashboard")).toBeVisible();

    // Reload the page
    await page.reload();
    await page.waitForTimeout(3000);

    // Should maintain authenticated state
    await expect(page.locator("text=My Dashboard")).toBeVisible();
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).toBeVisible();
  });

  test("should navigate correctly between authenticated and public areas", async ({
    page,
  }) => {
    // Start from public state
    await expect(page.locator("text=Our Locations")).toBeVisible();

    // Login
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(3000);

    // Navigate via PinPoint logo (should stay on homepage with unified dashboard)
    await page.locator('text="PinPoint"').click();
    await page.waitForTimeout(1000);

    // Should see both public and authenticated content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=My Dashboard")).toBeVisible();

    // Test logout from any page
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();
    await page.waitForTimeout(3000);

    // Should be back to public-only content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
  });

  test("should display correct user information when authenticated", async ({
    page,
  }) => {
    // Login as admin
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(3000);

    // Open user menu
    await page.locator('button[aria-label="account of current user"]').click();

    // Should see logout option
    await expect(page.locator('text="Logout"')).toBeVisible();
  });

  test("should work correctly on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Test public content is responsive
    await expect(page.locator("text=Our Locations")).toBeVisible();

    // Test login flow on mobile
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();
    await page.waitForTimeout(3000);

    // Should see authenticated content on mobile
    await expect(page.locator("text=My Dashboard")).toBeVisible();

    // Test logout on mobile
    await page.locator('button[aria-label="account of current user"]').click();
    await page.locator('text="Logout"').click();
    await page.waitForTimeout(3000);

    // Should return to public content
    await expect(page.locator("text=Our Locations")).toBeVisible();
    await expect(page.locator("text=My Dashboard")).not.toBeVisible();
  });

  test("should handle dev login widget visibility", async ({ page }) => {
    // Dev login should be visible in development environment
    await expect(page.locator('text="Dev Quick Login"')).toBeVisible();

    // Click to expand
    await page.locator('text="Dev Quick Login"').click();

    // Should see all test user options
    await expect(page.locator('button:has-text("Test Admin")')).toBeVisible();
    await expect(page.locator('button:has-text("Test Member")')).toBeVisible();
    await expect(page.locator('button:has-text("Test Player")')).toBeVisible();
  });
});
