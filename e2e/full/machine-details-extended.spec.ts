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

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { seededMachines } from "../support/constants.js";
import { clearMachineField } from "../support/supabase-admin.js";

test.describe("Machine Details - Extended", () => {
  test.use({ storageState: STORAGE_STATE.admin });

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
  }) => {
    const maintenancePath = `/m/${seededMachines.medievalMadness.initials}/maintenance`;

    // Navigate to the admin-owned machine's Service tab — Owner's Requirements
    // relocated off the Info tab into the Service-tab Machine box (PP-5sgt.3).
    await page.goto(maintenancePath);

    // Click the Edit pencil to enter edit mode. RichTextDisplay can render
    // links (mentions/urls) and nesting <a> inside <button> is invalid HTML,
    // so the display wrapper is not itself a button — clicks on the field
    // don't enter edit mode; only the dedicated Edit button does.
    await page.getByTestId("machine-owner-requirements-edit").click();

    // Fill in requirements
    const textarea = page
      .getByTestId("machine-owner-requirements")
      .locator(".ProseMirror");
    await textarea.fill("Please handle with care - vintage machine");

    // The display updates optimistically. Wait for the Server Action response
    // to arrive before navigating, or the navigation can abort the action in
    // Firefox. We check saveResponse.ok() rather than awaiting saveResponse.finished()
    // because streaming RSC responses under next-start can hang finished() (PP-ujw4).
    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === maintenancePath &&
          response.request().method() === "POST"
      ),
      page.getByTestId("machine-owner-requirements-save").click(),
    ]);
    expect(saveResponse.ok()).toBe(true);

    // Verify the saved value survived the server round-trip across a fresh reload
    // before navigating onwards to the issue page.
    await page.reload();
    await expect(
      page.getByTestId("machine-owner-requirements-display")
    ).toContainText("Please handle with care - vintage machine");
    await expect(
      page.getByTestId("machine-owner-requirements-edit")
    ).toBeVisible();

    // Follow the issue link and wait for arrival before asserting the callout.
    const firstIssueLink = page
      .getByRole("region", { name: /^Open Issues/ })
      .getByRole("link")
      .first();
    const issuePath = await firstIssueLink.getAttribute("href");
    if (!issuePath)
      throw new Error("The issue link is missing its destination");
    await firstIssueLink.click();
    await expect(page).toHaveURL(issuePath);

    // The Owner's requirements callout sits on the Issue tab, the one every
    // arrival opens on.
    const callout = page.getByRole("note", { name: "Owner's requirements" });
    await expect(callout).toBeVisible();
    await expect(callout).toContainText(
      "Please handle with care - vintage machine"
    );
  });
});
