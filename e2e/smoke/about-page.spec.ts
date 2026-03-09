/**
 * E2E Tests: About Page
 *
 * Tests that the About page is accessible and renders correctly.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";

test.describe("About Page - Authenticated", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("authenticated user can navigate to About via sidebar", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("Mobile");

    if (isMobile) {
      // Mobile: no sidebar — navigate directly
      await page.goto("/about");
    } else {
      await page.goto("/dashboard");
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
});

test.describe("About Page - Public", () => {
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
