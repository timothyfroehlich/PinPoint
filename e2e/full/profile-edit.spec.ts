/**
 * E2E: Member edits their profile (pronouns + bio) and sees changes reflected.
 *
 * Uses the ?edit=1 query param to open the inline editor. updateProfileAction
 * revalidates and then redirects back to /u/<id> on success, so the assertions
 * wait for that redirect rather than issuing their own page.goto — a manual
 * goto races the in-flight Server Action and can abort it, which is what made
 * this spec flaky under parallel load (PP-stut).
 *
 * NOTE: Hover-card reveal is intentionally NOT asserted — hover is flaky in E2E.
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";

test.describe("Profile edit", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("member edits pronouns and bio", async ({ page }, testInfo) => {
    // This journey writes the seeded member's own profile row — a singleton.
    // The full config runs three projects concurrently, so a second copy of
    // this test overwrites pronouns between this copy's save and its read,
    // and each copy then asserts the other's value. Pin it to the project the
    // required `test-e2e-full-chromium` job runs; a text form has no
    // cross-browser risk worth triple-writing a shared row for.
    test.skip(
      testInfo.project.name !== "chromium",
      "Mutates the shared seeded member profile — must not run in parallel projects"
    );

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

    // Submit. On success the action redirects back to the read view, which
    // drops ?edit — waiting for that navigation is what proves the write
    // landed before we read it back.
    await page.getByRole("button", { name: /^Save$/i }).click();
    await expect(page).toHaveURL(new RegExp(`${profileHref}$`));

    await expect(page.getByText(pronouns, { exact: true })).toBeVisible();
    await expect(page.getByText("Loves drop targets")).toBeVisible();
  });
});
