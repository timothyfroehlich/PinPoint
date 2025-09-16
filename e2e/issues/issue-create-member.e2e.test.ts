import { test, expect } from "@playwright/test";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

test.describe("E2E: Member Issue Creation", () => {
  test.use({ storageState: "e2e/.auth/chromium-auth.json" });

  test("Success path: fill fields, choose machine, submit, and verify issue creation", async ({
    page,
  }) => {
    await page.goto("/issues/create");

    const uniqueTitle = `My E2E Test Issue ${Date.now()}`;

    // Fill out the form
    await page.getByTestId("issue-title-input").fill(uniqueTitle);
    await page
      .getByTestId("issue-description-input")
      .fill("This is a test description from an E2E test.");

    // Select a machine
    await page.getByTestId("machine-select-trigger").click();
    await page
      .getByTestId(
        `machine-option-${SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1}`,
      )
      .click();
    await expect(page.getByTestId("machineId-hidden")).toHaveValue(
      SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    );

    // (Optional) Select priority
    await page.getByTestId("priority-select-trigger").click();
    await page.getByTestId("priority-option-high").click();

    // Submit the form
    await page.getByTestId("create-issue-submit").click();

    // Wait for redirect and verify the new issue page
    await page.waitForURL(/\/issues\/issue-.*/);

    await expect(page.getByTestId("issue-title")).toHaveText(uniqueTitle);
    await expect(page.getByTestId("issue-status-badge")).toBeVisible();
  });

  test("Validation: submit with missing title/machine", async ({ page }) => {
    await page.goto("/issues/create");

    // Attempt to submit without filling required fields
    await page.getByTestId("create-issue-submit").click();

    // Check for field errors
    const fieldErrors = page.getByTestId("create-issue-field-errors");
    await expect(fieldErrors).toBeVisible();
    await expect(fieldErrors).toContainText("Title is required");
    await expect(fieldErrors).toContainText("Machine is required");

    // Ensure no redirect happened
    await expect(page).toHaveURL("/issues/create");
  });

  test("Visibility: assert that machine list is non-empty for members", async ({
    page,
  }) => {
    await page.goto("/issues/create");

    // Open the machine select dropdown
    await page.getByTestId("machine-select-trigger").click();

    // Check that there is at least one machine option
    const machineOptions = await page.getByTestId(/machine-option-.*/).count();
    expect(machineOptions).toBeGreaterThan(0);
  });
});
