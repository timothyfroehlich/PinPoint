/**
 * E2E Tests for Issue Machine Reassignment (PP-3hb)
 *
 * Verifies the "Move to another machine" kebab action on the issue detail
 * page. NN #11 — every clickable element gets clicked in an E2E test.
 */

import { test, expect, type Page } from "@playwright/test";
import { cleanupTestEntities, extractIdFromUrl } from "../support/cleanup.js";
import { seededMachines } from "../support/constants.js";
import {
  fillReportForm,
  submitFormAndWaitForRedirect,
} from "../support/page-helpers.js";
import { STORAGE_STATE } from "../support/auth-state.js";

const createdIssueIds = new Set<string>();

const rememberIssueId = (page: Page): void => {
  const issueId = extractIdFromUrl(page.url());
  if (issueId) {
    createdIssueIds.add(issueId);
  }
};

async function createIssueOnMachine(
  page: Page,
  machineInitials: string,
  title: string
): Promise<string> {
  await page.goto(`/report?machine=${machineInitials}`);
  await fillReportForm(page, { title, priority: "medium" });
  await submitFormAndWaitForRedirect(
    page,
    page.getByRole("button", { name: "Submit Issue Report" }),
    {
      awayFrom: "/report",
      expectedIssueTitle: title,
    }
  );
  await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);
  rememberIssueId(page);
  return page.url();
}

test.describe("Issue reassignment", () => {
  test.afterEach(async ({ request }) => {
    if (!createdIssueIds.size) return;
    await cleanupTestEntities(request, {
      issueIds: Array.from(createdIssueIds),
    });
    createdIssueIds.clear();
  });

  test.describe("as technician", () => {
    test.use({ storageState: STORAGE_STATE.technician });

    test("moves the issue to a different machine and redirects to the new URL", async ({
      page,
    }) => {
      const fromInitials = seededMachines.addamsFamily.initials;
      const toInitials = seededMachines.humptyDumpty.initials;
      const toName = seededMachines.humptyDumpty.name;
      const issueTitle = `Reassign me ${Date.now().toString()}`;

      await createIssueOnMachine(page, fromInitials, issueTitle);

      // Open the kebab menu in the page header.
      await page.getByTestId("issue-actions-menu-trigger").click();
      await page.getByTestId("issue-actions-menu-reassign").click();

      // Pick the destination machine in the AlertDialog combobox.
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await dialog
        .getByPlaceholder("Search machines…")
        .fill(seededMachines.humptyDumpty.initials);
      await page.getByTestId(`reassign-option-${toInitials}`).click();
      await page.getByTestId("reassign-confirm").click();

      // After success the page navigates to the new URL.
      await page.waitForURL(new RegExp(`/m/${toInitials}/i/[0-9]+$`), {
        timeout: 15_000,
      });

      // Title still matches; the issue is now under the destination machine.
      await expect(
        page
          .getByRole("main")
          .getByRole("heading", { level: 1, name: new RegExp(issueTitle) })
      ).toBeVisible();

      // The eyebrow row's machine link points at the destination.
      await expect(page.getByTestId("machine-link").first()).toHaveAttribute(
        "href",
        `/m/${toInitials}`
      );

      // The timeline records the move with both formatted IDs and machine
      // names (the exact text mirrors formatTimelineEvent).
      await expect(
        page.getByText(
          new RegExp(
            `Moved from ${fromInitials}-[0-9]+ \\(.*\\) to ${toInitials}-[0-9]+ \\(${toName}\\)`
          )
        )
      ).toBeVisible();
    });
  });

  test.describe("as member without machine ownership", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("does not expose the reassign action when the member does not own the machine", async ({
      page,
    }) => {
      // Member is not the owner of TAF in the seed data, so the kebab should
      // be hidden entirely (canReassign is false → IssueActionsMenu returns
      // null).
      const fromInitials = seededMachines.addamsFamily.initials;
      const issueTitle = `Member view ${Date.now().toString()}`;

      await createIssueOnMachine(page, fromInitials, issueTitle);

      await expect(page.getByTestId("issue-actions-menu-trigger")).toHaveCount(
        0
      );
    });
  });
});
