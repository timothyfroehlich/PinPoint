/**
 * E2E Tests: Navigation Component
 *
 * Tests navigation bar behavior for authenticated and unauthenticated states.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

test.describe.serial("Navigation", () => {
  test("unauthenticated navigation - show Sign In and Sign Up buttons", async ({
    page,
  }) => {
    // Navigate to home page (landing page for unauthenticated users)
    await page.goto("/");

    // Verify landing page welcome heading is visible
    await expect(
      page.getByRole("heading", { name: /Welcome to PinPoint/i })
    ).toBeVisible();

    // Verify Sign In and Sign Up buttons are visible (use test ids)
    await expect(page.getByTestId("nav-signin")).toBeVisible();
    await expect(page.getByTestId("nav-signup")).toBeVisible();

    // Verify Report Issue CTA is available on landing page
    await expect(page.getByTestId("cta-report-issue")).toBeVisible();
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

test.describe.serial("Bottom Tab Bar (mobile only)", () => {
  test("tab bar is visible on mobile and links to correct routes", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("Mobile");
    if (!isMobile) {
      test.skip();
    }

    await loginAs(page, testInfo);

    const tabBar = page.getByTestId("bottom-tab-bar");
    await expect(tabBar).toBeVisible();

    // Verify tab links point to correct hrefs
    await expect(
      tabBar.getByRole("link", { name: /dashboard/i })
    ).toHaveAttribute("href", "/dashboard");
    await expect(tabBar.getByRole("link", { name: /issues/i })).toHaveAttribute(
      "href",
      /\/issues/
    );
    await expect(
      tabBar.getByRole("link", { name: /machines/i })
    ).toHaveAttribute("href", "/m");
    await expect(tabBar.getByRole("link", { name: /report/i })).toHaveAttribute(
      "href",
      "/report"
    );
  });

  test("More tab opens a sheet with secondary nav links", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("Mobile");
    if (!isMobile) {
      test.skip();
    }

    await loginAs(page, testInfo);

    // Open the More sheet
    const moreButton = page.getByRole("button", { name: /more options/i });
    await expect(moreButton).toBeVisible();
    await moreButton.click();

    // Sheet should open with secondary nav items
    await expect(page.getByTestId("more-sheet-help")).toBeVisible();
    await expect(page.getByTestId("more-sheet-whats-new")).toBeVisible();
    await expect(page.getByTestId("more-sheet-about")).toBeVisible();
  });

  test("More sheet shows Admin Panel only for admin users", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("Mobile");
    if (!isMobile) {
      test.skip();
    }

    // Log in as admin
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    const moreButton = page.getByRole("button", { name: /more options/i });
    await moreButton.click();

    // Admin Panel should be visible for admin role
    await expect(page.getByTestId("more-sheet-admin")).toBeVisible();
    await expect(page.getByTestId("more-sheet-admin")).toHaveAttribute(
      "href",
      "/admin/users"
    );
  });
});
