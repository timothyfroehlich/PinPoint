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
test.use({ storageState: "e2e/.auth/member.json" });

test.describe("Issue Create – Member (E2E)", () => {
  test("member can create an issue via /issues/create", async ({ page }) => {
    // Navigate to issue creation page
    await page.goto("/issues/create");

    // Verify page loaded correctly
    await expect(page.getByTestId("page-title")).toContainText(
      "Create New Issue",
    );
    await expect(page.getByTestId("issue-form")).toBeVisible();

    // Fill in the form
    await page.getByTestId("title-input").fill("Test Member Issue");
    await page
      .getByTestId("description-input")
      .fill("Detailed description of the issue");
    await page
      .getByTestId("machine-select")
      .selectOption(SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1);

    // Submit the form
    await page.getByTestId("submit-button").click();

    // Verify success - should redirect away from create page
    await expect(page).not.toHaveURL("/issues/create");

    // Verify success notification or redirect to issue detail
    await expect(page.getByTestId("success-notification")).toBeVisible();
    // OR verify we're on the issue detail page
    // await expect(page).toHaveURL(/\/issues\/[^\/]+$/);
  });

  test("validation shows inline errors for missing required fields", async ({
    page,
  }) => {
    await page.goto("/issues/create");

    // Try to submit without filling required fields
    await page.getByTestId("submit-button").click();

    // Verify validation errors appear
    await expect(page.getByTestId("title-error")).toBeVisible();
    await expect(page.getByTestId("title-error")).toContainText("title");

    await expect(page.getByTestId("machine-error")).toBeVisible();
    await expect(page.getByTestId("machine-error")).toContainText("machine");

    // Verify we're still on the create page
    await expect(page).toHaveURL("/issues/create");

    // Fill title but leave machine empty
    await page.getByTestId("title-input").fill("Valid title");
    await page.getByTestId("submit-button").click();

    // Title error should disappear, machine error should remain
    await expect(page.getByTestId("title-error")).not.toBeVisible();
    await expect(page.getByTestId("machine-error")).toBeVisible();
  });

  test("member can see private-location machines when organization member", async ({
    page,
  }) => {
    await page.goto("/issues/create");

    // Verify machine select shows options
    const machineSelect = page.getByTestId("machine-select");
    await expect(machineSelect).toBeVisible();

    // Open the select dropdown
    await machineSelect.click();

    // Verify private machines are visible to organization members
    await expect(
      page.getByRole("option", { name: /Medieval Madness/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: /Cactus Canyon/i }),
    ).toBeVisible();

    // Verify we can select a private machine
    await page.getByRole("option", { name: /Medieval Madness/i }).click();
    await expect(machineSelect).toHaveValue(
      SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    );
  });
});
