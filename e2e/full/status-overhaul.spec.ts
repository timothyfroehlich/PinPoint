import { test, expect } from "@playwright/test";
import { updateIssueField, visibleIssueFieldControl } from "../support/actions";
import { cleanupTestEntities } from "../support/cleanup";
import { seededMachines, TEST_USERS } from "../support/constants";
import { fillReportForm } from "../support/page-helpers";
import { STORAGE_STATE } from "../support/auth-state";

test.describe("Status Overhaul E2E", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test.beforeEach(() => {
    test.setTimeout(60000);
  });

  test.afterEach(async ({ request }) => {
    await cleanupTestEntities(request, {
      issueTitlePrefix: "E2E Status Overhaul Test",
    });
  });

  test("should create issue and verify all 4 badges", async ({ page }) => {
    test.fixme(
      true,
      "PP-v7g — Radix Select portal mount timing under CI load; awaiting verification of PP-awg/#1280 absorption"
    );
    const machine = seededMachines.addamsFamily;

    // 1. Create Issue
    await page.goto(`/report?machine=${machine.initials}`);

    // Verify the page rendered with authenticated state before filling the form.
    // The priority select is only visible for members/admins, so its presence
    // confirms the server component saw the auth cookie correctly.
    await expect(page.getByTestId("issue-priority-select")).toBeVisible();

    await page.getByTestId("machine-select").selectOption(machine.id);
    await fillReportForm(page, {
      title: "E2E Status Overhaul Test",
      severity: "unplayable",
      priority: "high",
      frequency: "frequent",
    });
    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // 2. Verify redirect and badges
    // Use a generous timeout: Server Action redirects can be slow on Mobile Chrome
    // in CI due to cookie propagation timing.
    await expect(page).toHaveURL(/\/m\/TAF\/i\/[0-9]+/, { timeout: 30000 });

    await expect(visibleIssueFieldControl(page, "status")).toContainText(
      /New/i
    );
    await expect(visibleIssueFieldControl(page, "severity")).toContainText(
      /Unplayable/i
    );
    await expect(visibleIssueFieldControl(page, "priority")).toContainText(
      /High/i
    );
    await expect(visibleIssueFieldControl(page, "frequency")).toContainText(
      /Frequent/i
    );

    // 3. Update Status
    await updateIssueField(page, "status", "in_progress");

    // 4. Verify status change in badge and timeline
    await expect(visibleIssueFieldControl(page, "status")).toContainText(
      /In Progress/i
    );
    // 5. Verify actor attribution on the system timeline event
    const statusEvent = page.getByText(
      "Status changed from New to In Progress"
    );
    await expect(statusEvent).toBeVisible();

    // The system event should show who made the change
    const systemEventRow = statusEvent.locator("..");
    await expect(systemEventRow.getByTestId("system-event-actor")).toHaveText(
      TEST_USERS.member.name
    );
  });
});
