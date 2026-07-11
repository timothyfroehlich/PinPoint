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
 *   Row 26 — Downgraded to integration/unit (machine-actions.test.ts) except /m/new page-level 403 (E2E):
 *     - "non-admin cannot access /m/new page" (class-E page guard in E2E; mutation action in unit)
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
import { STORAGE_STATE } from "../support/auth-state.js";
import {
  assertNoHorizontalOverflow,
  assertNoA11yViolations,
} from "../support/actions.js";
import { seededMachines } from "../support/constants.js";
import { clearMachineField } from "../support/supabase-admin.js";

test.describe("Machine Details Redesign", () => {
  test.use({ storageState: STORAGE_STATE.member });

  // The ownerRequirements test in full/ writes to Medieval Madness. Always clear it so
  // subsequent runs don't see stale data.
  test.afterEach(async () => {
    await clearMachineField(
      seededMachines.medievalMadness.initials,
      "owner_requirements"
    );
  });

  test("Info tab renders the player hero + owner card without horizontal overflow", async ({
    page,
  }) => {
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Player-landing hero (status + Report button + known-issues peek).
    await expect(page.getByTestId("machine-info-hero")).toBeVisible();

    // Owner card in the reference cluster (replaced the old 2-col stats grid).
    await expect(page.getByTestId("machine-owner-card")).toBeVisible();

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
  test.describe("Admin machine list overflow check", () => {
    test.use({ storageState: STORAGE_STATE.admin });

    test("should display machine list page without horizontal overflow", async ({
      page,
    }) => {
      await page.goto("/m?availability=all");
      await expect(
        page.getByRole("heading", { name: "Machines" })
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await assertNoA11yViolations(page);
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

  test("logged-in non-admin member is blocked from /m/new page", async ({
    page,
  }) => {
    await page.goto("/m/new");

    // Should show Forbidden page / Access Denied
    await expect(page.getByText("Access Denied")).toBeVisible();
    await expect(
      page.locator("span").filter({ hasText: "Member" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  });
});
