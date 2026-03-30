/**
 * E2E Tests: Machine Details Redesign
 *
 * Tests the redesigned machine details page layout, expando section,
 * and report issue button. Inline editing and owner management tests
 * are in e2e/full/machine-details-extended.spec.ts.
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

  test("should show issues expando collapsed by default", async ({ page }) => {
    await page.goto(`/m/${seededMachines.addamsFamily.initials}`);

    const expando = page.getByTestId("issues-expando");
    await expect(expando).toBeVisible();

    // The trigger should show "Open Issues" text
    const trigger = page.getByTestId("issues-expando-trigger");
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText("Open Issues");

    // Issue cards should NOT be visible when collapsed
    // (details element is closed by default)
    await expect(page.getByTestId("issue-card").first()).not.toBeVisible();
  });

  test("should expand and collapse issues section", async ({ page }) => {
    await page.goto(`/m/${seededMachines.addamsFamily.initials}`);

    // Click to expand
    await page.getByTestId("issues-expando-trigger").click();

    // Issue cards should now be visible
    await expect(page.getByTestId("issue-card").first()).toBeVisible();

    // Click to collapse
    await page.getByTestId("issues-expando-trigger").click();

    // Issue cards should be hidden again
    await expect(page.getByTestId("issue-card").first()).not.toBeVisible();
  });

  test("should show Report Issue button in header", async ({ page }) => {
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    const reportButton = page.getByTestId("machine-report-issue");
    await expect(reportButton).toBeVisible();
    await expect(reportButton).toContainText("Report Issue");
  });
});
