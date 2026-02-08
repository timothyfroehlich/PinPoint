/**
 * E2E Tests: About Page
 *
 * Tests that the About page is accessible and renders correctly.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";

test.describe("About Page", () => {
  test("authenticated user can navigate to About via sidebar", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo);

    const isMobile = testInfo.project.name.includes("Mobile");

    if (isMobile) {
      const mobileTrigger = page.getByTestId("mobile-menu-trigger");
      await mobileTrigger.click();
      const mobileSidebar = page.locator(
        "[role='dialog'] [data-testid='sidebar']"
      );
      await expect(mobileSidebar).toBeVisible();
      await mobileSidebar.getByRole("link", { name: "About" }).click();
    } else {
      const desktopSidebar = page.locator("aside [data-testid='sidebar']");
      await expect(desktopSidebar).toBeVisible();
      await desktopSidebar.getByRole("link", { name: "About" }).click();
    }

    await expect(page).toHaveURL("/about");
    await expect(
      page.getByRole("heading", { name: "About PinPoint" })
    ).toBeVisible();

    // Verify links to Privacy and Terms are present
    await expect(
      page.getByRole("link", { name: "Privacy Policy" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Terms of Service" })
    ).toBeVisible();
  });

  test("unauthenticated user can access About page directly", async ({
    page,
  }) => {
    await page.goto("/about");

    await expect(
      page.getByRole("heading", { name: "About PinPoint" })
    ).toBeVisible();

    // Verify links to Privacy and Terms are present
    await expect(
      page.getByRole("link", { name: "Privacy Policy" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Terms of Service" })
    ).toBeVisible();
  });
});
