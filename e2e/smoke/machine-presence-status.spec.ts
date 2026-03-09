/**
 * E2E Tests: Machine Presence Status
 *
 * Tests the presence status feature: editing via modal, filtering on
 * machine list, presence badge on detail page, and issue list filtering.
 *
 * Uses serial mode because tests build on shared state (machine created
 * in first test, presence changed in second, verified in subsequent tests).
 */

import { test, expect } from "@playwright/test";
import { cleanupTestEntities } from "../support/cleanup";
import { fillReportForm } from "../support/page-helpers";
import { STORAGE_STATE } from "../support/auth-state";

const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
const machineInitials = `P${suffix}`.slice(0, 6);
const machineName = `Presence Test ${suffix}`;
const issueTitlePrefix = `[presence-${suffix}]`;
const issueTitle = `${issueTitlePrefix} hidden by inactive machine filter`;

test.describe("Machine Presence Status", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: STORAGE_STATE.admin });

  test.afterAll(async ({ request }) => {
    await cleanupTestEntities(request, {
      machineInitials: [machineInitials],
      issueTitlePrefix,
    });
  });

  test("create test machine and issue for presence tests", async ({ page }) => {
    await page.goto("/m/new");
    await page.getByLabel(/Initials/i).fill(machineInitials);
    await page.getByLabel(/Machine Name/i).fill(machineName);
    await page.getByRole("button", { name: "Create Machine" }).click();
    await expect(page).toHaveURL(`/m/${machineInitials}`);
    await expect(
      page.getByRole("heading", { name: machineName, exact: true })
    ).toBeVisible();

    // Create an issue while machine is on the floor
    await page.getByTestId("machine-report-issue").click();
    await fillReportForm(page, {
      title: issueTitle,
      severity: "minor",
      frequency: "intermittent",
    });
    await page.getByRole("button", { name: "Submit Issue Report" }).click();
    await expect(page).toHaveURL(new RegExp(`/m/${machineInitials}/i/\\d+$`));
  });

  test("issue is visible in issues list while machine is on the floor", async ({
    page,
  }) => {
    await page.goto("/issues");
    await page.getByPlaceholder("Search issues...").fill(issueTitle);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.searchParams.get("q") === issueTitle);
    await expect(page.getByRole("row", { name: issueTitle })).toBeVisible();
  });

  test("edit modal shows presence dropdown and updates status", async ({
    page,
  }) => {
    await page.goto(`/m/${machineInitials}`);
    await page.getByTestId("edit-machine-button").click();

    const presenceSelect = page.getByRole("combobox", {
      name: "Availability",
    });
    await expect(presenceSelect).toBeVisible();
    await presenceSelect.click();
    await page.getByRole("option", { name: "On Loan", exact: true }).click({
      force: true,
    });
    await expect(presenceSelect).toContainText("On Loan");

    await page.getByRole("button", { name: "Update Machine" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit Machine" })
    ).toBeHidden();
    await page.reload();
    await expect(page.getByText("On Loan").first()).toBeVisible();
    await expect(
      page.getByText("This machine is currently on loan.")
    ).toBeVisible();
  });

  test("detail page shows presence badge and inactive banner", async ({
    page,
  }) => {
    await page.goto(`/m/${machineInitials}`);
    await page.reload();
    await expect(page.getByText("On Loan").first()).toBeVisible();
    await expect(
      page.getByText("This machine is currently on loan.")
    ).toBeVisible();
  });

  test("machine list hides non-floor machines by default", async ({ page }) => {
    await page.goto("/m");
    await expect(
      page.getByRole("link", { name: new RegExp(machineName, "i") })
    ).not.toBeVisible();
  });

  test("presence filter reveals non-floor machines", async ({ page }) => {
    await page.goto("/m");

    const presenceFilter = page
      .getByRole("combobox")
      .filter({ hasText: "Availability" });
    await presenceFilter.click();
    await page.getByRole("option", { name: "On Loan" }).click();
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/presence=.*on_loan/);
    await expect(
      page.getByRole("link", { name: new RegExp(machineName, "i") })
    ).toBeVisible();
  });

  test("issues list excludes issues from inactive machines", async ({
    page,
  }) => {
    await page.goto("/issues");
    await page.getByPlaceholder("Search issues...").fill(issueTitle);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.searchParams.get("q") === issueTitle);
    await expect(page.getByText("No issues found")).toBeVisible();
  });
});
