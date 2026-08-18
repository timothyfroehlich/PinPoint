/**
 * E2E smoke: Admin Integrations page.
 *
 * Covers the combined admin surface (PP-o355.8) — one page, one section per
 * integration (admin-integrations spec §2.1):
 * - Page renders with both the Discord and Pinball Map sections
 * - Each section shows its own fields and its own Save / Reset (§2.3)
 * - The retired per-integration Discord route redirects here (§2.1)
 * - Navigation from the user menu lands on the page
 * - Unauthenticated visitors don't see it
 *
 * Server Action behaviour (validate buttons, save validation, DB writes) is
 * covered by `src/test/integration/admin/discord-integration-actions.test.ts`
 * and the Pinball Map action tests — smoke is "renders without 500"
 * (CORE-TEST-005).
 */

import { test, expect, type Page } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { assertNoA11yViolations } from "../support/actions.js";

/**
 * One integration's card, scoped by its heading. Both sections carry a
 * "Save changes" button, so every per-section assertion has to be scoped or it
 * trips Playwright's strict mode.
 */
function section(page: Page, name: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

test.describe("Admin Integrations page", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("renders both integration sections", async ({ page }) => {
    await page.goto("/admin/integrations");
    await expect(
      page.getByRole("heading", { name: "Integrations", exact: true })
    ).toBeVisible();

    // Discord section (spec §3) — the fields it had as a standalone page.
    const discord = section(page, "Discord");
    await expect(discord.getByLabel("Bot token")).toBeVisible();
    await expect(discord.getByLabel("Server ID")).toBeVisible();
    await expect(discord.getByLabel("Invite link")).toBeVisible();
    await expect(
      discord.getByRole("button", { name: "Save changes" })
    ).toBeVisible();
    await expect(discord.getByRole("button", { name: "Reset" })).toBeVisible();

    // Pinball Map section (spec §4) — config only, plus the sync readout.
    const pbm = section(page, "Pinball Map");
    await expect(pbm.getByLabel("Location id")).toBeVisible();
    await expect(
      pbm.getByRole("button", { name: "Save changes" })
    ).toBeVisible();
    await expect(pbm.getByRole("button", { name: /Sync now/ })).toBeVisible();

    await assertNoA11yViolations(page);
  });

  test("the retired Discord route redirects to the combined page", async ({
    page,
  }) => {
    await page.goto("/admin/integrations/discord");
    await expect(page).toHaveURL(/\/admin\/integrations$/);
    await expect(
      section(page, "Discord").getByLabel("Server ID")
    ).toBeVisible();
  });

  test("navigates here from the user menu", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("user-menu-button").click();
    await page.getByTestId("user-menu-admin-integrations").click();
    await expect(page).toHaveURL(/\/admin\/integrations$/);
  });
});

test.describe("Admin Integrations page (unauthenticated)", () => {
  // Explicitly no storageState — fresh anonymous context
  test.use({ storageState: { cookies: [], origins: [] } });

  test("non-admin is forbidden", async ({ page }) => {
    await page.goto("/admin/integrations");
    // Unauthenticated hits the login redirect; a member would hit Forbidden —
    // either way the page's own heading is not rendered.
    await expect(
      page.getByRole("heading", { name: "Integrations", exact: true })
    ).toHaveCount(0);
  });
});
