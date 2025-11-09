/**
 * E2E – Member Issue Creation – Test Skeleton (Playwright)
 *
 * Covers end-to-end member flow: navigate to /issues/create, submit a valid
 * form, see success; verifies validation errors and visibility for private
 * locations as a member.
 *
 * Use:
 * - Stable data-testids from the UI Spec in docs/feature_specs/issue-creation.md
 * - Seed org/user session helpers (login fixtures) if available; otherwise mock auth
 * - SEED_TEST_IDS for deterministic machine choices when necessary
 */

import { test, expect } from "@playwright/test";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Use authenticated context for member tests
test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Issue Create – Member (E2E)", () => {
  test.beforeEach(({}, testInfo) => {
    if (!testInfo.project.name.includes("auth")) {
      testInfo.skip(
        "Member issue creation tests require authenticated storage state project",
      );
    }
  });

  test("member can create an issue via /issues/create", async ({ page }) => {
    // Navigate to issue creation page
    await page.goto("/issues/create");

    // Verify page loaded correctly
    await expect(
      page.getByRole("heading", { level: 1, name: /Create New Issue/i }),
    ).toBeVisible();
    const createIssueForm = page.getByTestId("create-issue-form").first();
    await expect(createIssueForm).toBeVisible();

    // Fill in the form
    await createIssueForm
      .getByTestId("issue-title-input")
      .fill("Test Member Issue");
    await createIssueForm
      .getByTestId("issue-description-input")
      .fill("Detailed description of the issue");

    // Select a machine - using the select trigger
    await page.getByTestId("machine-select-trigger").first().click();
    await page
      .locator(
        `[data-testid="machine-option"][data-machine-id="${SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1}"]`,
      )
      .first()
      .click();

    // Submit the form
    await createIssueForm.getByTestId("create-issue-submit").click();

    // Verify success - wait for redirect (Server Action may take a moment)
    await page.waitForURL(/\/issues\/[^/]+$/, { timeout: 10000 });

    // Verify we're on an issue detail page
    await expect(page).toHaveURL(/\/issues\/[^/]+$/);
  });

  test("validation shows inline errors for missing required fields", async ({
    page,
  }) => {
    await page.goto("/issues/create");
    const createIssueForm = page.getByTestId("create-issue-form").first();
    const titleInput = createIssueForm.getByTestId("issue-title-input");
    const submitButton = createIssueForm
      .getByTestId("create-issue-submit")
      .first();
    const machineHiddenInput = createIssueForm.getByTestId("machine-id-hidden");

    await expect(titleInput).toHaveAttribute("required", "");
    await expect(machineHiddenInput).toHaveAttribute("required", "");

    await submitButton.click();
    await expect
      .poll(async () =>
        titleInput.evaluate((input) => input.validity.valueMissing),
      )
      .toBe(true);

    await titleInput.fill("Valid title");
    await submitButton.click();
    await expect(machineHiddenInput).toHaveValue("");
  });

  test("member can see private-location machines when organization member", async ({
    page,
  }) => {
    await page.goto("/issues/create");

    // Verify machine select trigger is visible
    const formScope = page.getByTestId("create-issue-form").first();
    const machineTrigger = page.getByTestId("machine-select-trigger").first();
    await expect(machineTrigger).toBeVisible();

    // Open the select dropdown
    await machineTrigger.click();

    // Verify private machines are visible to organization members
    // Using testid machine-option and filtering by text
    const medievalOption = page.locator(
      `[data-testid="machine-option"][data-machine-id="${SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1}"]`,
    );
    const cactusOption = page.locator(
      `[data-testid="machine-option"][data-machine-id="${SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1}"]`,
    );

    await expect(medievalOption.first()).toBeVisible();
    await expect(cactusOption.first()).toBeVisible();

    // Verify we can select a private machine
    await medievalOption.first().click();

    // Verify selection was made by checking the hidden input value
    await expect(formScope.getByTestId("machine-id-hidden")).toHaveValue(
      SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    );
  });

  test("member can see and select severity field", async ({ page }) => {
    await page.goto("/issues/create");

    // Verify severity select is visible
    const formScope = page.getByTestId("create-issue-form").first();
    const severityTrigger = page.getByTestId("severity-select-trigger").first();
    await expect(severityTrigger).toBeVisible();

    // Open the severity dropdown
    await severityTrigger.click();

    // Verify all severity options are available
    await expect(page.getByTestId("severity-option-low")).toBeVisible();
    await expect(page.getByTestId("severity-option-medium")).toBeVisible();
    await expect(page.getByTestId("severity-option-high")).toBeVisible();
    await expect(page.getByTestId("severity-option-critical")).toBeVisible();

    // Select "high" severity
    await page.getByTestId("severity-option-high").click();

    // Verify selection was made by checking the hidden input value
    await expect(formScope.getByTestId("severity-hidden")).toHaveValue("high");
  });
});
