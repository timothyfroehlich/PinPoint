/**
 * E2E Tests: Navigation Component
 *
 * Tests navigation bar behavior for authenticated users.
 * Unauthenticated nav tested in landing-page.spec.ts.
 * Bottom Tab Bar tested in BottomTabBar.test.tsx (RTL unit).
 */

import { test, expect } from "../support/fixtures.js";
import {
  assertNoHorizontalOverflow,
  loginAs,
  assertNoA11yViolations,
} from "../support/actions.js";

test.describe("Navigation", () => {
  test("authenticated navigation - show user menu", async ({
    page,
  }, testInfo) => {
    // Login first
    await loginAs(page, testInfo);

    await assertNoA11yViolations(page);

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
