/**
 * E2E Tests: Machine Details Redesign
 *
 * Tests the redesigned (now tabbed) machine details page and the absorbed
 * machine-list overflow check. Inline editing and owner management tests are
 * in e2e/full/machine-details-extended.spec.ts.
 *
 * AUDIT 2026-05 (Wave 3a, Rows 26 + 27):
 *   Row 27 — Kept: layout-D overflow check + CSV-F multi-step download journey.
 *   Row 27 — Downgraded to RTL (IssuesExpando.test.tsx + ExportButton.test.tsx):
 *     - "should show issues expando collapsed by default" (class-H)
 *     - "should expand and collapse issues section" (class-H)
 *     - "should show Report Issue button in header" (class-H)
 *   Row 26 — Absorbed from e2e/smoke/machines-crud.spec.ts (now deleted):
 *     - machines list page overflow check (class-D)
 *   Row 26 — Downgraded to integration/unit (machine-actions.test.ts):
 *     - "non-admin cannot access /m/new page" (class-E)
 *     - "should display seeded test machines with correct statuses" (class-B/D)
 *     - "should display machine issues on detail page via expando" (class-H — RTL)
 *     - "should display machine owner to all logged-in users" (class-D/H — RTL)
 *
 * TABBED-LAYOUT NOTES (post-merge):
 * - The persistent header is identity-only (`[initials] | name`); status,
 *   owner display, and Report Issue button moved off it. Open-issue count +
 *   status surface as a colored badge on the Service tab itself.
 * - The issues section is no longer a collapsible expando; it renders an
 *   always-open list inside the Service tab (`/m/[initials]/maintenance`).
 * - The export button moved with the issues list onto the Service tab.
 */

import { test, expect } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  ensureLoggedIn,
  loginAs,
  logout,
  assertNoA11yViolations,
} from "../support/actions";
import { seededMachines, TEST_USERS } from "../support/constants";
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
    await assertNoA11yViolations(page);
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

    await assertNoA11yViolations(page);
  });

  // Absorbed from e2e/smoke/machines-crud.spec.ts (Row 26 MERGE):
  // overflow check on the machines list page (/m)
  test("should display machine list page without horizontal overflow", async ({
    page,
  }, testInfo) => {
    // Login as admin to ensure "Add Machine" button renders (exercises full list layout)
    await logout(page, testInfo);
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    await page.goto("/m?availability=all");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoA11yViolations(page);

    // Restore default user
    await logout(page, testInfo);
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
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
