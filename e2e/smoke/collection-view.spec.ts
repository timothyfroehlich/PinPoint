/**
 * E2E Tests: Collection view (PP-slrd.1)
 *
 * Smoke coverage for the /c/owner/[userId] tabbed page: user-menu entry
 * point, all three tabs render without 500, and the owner-name link on a
 * machine Info tab lands on that owner's collection.
 *
 * Fixtures: the seeded member user owns SC, FB, EBD, AFM, SM (see
 * supabase/seed-users.mjs ownerMap), so "My Machines" is non-empty.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";
import {
  assertNoA11yViolations,
  assertNoHorizontalOverflow,
} from "../support/actions.js";
import { seededMachines } from "../support/constants.js";

test.describe("Collection view (PP-slrd.1)", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("My Machines via user menu renders Overview without 500", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("user-menu-button").click();
    await page.getByTestId("user-menu-my-machines").click();
    await expect(page).toHaveURL(/\/c\/owner\//);
    await expect(page.getByTestId("collection-summary")).toBeVisible();
    await expect(page.getByTestId("collection-overview-body")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoA11yViolations(page);
  });

  test("Issues and Timeline tabs render without 500", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("user-menu-button").click();
    await page.getByTestId("user-menu-my-machines").click();
    await page.getByTestId("collection-tab-issues").click();
    await expect(page).toHaveURL(/\/issues$/);
    await expect(page.getByTestId("collection-summary")).toBeVisible();
    await assertNoA11yViolations(page);
    await page.getByTestId("collection-tab-timeline").click();
    await expect(page).toHaveURL(/\/timeline$/);
    await expect(page.getByTestId("collection-summary")).toBeVisible();
    await assertNoA11yViolations(page);
  });

  test("owner name on machine info links to the owner's collection", async ({
    page,
  }) => {
    // AFM is owned by the member user (seed-users.mjs ownerMap).
    await page.goto(`/m/${seededMachines.attackFromMars.initials}`);
    await page.getByTestId("owner-display").getByRole("link").click();
    await expect(page).toHaveURL(/\/c\/owner\//);
    await expect(page.getByTestId("collection-summary")).toBeVisible();
  });
});
