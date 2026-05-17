/**
 * E2E Tests: Machine Details - Extended (Full Suite)
 *
 * AUDIT 2026-05 (Wave 3a, Row 9):
 *   Kept: "should display owner requirements callout on issue page" (class-F multi-step journey)
 *   Downgraded to integration/unit (machine-actions.test.ts + machine-text-fields.test.ts):
 *     - "should show description placeholder for owner" (class-B)
 *     - "should allow owner to inline-edit description" (class-B/E)
 *     - "should allow owner to cancel inline editing" (class-H)
 *     - "should hide owner notes from non-owners" (class-E)
 *     - "should show owner notes to machine owner" (class-E)
 *     - "should hide owner requirements from unauthenticated users" (class-E)
 *     - "non-owner member should not be able to edit admin-owned machine fields" (class-E)
 *     - "member should be able to edit their own machine fields" (class-E/B)
 *
 * Layout and expando tests are in e2e/smoke/machine-details-redesign.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { ensureLoggedIn, logout, loginAs } from "../support/actions";
import { seededMachines, TEST_USERS } from "../support/constants";
import { clearMachineField } from "../support/supabase-admin";

test.describe("Machine Details - Extended", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await ensureLoggedIn(page, testInfo);
  });

  // The ownerRequirements test writes to Medieval Madness. Always clear it so
  // subsequent runs don't see stale data.
  test.afterEach(async () => {
    await clearMachineField(
      seededMachines.medievalMadness.initials,
      "owner_requirements"
    );
  });

  test("should display owner requirements callout on issue page", async ({
    page,
  }, testInfo) => {
    // First, let's login as admin and set owner requirements on a machine
    await logout(page, testInfo);
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    // Navigate to admin-owned machine
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Click to edit owner requirements
    const reqDisplay = page.getByTestId("machine-owner-requirements-display");
    await reqDisplay.click();

    // Fill in requirements
    const textarea = page
      .getByTestId("machine-owner-requirements")
      .locator(".ProseMirror");
    await textarea.fill("Please handle with care - vintage machine");

    // Save
    await page.getByTestId("machine-owner-requirements-save").click();

    // Verify it saved
    await expect(
      page.getByTestId("machine-owner-requirements-display")
    ).toContainText("Please handle with care - vintage machine");

    // Now navigate to an issue for this machine to check the callout. The
    // issues list lives on the Service tab and renders cards flat (no
    // expando wrapper to expand).
    await page.goto(
      `/m/${seededMachines.medievalMadness.initials}/maintenance`
    );

    // Click the first issue card
    const firstIssueCard = page.getByTestId("issue-card").first();
    await firstIssueCard.click();

    // Owner requirements callout should be visible
    const callout = page
      .getByTestId("owner-requirements-callout")
      .filter({ visible: true })
      .first();
    await expect(callout).toBeVisible();
    await expect(callout).toContainText(
      "Please handle with care - vintage machine"
    );

    // Restore member login
    await logout(page, testInfo);
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
  });
});
