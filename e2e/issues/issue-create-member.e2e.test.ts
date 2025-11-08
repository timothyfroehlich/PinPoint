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
    await expect(page.locator("h1")).toContainText("Create New Issue");
    await expect(page.getByTestId("create-issue-form")).toBeVisible();

    // Fill in the form
    await page.getByTestId("issue-title-input").fill("Test Member Issue");
    await page
      .getByTestId("issue-description-input")
      .fill("Detailed description of the issue");

    // Select a machine - using the select trigger
    await page.getByTestId("machine-select-trigger").click();
    await page
      .getByTestId("machine-option")
      .filter({ hasText: "Medieval Madness" })
      .first()
      .click();

    // Submit the form
    await page.getByTestId("create-issue-submit").click();

    // Verify success - wait for redirect (Server Action may take a moment)
    await page.waitForURL(/\/issues\/[^/]+$/, { timeout: 10000 });

    // Verify we're on an issue detail page
    await expect(page).toHaveURL(/\/issues\/[^/]+$/);
  });

  test("validation shows inline errors for missing required fields", async ({
    page,
  }) => {
    await page.goto("/issues/create");

    // Try to submit without filling required fields
    await page.getByTestId("create-issue-submit").click();

    // Verify validation errors appear in the field errors list
    const fieldErrors = page.getByTestId("create-issue-field-errors");
    await expect(fieldErrors).toBeVisible();

    // Check that errors mention both required fields
    await expect(fieldErrors).toContainText(/title/i);
    await expect(fieldErrors).toContainText(/machine/i);

    // Verify we're still on the create page
    await expect(page).toHaveURL("/issues/create");

    // Fill title but leave machine empty
    await page.getByTestId("issue-title-input").fill("Valid title");
    await page.getByTestId("create-issue-submit").click();

    // Field errors should still be visible but only for machine now
    await expect(fieldErrors).toBeVisible();
    await expect(fieldErrors).toContainText(/machine/i);
    await expect(fieldErrors).not.toContainText(/title/i);
  });

  test("member can see private-location machines when organization member", async ({
    page,
  }) => {
    await page.goto("/issues/create");

    // Verify machine select trigger is visible
    const machineTrigger = page.getByTestId("machine-select-trigger");
    await expect(machineTrigger).toBeVisible();

    // Open the select dropdown
    await machineTrigger.click();

    // Verify private machines are visible to organization members
    // Using testid machine-option and filtering by text
    const medievalOption = page
      .getByTestId("machine-option")
      .filter({ hasText: /Medieval Madness/i });
    const cactusOption = page
      .getByTestId("machine-option")
      .filter({ hasText: /Cactus Canyon/i });

    await expect(medievalOption.first()).toBeVisible();
    await expect(cactusOption.first()).toBeVisible();

    // Verify we can select a private machine
    await medievalOption.first().click();

    // Verify selection was made by checking the hidden input value
    await expect(page.getByTestId("machineId-hidden")).toHaveValue(
      SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    );
  });

  test("member can see and select severity field", async ({ page }) => {
    await page.goto("/issues/create");

    // Verify severity select is visible
    const severityTrigger = page.getByTestId("severity-select-trigger");
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
    await expect(page.getByTestId("severity-hidden")).toHaveValue("high");
  });
});
