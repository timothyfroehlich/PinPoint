/**
 * E2E Tests for Issues CRUD - Extended (Full Suite)
 *
 * Tests for watch functionality and pagination.
 * Core creation and detail tests are in e2e/smoke/issues-crud.spec.ts.
 * Requires Supabase to be running.
 */

import { test, expect, type Page } from "@playwright/test";
import { cleanupTestEntities, extractIdFromUrl } from "../support/cleanup.js";
import { seededMachines } from "../support/constants.js";
import { fillReportForm } from "../support/page-helpers.js";
import { STORAGE_STATE } from "../support/auth-state.js";

const createdIssueIds = new Set<string>();

const rememberIssueId = (page: Page): void => {
  const issueId = extractIdFromUrl(page.url());
  if (issueId) {
    createdIssueIds.add(issueId);
  }
};

test.describe("Issues System - Extended", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test.beforeEach(() => {
    // Increase timeout for local execution where compilation can be slow
    test.setTimeout(60000);
  });

  test.afterEach(async ({ request }) => {
    if (!createdIssueIds.size) {
      return;
    }
    await cleanupTestEntities(request, {
      issueIds: Array.from(createdIssueIds),
    });
    createdIssueIds.clear();
  });

  test.describe("Watch Issue Opt-in", () => {
    test("should auto-watch issue by default", async ({ page }) => {
      const machineInitials = seededMachines.addamsFamily.initials;
      await page.goto(`/report?machine=${machineInitials}`);

      // Watch checkbox should be visible and checked by default
      const watchCheckbox = page.getByLabel("Watch this issue");
      await expect(watchCheckbox).toBeVisible();
      await expect(watchCheckbox).toBeChecked();

      await fillReportForm(page, { title: "Auto-watched issue" });
      await page.getByRole("button", { name: "Submit Issue Report" }).click();
      await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);
      rememberIssueId(page);

      // On detail page, watch button should show "Unwatch" (already watching)
      await expect(
        page.getByRole("button", { name: /Unwatch Issue/i })
      ).toBeVisible();
    });

    test("should not auto-watch when checkbox is unchecked", async ({
      page,
    }) => {
      const machineInitials = seededMachines.addamsFamily.initials;
      await page.goto(`/report?machine=${machineInitials}`);

      await fillReportForm(page, {
        title: "Unwatched issue",
        watchIssue: false,
      });
      await page.getByRole("button", { name: "Submit Issue Report" }).click();
      await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);
      rememberIssueId(page);

      // On detail page, watch button should show "Watch" (not watching).
      // The page renders two accessible "Watch Issue" elements (header icon-only +
      // sidebar text button); use .first() to tolerate this without strict-mode error.
      await expect(
        page.getByRole("button", { name: /^Watch Issue$/i }).first()
      ).toBeVisible();
    });
  });

  test.describe("Issues List Pagination", () => {
    test("should have bottom pagination buttons that work", async ({
      page,
    }) => {
      // Navigate to issues list page
      await page.goto("/issues");

      // Wait for issues to load
      await expect(
        page.getByRole("heading", { name: "All Issues" })
      ).toBeVisible();

      // Check if bottom pagination buttons exist
      const bottomPrevButton = page.getByTestId("bottom-prev-page");
      const bottomNextButton = page.getByTestId("bottom-next-page");

      await expect(bottomPrevButton).toBeVisible();
      await expect(bottomNextButton).toBeVisible();

      // If there are multiple pages, test navigation
      const nextButton = page.getByTestId("bottom-next-page");
      const isNextDisabled = await nextButton.isDisabled();

      if (!isNextDisabled) {
        // The pagination button is present in the SSR'd DOM before React
        // attaches its router.push() handler. Retry the click until the URL
        // changes — this naturally handles any hydration delay without
        // relying on networkidle.
        await expect(async () => {
          if (new URL(page.url()).searchParams.get("page") !== "2") {
            await nextButton.click();
          }
          await expect
            .poll(() => new URL(page.url()).searchParams.get("page"), {
              timeout: 3000,
            })
            .toBe("2");
        }).toPass({ timeout: 30000 });

        // Previous button should now be enabled
        await expect(bottomPrevButton).toBeEnabled();

        // Click previous page
        await bottomPrevButton.click();

        // Should be back on page 1
        await page.waitForURL(/\/issues(?:\?.*)?$/);
      } else {
        // If only one page, previous should be disabled
        await expect(bottomPrevButton).toBeDisabled();
      }
    });
  });
});
