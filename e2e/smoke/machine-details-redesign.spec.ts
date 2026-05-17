/**
 * E2E Tests: Machine Details Redesign
 *
 * Tests the redesigned (now tabbed) machine details page: Info tab card
 * content, Service tab issues section, and CSV export. Inline editing and
 * owner management tests are in e2e/full/machine-details-extended.spec.ts.
 *
 * Notes after the tabbed-layout PR:
 * - The persistent header is identity-only (`[initials] | name`); status,
 *   owner display, and Report Issue button all moved off it. Open-issue
 *   count + status surface as a colored badge on the Service tab itself.
 * - The issues section is no longer a collapsible expando; it renders an
 *   always-open list inside the Service tab.
 */

import { test, expect } from "@playwright/test";
import { assertNoHorizontalOverflow, ensureLoggedIn } from "../support/actions";
import { seededMachines } from "../support/constants";
import { clearMachineField } from "../support/supabase-admin";

test.describe("Machine Details Redesign", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await ensureLoggedIn(page, testInfo);
  });

  // The ownerRequirements test in full/ writes to Medieval Madness. Always clear it so
  // subsequent runs don't see stale data.
  test.afterEach(async () => {
    await clearMachineField(
      seededMachines.medievalMadness.initials,
      "owner_requirements"
    );
  });

  test("Info tab renders owner + stats grid without horizontal overflow", async ({
    page,
  }) => {
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Owner cell in the 2-col stats grid
    await expect(page.getByTestId("owner-display")).toBeVisible();

    // Stats grid cells
    await expect(page.getByTestId("detail-open-issues")).toBeVisible();
    await expect(page.getByTestId("detail-open-issues-count")).toBeVisible();

    await assertNoHorizontalOverflow(page);
  });

  test("Service tab renders the issues section with cards visible", async ({
    page,
  }) => {
    // Issues live on the Service tab (URL slug stays `maintenance`).
    await page.goto(`/m/${seededMachines.addamsFamily.initials}/maintenance`);

    // The wrapping section is always present.
    await expect(page.getByTestId("issues-section")).toBeVisible();

    // Cards render flat (no expando) — section is always open in this design.
    await expect(page.getByTestId("issue-card").first()).toBeVisible();
  });

  test("Service tab exports machine issues to CSV", async ({ page }) => {
    // Export button lives in the Service tab's section header.
    await page.goto(`/m/${seededMachines.addamsFamily.initials}/maintenance`);

    const exportButton = page.getByTestId("export-csv-button");
    await expect(exportButton).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await exportButton.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^pinpoint-TAF-issues-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });
});
