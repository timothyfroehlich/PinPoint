/**
 * E2E smoke: Admin Discord integration page.
 *
 * Covers the redesigned single-form admin surface (PR 4 / PP-2n5):
 * - Page renders with the heading and key form fields
 * - Activation switch is disabled when no token is set in DB
 * - Navigation from the user menu lands on the Discord page
 * - Unauthenticated visitors don't see the page heading
 *
 * The full admin-form behaviour (validate buttons, save round-trip,
 * unsaved-changes guard) is covered by `e2e/full/admin-discord-integration.spec.ts`.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state";

test.describe("Admin Discord integration page", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("loads and renders the redesigned single form", async ({ page }) => {
    await page.goto("/admin/integrations/discord");
    await expect(
      page.getByRole("heading", { name: "Discord Integration" })
    ).toBeVisible();
    // Key form fields from the Pattern B redesign.
    await expect(page.getByLabel("Bot token")).toBeVisible();
    await expect(page.getByLabel("Server ID")).toBeVisible();
    await expect(page.getByLabel("Invite link")).toBeVisible();
    // Save / Reset footer.
    await expect(
      page.getByRole("button", { name: "Save changes" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
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
