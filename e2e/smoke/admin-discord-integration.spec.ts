/**
 * E2E smoke: Admin Discord integration page.
 *
 * Covers the core admin surface shipped by PR 3 (PP-mud):
 * - Page renders with Status / Configuration / Test connection sections
 * - Test-DM button disabled when integration is off and no token is set
 * - Navigation from the user menu lands on the Discord page
 * - Unauthenticated visitors don't see the Discord page heading
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state";

test.describe("Admin Discord integration page", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("loads and renders the three sections", async ({ page }) => {
    await page.goto("/admin/integrations/discord");
    await expect(
      page.getByRole("heading", { name: "Discord Integration" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Configuration" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Test connection" })
    ).toBeVisible();
  });

  test("test-DM button is disabled when integration is off", async ({
    page,
  }) => {
    await page.goto("/admin/integrations/discord");
    const btn = page.getByTestId("discord-test-dm-button");
    await expect(btn).toBeDisabled();
  });

  test("navigates here from the user menu", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("user-menu-button").click();
    await page.getByTestId("user-menu-admin-integrations").click();
    await expect(page).toHaveURL(/\/admin\/integrations\/discord$/);
  });
});

test.describe("Admin Discord integration page (unauthenticated)", () => {
  // Explicitly no storageState — fresh anonymous context
  test.use({ storageState: { cookies: [], origins: [] } });

  test("non-admin is forbidden", async ({ page }) => {
    await page.goto("/admin/integrations/discord");
    // Unauthenticated hits login redirect; member would hit Forbidden — either
    // way we're NOT seeing the Discord page heading.
    await expect(
      page.getByRole("heading", { name: "Discord Integration" })
    ).toHaveCount(0);
  });
});
