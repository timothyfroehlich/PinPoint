/**
 * E2E Tests: Navigation Component
 *
 * Tests navigation bar behavior for authenticated and unauthenticated states.
 */

import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("unauthenticated navigation - show Sign In and Sign Up buttons", async ({
    page,
  }) => {
    // Navigate to home page
    await page.goto("/");

    // Verify navigation shows PinPoint logo
    await expect(page.getByText("PinPoint").first()).toBeVisible();

    // Verify Sign In and Sign Up buttons are visible
    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: "Sign In" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Sign Up" })).toBeVisible();

    // Verify quick links are NOT visible
    await expect(nav.getByRole("link", { name: /Issues/i })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: /Report/i })).not.toBeVisible();
  });

  test("authenticated navigation - show quick links and user menu", async ({
    page,
  }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for dashboard to load
    await expect(page).toHaveURL("/dashboard");

    // Verify navigation shows PinPoint logo
    const nav = page.locator("nav");
    await expect(nav.getByText("PinPoint").first()).toBeVisible();

    // Verify quick links are visible
    await expect(nav.getByRole("link", { name: /Issues/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Report/i })).toBeVisible();

    // Verify user info is visible (name and email)
    await expect(nav.getByText("Member User")).toBeVisible();
    await expect(nav.getByText("member@test.com")).toBeVisible();

    // Verify Sign In/Sign Up buttons are NOT visible
    await expect(nav.getByRole("link", { name: "Sign In" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Sign Up" })).not.toBeVisible();
  });

  test("quick links navigation - navigate to placeholder pages", async ({
    page,
  }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for dashboard
    await expect(page).toHaveURL("/dashboard");

    const nav = page.locator("nav");

    // Click Issues link
    await nav.getByRole("link", { name: /Issues/i }).click();
    await expect(page).toHaveURL("/issues");
    await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();

    // Click Report Issue link
    await nav.getByRole("link", { name: /Report/i }).click();
    await expect(page).toHaveURL("/issues/new");
    await expect(
      page.getByRole("heading", { name: "Report Issue" })
    ).toBeVisible();

    // Click Machines link (on desktop only)
    const machinesLink = nav.getByRole("link", { name: "Machines" });
    // Only click if visible (may be hidden on mobile)
    if (await machinesLink.isVisible()) {
      await machinesLink.click();
      await expect(page).toHaveURL("/machines");
      await expect(
        page.getByRole("heading", { name: "Machines" })
      ).toBeVisible();
    }
  });

  test("user menu dropdown - open and close menu", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for dashboard
    await expect(page).toHaveURL("/dashboard");

    // User menu should not be open initially
    await expect(page.getByText("Profile")).not.toBeVisible();

    // Click on user menu trigger (avatar with chevron)
    const nav = page.locator("nav");
    const userMenuTrigger = nav.getByRole("button", { name: /User menu/i });
    await userMenuTrigger.click();

    // Menu items should be visible
    await expect(page.getByText("Profile")).toBeVisible();
    await expect(page.getByText("Settings")).toBeVisible();
    await expect(page.getByText("Sign Out")).toBeVisible();

    // Click away to close menu
    await page.locator("main").click();
    await expect(page.getByText("Profile")).not.toBeVisible();
  });

  test("logout from user menu - sign out and redirect", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for dashboard
    await expect(page).toHaveURL("/dashboard");

    // Open user menu
    const nav = page.locator("nav");
    const userMenuTrigger = nav.getByRole("button", { name: /User menu/i });
    await userMenuTrigger.click();

    // Click Sign Out
    await page.getByRole("button", { name: "Sign Out" }).click();

    // Should redirect to home page
    await expect(page).toHaveURL("/");

    // Verify we're logged out - navigation should show Sign In/Sign Up
    await expect(nav.getByRole("link", { name: "Sign In" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Sign Up" })).toBeVisible();
  });

  test("logo navigation - links to correct page based on auth state", async ({
    page,
  }) => {
    // When unauthenticated, logo should link to /
    await page.goto("/");
    const nav = page.locator("nav");
    const logoLink = nav.getByRole("link", { name: /PinPoint/i });
    await expect(logoLink).toHaveAttribute("href", "/");

    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for dashboard
    await expect(page).toHaveURL("/dashboard");

    // When authenticated, logo should link to /dashboard
    const authenticatedLogoLink = nav.getByRole("link", { name: /PinPoint/i });
    await expect(authenticatedLogoLink).toHaveAttribute("href", "/dashboard");

    // Click logo to verify it works
    await authenticatedLogoLink.click();
    await expect(page).toHaveURL("/dashboard");
  });

  test("authenticated user redirect - home page redirects to dashboard", async ({
    page,
  }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for dashboard
    await expect(page).toHaveURL("/dashboard");

    // Try to navigate to home page
    await page.goto("/");

    // Should automatically redirect to dashboard
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("navigation on all pages except auth - verify navigation appears", async ({
    page,
  }) => {
    // Login first
    await page.goto("/login");

    // Auth pages should NOT have navigation bar (they have their own centered layout)
    const loginNav = page.locator("nav");
    await expect(loginNav).not.toBeVisible();

    // Complete login
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Dashboard should have navigation
    await expect(page).toHaveURL("/dashboard");
    const dashboardNav = page.locator("nav");
    await expect(dashboardNav).toBeVisible();

    // Navigate to issues page
    await page.goto("/issues");
    const issuesNav = page.locator("nav");
    await expect(issuesNav).toBeVisible();

    // Navigate to machines page
    await page.goto("/machines");
    const machinesNav = page.locator("nav");
    await expect(machinesNav).toBeVisible();
  });
});
