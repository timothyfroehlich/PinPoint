/**
 * E2E smoke: Settings page loads for an authenticated user.
 *
 * Verifies the page renders without a 500 and the Connected Accounts
 * section is visible. Full OAuth round-trip behaviour is covered by unit
 * tests (oauth-actions.test.ts, connected-accounts-section.test.tsx).
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state";
import { assertNoA11yViolations } from "../support/actions.js";

test.describe("Settings page (smoke)", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("Connected Accounts section renders on /settings", async ({ page }) => {
    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { name: /connected accounts/i })
    ).toBeVisible();

    await assertNoA11yViolations(page);
  });
});
