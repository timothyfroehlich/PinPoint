import { test, expect } from "@playwright/test";
import { loginAs, selectOption } from "../support/actions";
import { cleanupTestEntities } from "../support/cleanup";
import { seededMachines } from "../support/constants";
import { fillReportForm } from "../support/page-helpers";

test.describe("Status Overhaul E2E", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.setTimeout(60000);
    await loginAs(page, testInfo);
  });

  test.afterEach(async ({ request }) => {
    await cleanupTestEntities(request, {
      issueTitlePrefix: "E2E Status Overhaul Test",
    });
  });

  test("should create issue and verify all 4 badges", async ({ page }) => {
    const machine = seededMachines.addamsFamily;

    // 1. Create Issue
    await page.goto(`/report?machine=${machine.initials}`);
    await page.getByTestId("machine-select").selectOption(machine.id);
    await fillReportForm(page, {
      title: "E2E Status Overhaul Test",
      severity: "major",
      priority: "high",
      frequency: "frequent",
    });
    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // 2. Verify redirect and badges
    await expect(page).toHaveURL(/\/m\/TAF\/i\/[0-9]+/);

    await expect(page.getByTestId("issue-status-badge")).toHaveText(/New/i);
    await expect(page.getByTestId("issue-severity-badge")).toHaveText(/Major/i);
    await expect(page.getByTestId("issue-priority-badge")).toHaveText(/High/i);
    await expect(page.getByTestId("issue-frequency-badge")).toHaveText(
      /Frequent/i
    );

    // 3. Update Status
    await selectOption(page, "issue-status-select", "in_progress");

    // 4. Verify status change in badge and timeline
    await expect(page.getByTestId("issue-status-badge")).toHaveText(
      /In Progress/i
    );
    await expect(
      page.getByText("Status changed from New to In Progress")
    ).toBeVisible();
  });
});
