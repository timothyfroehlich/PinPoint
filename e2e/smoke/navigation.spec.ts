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
  }, testInfo) => {
    // Navigate to home page (landing page for unauthenticated users)
    await page.goto("/");

    // Verify landing page welcome heading is visible
    await expect(
      page.getByRole("heading", { name: /Welcome to PinPoint/i })
    ).toBeVisible();

    // Mobile shows compact header; desktop shows full header
    const isMobile = testInfo.project.name.includes("Mobile");

    if (isMobile) {
      // Mobile header shows Sign In / Sign Up with mobile-specific test ids
      await expect(page.getByTestId("mobile-nav-signin")).toBeVisible();
      await expect(page.getByTestId("mobile-nav-signup")).toBeVisible();
    } else {
      // Desktop header Sign In / Sign Up
      await expect(page.getByTestId("nav-signin")).toBeVisible();
      await expect(page.getByTestId("nav-signup")).toBeVisible();
    }

    // Verify Report Issue CTA is available on landing page
    await expect(page.getByTestId("cta-report-issue")).toBeVisible();
  });

  test("authenticated navigation - show user menu", async ({
    page,
  }, testInfo) => {
    // Login first
    await loginAs(page, testInfo);

    // Use project name to determine mobile vs desktop layout
    const isMobile = testInfo.project.name.includes("Mobile");

    if (isMobile) {
      // On mobile, verify the compact mobile header is visible
      await expect(page.getByTestId("mobile-header")).toBeVisible();
      // Verify the notification bell is accessible on mobile
      await expect(
        page.getByRole("button", { name: "Notifications" })
      ).toBeVisible();
    } else {
      // On desktop, sidebar should already be visible with nav links
      const desktopSidebar = page.locator("aside [data-testid='sidebar']");
      await expect(desktopSidebar).toBeVisible();
      await expect(
        desktopSidebar.getByRole("link", { name: "Dashboard" })
      ).toBeVisible();
      await expect(
        desktopSidebar.getByRole("link", { name: "Issues" })
      ).toBeVisible();
      await expect(
        desktopSidebar.getByRole("link", { name: "Machines" })
      ).toBeVisible();

      // Verify Report Issue button is visible in desktop header
      await expect(
        page.getByRole("link", { name: "Report Issue" })
      ).toBeVisible();
    }

    // Verify User Menu works on both mobile and desktop
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
