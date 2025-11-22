/**
 * E2E Tests: Navigation Component
 *
 * Tests navigation bar behavior for authenticated and unauthenticated states.
 */

import { test, expect } from "@playwright/test";

import { loginAs } from "../support/actions";
import { seededMember } from "../support/constants";

test.describe.serial("Navigation", () => {
  test("unauthenticated navigation - show Sign In and Sign Up buttons", async ({
    page,
  }) => {
    // Navigate to home page
    await page.goto("/");

    // Verify navigation shows PinPoint logo
    await expect(page.getByText("PinPoint").first()).toBeVisible();

    // Verify Sign In and Sign Up buttons are visible
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Sign In" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Sign Up" })).toBeVisible();

    // Verify Report Issue shortcut is available to guests, but other quick links stay hidden
    await expect(nav.getByRole("link", { name: "Report Issue" })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Issues/i })).toHaveCount(0);
  });

  test("authenticated navigation - show quick links and user menu", async ({
    page,
  }) => {
    // Login first
    await loginAs(page);

    // Verify navigation shows PinPoint logo
    const nav = page.getByRole("navigation");
    await expect(nav.getByText("PinPoint").first()).toBeVisible();

    // Verify quick links are visible
    await expect(nav.getByRole("link", { name: /Issues/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Report/i })).toBeVisible();

    // Verify user info is visible (name and email)
    await expect(nav.getByText(seededMember.name)).toBeVisible();
    await expect(nav.getByText(seededMember.email)).toBeVisible();

    // Verify Sign In/Sign Up buttons are NOT visible
    await expect(nav.getByRole("link", { name: "Sign In" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Sign Up" })).not.toBeVisible();
  });

  test("quick links navigation - navigate to placeholder pages", async ({
    page,
  }) => {
    // Login first
    await loginAs(page);

    const nav = page.getByRole("navigation");

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
    await loginAs(page);

    const profileItem = page.getByRole("menuitem", { name: "Profile" });
    const settingsItem = page.getByRole("menuitem", { name: "Settings" });
    const signOutItem = page.getByRole("menuitem", { name: "Sign Out" });

    // User menu should not be open initially
    await expect(profileItem).toHaveCount(0);

    // Click on user menu trigger (avatar with chevron)
    const nav = page.getByRole("navigation");
    const userMenuTrigger = nav.getByRole("button", { name: /User menu/i });
    await userMenuTrigger.click();

    // Menu items should be visible
    await expect(profileItem.first()).toBeVisible();
    await expect(settingsItem.first()).toBeVisible();
    await expect(signOutItem.first()).toBeVisible();

    // Click away (Escape closes Radix dropdown)
    await page.keyboard.press("Escape");
    await expect(profileItem).toHaveCount(0);
  });

  test("logout from user menu - sign out and redirect", async ({ page }) => {
    // Login first
    await loginAs(page);

    // Open user menu
    const nav = page.getByRole("navigation");
    const userMenuTrigger = nav.getByRole("button", { name: /User menu/i });
    await userMenuTrigger.click();

    // Click Sign Out
    await page.getByRole("menuitem", { name: "Sign Out" }).click();

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
    const nav = page.getByRole("navigation");
    const logoLink = nav.getByRole("link", { name: /PinPoint/i });
    await expect(logoLink).toHaveAttribute("href", "/");

    // Login
    await loginAs(page);

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
    await loginAs(page);

    // Try to navigate to home page
    await page.goto("/", { waitUntil: "networkidle" });

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
    await loginAs(page);

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
