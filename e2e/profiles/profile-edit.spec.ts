/**
 * E2E: Member edits their profile (pronouns + bio) and sees changes reflected.
 *
 * Uses the ?edit=1 query param to open the inline editor. After save, navigates
 * back to view mode to assert the updated values are persisted and displayed.
 *
 * NOTE: Hover-card reveal is intentionally NOT asserted — hover is flaky in E2E.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";

test.describe("Profile edit", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("member edits pronouns and bio", async ({ page }) => {
    // Navigate to settings to resolve the member's /u/<id> URL dynamically
    await page.goto("/settings");
    const profileLink = page.getByRole("link", {
      name: /view your public profile/i,
    });
    const profileHref = await profileLink.getAttribute("href");
    if (!profileHref)
      throw new Error("Profile link href not found on settings");

    // Open the inline editor via ?edit=1
    await page.goto(`${profileHref}?edit=1`);
    await expect(page).toHaveURL(/\/u\/.*\?edit=1/);

    // Fill pronouns and bio
    const pronouns = `they/them ${Date.now()}`;
    await page.getByLabel(/^Pronouns$/i).fill(pronouns);
    await page.getByLabel(/^Bio$/i).fill("Loves drop targets");

    // Submit the form
    await page.getByRole("button", { name: /^Save$/i }).click();

    // Navigate to view mode to assert the changes are reflected
    await page.goto(profileHref);
    await expect(page).toHaveURL(/\/u\//);

    await expect(page.getByText(pronouns, { exact: false })).toBeVisible();
    await expect(page.getByText("Loves drop targets")).toBeVisible();
  });
});
