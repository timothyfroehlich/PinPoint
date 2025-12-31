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
  }, testInfo) => {
    // Login first
    await loginAs(page, testInfo);

    // Use project name to determine mobile vs desktop layout
    const isMobile = testInfo.project.name.includes("Mobile");

    let activeSidebar;

    if (isMobile) {
      // On mobile, open the menu first
      const mobileTrigger = page.getByTestId("mobile-menu-trigger");
      await mobileTrigger.click();
      // Wait for sidebar to be visible in the sheet
      const mobileSidebar = page.locator(
        "[role='dialog'] [data-testid='sidebar']"
      );
      await expect(mobileSidebar).toBeVisible();
      activeSidebar = mobileSidebar;
    } else {
      // On desktop, sidebar should already be visible
      const desktopSidebar = page.locator("aside [data-testid='sidebar']");
      await expect(desktopSidebar).toBeVisible();
      activeSidebar = desktopSidebar;
    }

    // Verify primary navigation links exist
    // Verify Sidebar Items (Common)
    await expect(
      activeSidebar.getByRole("link", { name: "Dashboard" })
    ).toBeVisible();
    await expect(
      activeSidebar.getByRole("link", { name: "Issues" })
    ).toBeVisible();
    await expect(
      activeSidebar.getByRole("link", { name: "Machines" })
    ).toBeVisible();

    // If we opened the mobile menu, close it now so we can interact with the user menu
    if (isMobile) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    }

    // Verify Report Issue button is visible (desktop and mobile)
    await expect(
      page.getByRole("link", { name: "Report Issue" })
    ).toBeVisible();

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
