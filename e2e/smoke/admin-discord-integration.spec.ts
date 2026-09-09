/**
 * E2E smoke: Combined admin integrations page.
 *
 * Covers the combined admin integrations surface:
 * - The legacy Discord route redirects to the combined page
 * - Page renders with the page/card headings and key form fields
 * - No distinct integration enable switch is rendered
 * - Navigation from the user menu lands on the combined page
 * - Unauthenticated visitors don't see the page heading
 *
 * The admin Server Action behaviour (validate buttons, save validation and DB write paths)
 * is covered by `src/test/integration/admin/discord-integration-actions.test.ts`.
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { assertNoA11yViolations } from "../support/actions.js";
import {
  configureDiscordIntegrationForTest,
  unconfigureDiscordIntegrationForTest,
} from "../support/supabase-admin.js";

test.describe("Admin integrations page", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("redirects the legacy route and renders the Discord form", async ({
    page,
  }) => {
    await page.goto("/admin/integrations/discord");
    await expect(page).toHaveURL(/\/admin\/integrations$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Integrations" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Discord" })
    ).toBeVisible();
    // Key form fields from the Pattern B redesign.
    await expect(page.getByLabel("Bot token")).toBeVisible();
    await expect(page.getByLabel("Server ID")).toBeVisible();
    await expect(page.getByLabel("Invite link")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    // Save / Reset footer.
    await expect(
      page.getByRole("button", { name: "Save changes" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();

    await assertNoA11yViolations(page);
  });

  test("navigates here from the user menu", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("user-menu-button").click();
    await page.getByTestId("user-menu-admin-integrations").click();
    await expect(page).toHaveURL(/\/admin\/integrations$/);
  });

  test("removes a saved token only after confirmation", async ({ page }) => {
    await configureDiscordIntegrationForTest();
    try {
      await page.goto("/admin/integrations");
      await page.getByRole("button", { name: "Remove saved token" }).click();
      await expect(
        page.getByRole("alertdialog", {
          name: "Remove the Discord bot token?",
        })
      ).toBeVisible();
      await page.getByRole("button", { name: "Remove token" }).click();
      await expect(
        page.getByRole("button", { name: "Remove saved token" })
      ).toHaveCount(0);
    } finally {
      await unconfigureDiscordIntegrationForTest();
    }
  });
});

test.describe("Admin integrations page (unauthenticated)", () => {
  // Explicitly no storageState — fresh anonymous context
  test.use({ storageState: { cookies: [], origins: [] } });

  test("non-admin is forbidden", async ({ page }) => {
    await page.goto("/admin/integrations/discord");
    // Unauthenticated hits login redirect; member would hit Forbidden — either
    // way we're NOT seeing the combined page heading.
    await expect(
      page.getByRole("heading", { level: 1, name: "Integrations" })
    ).toHaveCount(0);
  });
});
