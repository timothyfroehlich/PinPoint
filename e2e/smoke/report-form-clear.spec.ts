/**
 * E2E Tests for Report Form Clearing After Submission
 *
 * Bug: The /report form does not clear after successful submission.
 * For authenticated users, the server action redirects before ActionState
 * returns, so the client-side localStorage cleanup never fires.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state";
import { cleanupTestEntities } from "../support/cleanup";
import {
  fillReportForm,
  submitFormAndWaitForRedirect,
} from "../support/page-helpers";

const TITLE_PREFIX = "E2E Form Clear";

test.describe("Report Form Clears After Submission", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test.afterEach(async ({ request }) => {
    await cleanupTestEntities(request, {
      issueTitlePrefix: TITLE_PREFIX,
    });
  });

  test("should clear form fields when authenticated user navigates back to /report after submission", async ({
    page,
  }) => {
    // 1. Go to report page and fill the form
    await page.goto("/report");
    await expect(
      page.getByRole("heading", { name: "Report an Issue" })
    ).toBeVisible();

    const select = page.getByTestId("machine-select");
    await expect(select).toBeVisible();
    await select.selectOption({ index: 1 });
    await expect(page).toHaveURL(/machine=/);

    const issueTitle = `${TITLE_PREFIX} ${Date.now()}`;
    await fillReportForm(page, {
      title: issueTitle,
      description: "This description should not persist after submission.",
    });

    // 2. Submit the form — authenticated users redirect to issue detail page
    await submitFormAndWaitForRedirect(
      page,
      page.getByRole("button", { name: "Submit Issue Report" }),
      { awayFrom: "/report" }
    );

    // Verify we landed on the issue detail page
    await expect(page).toHaveURL(/\/m\/.*\/i\/\d+/);

    // 3. Navigate back to the report page
    await page.goto("/report");
    await expect(
      page.getByRole("heading", { name: "Report an Issue" })
    ).toBeVisible();

    // 4. Assert form is cleared — title should be empty
    const titleInput = page.getByLabel("Issue Title *");
    await expect(titleInput).toHaveValue("");

    // 5. Assert localStorage draft was cleared
    const draft = await page.evaluate(() =>
      window.localStorage.getItem("report_form_state")
    );
    // Draft should either be null or contain empty/default values
    if (draft !== null) {
      const parsed = JSON.parse(draft);
      expect(parsed.title).toBeFalsy();
      expect(parsed.description).toBeNull();
    }
  });
});
