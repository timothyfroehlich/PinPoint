import { test, expect } from "@playwright/test";
import { loginAs, selectOption } from "../support/actions";
import { cleanupTestEntities } from "../support/cleanup";
import { seededMachines, TEST_USERS } from "../support/constants";
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
    const machine = seededMachines.twilightZone;

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
    await expect(page).toHaveURL(/\/m\/TZ\/i\/[0-9]+/, { timeout: 30000 });

    await expect(page.getByTestId("issue-status-badge").first()).toHaveText(
      /New/i
    );
    await expect(page.getByTestId("issue-severity-badge").first()).toHaveText(
      /Unplayable/i
    );
    await expect(page.getByTestId("issue-priority-badge").first()).toHaveText(
      /High/i
    );
    await expect(page.getByTestId("issue-frequency-badge").first()).toHaveText(
      /Frequent/i
    );

    // 3. Update Status
    await selectOption(page, "issue-status-select", "in_progress");

    // 4. Verify status change in badge and timeline
    await expect(page.getByTestId("issue-status-badge").first()).toHaveText(
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
