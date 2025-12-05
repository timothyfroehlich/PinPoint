/**
 * E2E Tests: Navigation Component
 *
 * Tests navigation bar behavior for authenticated and unauthenticated states.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";

test.describe.serial("Navigation", () => {
  test("unauthenticated navigation - show Sign In and Sign Up buttons", async ({
    page,
  }) => {
    // Navigate to home page
    await page.goto("/");

    // Verify Quick Stats are visible instead of old landing page text
    await expect(page.getByTestId("quick-stats")).toBeVisible();

    // Verify Sign In and Sign Up buttons are visible (use test ids)
    await expect(page.getByTestId("nav-signin")).toBeVisible();
    await expect(page.getByTestId("nav-signup")).toBeVisible();

    // Verify Report Issue shortcut is available to guests
    await expect(page.getByTestId("nav-report-issue")).toBeVisible();

    // Verify Pre-Beta Banner is present
    await expect(page.getByText("Pre-Beta Notice")).toBeVisible();
  });

  test("authenticated navigation - show quick links and user menu", async ({
    page,
  }) => {
    // Login first
    await loginAs(page);

    // Sidebar (navigation) should be present for authenticated pages
    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).toBeVisible();

    // Verify primary navigation links exist
    // Verify Sidebar Items (Common)
    await expect(
      sidebar.getByRole("link", { name: "Dashboard" })
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Issues" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Machines" })).toBeVisible();

    // Verify User Menu Items
    const userMenu = page.getByTestId("user-menu-button");
    await expect(userMenu).toBeVisible();
    await userMenu.click();

    const menuContent = page.getByRole("menu");
    await expect(
      menuContent.getByRole("menuitem", { name: "Settings" })
    ).toBeVisible();
    await expect(
      menuContent.getByRole("menuitem", { name: "Sign Out" })
    ).toBeVisible();
  });
});
