/**
 * E2E smoke: User profile page renders without 500.
 *
 * Verifies the profile page is reachable from the settings "View your public
 * profile →" link and that the user's name heading is visible.
 * Full edit-journey coverage is in e2e/profiles/profile-edit.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";

test.describe("Profile smoke", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("own profile renders", async ({ page }) => {
    await page.goto("/settings");

    await page.getByRole("link", { name: /view your public profile/i }).click();

    await expect(page).toHaveURL(/\/u\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
