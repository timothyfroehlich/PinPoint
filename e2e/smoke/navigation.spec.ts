/**
 * E2E Tests: Navigation Component
 *
 * Tests navigation bar behavior for authenticated and unauthenticated states.
 */

import { test, expect } from "@playwright/test";
import { assertNoHorizontalOverflow, loginAs } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

test.describe("Navigation", () => {
  test("unauthenticated navigation - show Sign In and Sign Up buttons", async ({
    page,
  }) => {
    // Navigate to home page (landing page for unauthenticated users)
    await page.goto("/");

    // Verify landing page welcome heading is visible
    await expect(
      page.getByRole("heading", { name: /Welcome to PinPoint/i })
    ).toBeVisible();

    // AppHeader is unified — same testids on all viewports
    await expect(page.getByTestId("nav-signin")).toBeVisible();
    await expect(page.getByTestId("nav-signup")).toBeVisible();

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

    // AppHeader is always visible
    const appHeader = page.getByTestId("app-header");
    await expect(appHeader).toBeVisible();

    if (isMobile) {
      // Verify the notification bell is accessible on mobile
      await expect(
        page.getByRole("button", { name: "Notifications" })
      ).toBeVisible();
    } else {
      // On desktop, AppHeader should show nav links
      await expect(
        appHeader.getByRole("link", { name: "Dashboard" })
      ).toBeVisible();
      await expect(
        appHeader.getByRole("link", { name: "Issues" })
      ).toBeVisible();
      await expect(
        appHeader.getByRole("link", { name: "Machines" })
      ).toBeVisible();

      // Verify Report Issue button is visible in AppHeader on desktop
      await expect(
        page.getByRole("link", { name: "Report Issue" })
      ).toBeVisible();
    }

    // Verify User Menu works on both mobile and desktop (unified AppHeader)
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

    // Close menu, then verify no horizontal overflow on dashboard
    await page.keyboard.press("Escape");
    await assertNoHorizontalOverflow(page);
  });
});

test.describe("Bottom Tab Bar (mobile only)", () => {
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

  test("More sheet shows User Management only for admin users", async ({
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

    // User Management should be visible for admin role
    await expect(page.getByTestId("more-sheet-admin")).toBeVisible();
    await expect(page.getByTestId("more-sheet-admin")).toHaveAttribute(
      "href",
      "/admin/users"
    );
  });
});
