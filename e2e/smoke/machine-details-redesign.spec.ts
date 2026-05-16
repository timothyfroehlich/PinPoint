/**
 * E2E Tests: Machine Details Redesign
 *
 * Tests the redesigned machine details page layout and CSV export journey.
 * Inline editing and owner management tests are in
 * e2e/full/machine-details-extended.spec.ts.
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
 */

import { test, expect } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  ensureLoggedIn,
  loginAs,
  logout,
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

  test("should display full-width details card with two-column layout", async ({
    page,
  }) => {
    // Navigate to a machine that admin owns (Medieval Madness)
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Machine Information heading should be visible
    await expect(
      page.getByRole("heading", { name: "Machine Information" })
    ).toBeVisible();

    // Left column elements: name, initials, owner
    await expect(page.getByTestId("owner-display")).toBeVisible();

    // Status and issues counts should be visible
    await expect(page.getByTestId("detail-open-issues")).toBeVisible();
    await expect(page.getByTestId("detail-open-issues-count")).toBeVisible();

    // Verify no horizontal overflow on machine detail page
    await assertNoHorizontalOverflow(page);
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

    // Restore default user
    await logout(page, testInfo);
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
  });

  test("should export machine issues to CSV", async ({ page }) => {
    // Navigate to TAF (The Addams Family) which has seeded issues
    await page.goto(`/m/${seededMachines.addamsFamily.initials}`);

    // Wait for page to load
    await expect(
      page.getByRole("heading", { name: "Machine Information" })
    ).toBeVisible();

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent("download");

    // Click the export button (it's in the issues expando header)
    await page.getByTestId("export-csv-button").click();

    // Verify download was triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^pinpoint-TAF-issues-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });
});
