import { test, expect } from "../support/fixtures.js";
import {
  showIssueSection,
  updateIssueField,
  visibleIssueFieldControl,
  selectMachine,
} from "../support/actions.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import { seededMachines, TEST_USERS } from "../support/constants.js";
import { fillReportForm } from "../support/page-helpers.js";
import { STORAGE_STATE } from "../support/auth-state.js";

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
    const machine = seededMachines.addamsFamily;

    // 1. Create Issue
    await page.goto(`/report/detailed?machine=${machine.initials}`);

    // Verify the page rendered with authenticated state before filling the form.
    // The priority select is only visible for members/admins, so its presence
    // confirms the server component saw the auth cookie correctly.
    await expect(page.getByTestId("issue-priority-select")).toBeVisible();

    await selectMachine(page, machine.id);
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

    // The field rows live in Details (its own tab on phones).
    await showIssueSection(page, "Details");
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

    // 4. Verify the status row shows the new value
    await expect(visibleIssueFieldControl(page, "status")).toContainText(
      /In Progress/i
    );

    // 5. Activity (on the Issue tab on phones) records the change as one
    // system line, attributed to the member who made it.
    await showIssueSection(page, "Issue");
    const statusEvent = page
      .getByTestId("issue-timeline")
      .getByTestId(/^timeline-item-/)
      .filter({
        has: page
          .getByTestId("system-event-text")
          .filter({ hasText: "changed status New → In Progress" }),
      });
    await expect(statusEvent).toBeVisible();
    await expect(statusEvent.getByTestId("system-event-actor")).toHaveText(
      TEST_USERS.member.name
    );
  });
});
