/**
 * E2E – Anonymous Issue Creation via QR – Test Skeleton (Playwright)
 *
 * Covers the QR flow: redirect from /api/qr/[qrCodeId] to report page, submit
 * minimal anonymous report, confirm success; verify anonymous cannot edit or
 * attach after creation.
 *
 * Use:
 * - Stable data-testids from the UI Spec in docs/feature_specs/issue-creation.md
 * - Known QR code → machine mapping via SEED_TEST_IDS (or a test QR fixture)
 * - Enforce anonymous context (no logged-in session) during run
 */

import { test, expect } from "@playwright/test";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

test.describe("Issue Create – Anonymous via QR (E2E)", () => {
  test("QR redirect leads to report page for the machine", async ({ page }) => {
    // Navigate to QR code URL
    await page.goto(`/api/qr/${SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1}`);

    // Should redirect to machine report page
    await expect(page).toHaveURL(/\/machines\/.*\/report-issue/);

    // Verify machine information is displayed
    await expect(page.getByTestId("machine-name")).toBeVisible();
    await expect(page.getByTestId("issue-form")).toBeVisible();
  });

  test("anonymous can submit a minimal report successfully", async ({ page }) => {
    // Navigate directly to machine report page
    await page.goto(`/machines/${SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1}/report-issue`);

    // Fill in required fields
    await page.getByTestId("title-input").fill("Machine making loud noise");
    await page.getByTestId("description-input").fill("The machine is making a loud buzzing sound");
    await page.getByTestId("reporter-email-input").fill("reporter@example.com");

    // Submit the form
    await page.getByTestId("submit-button").click();

    // Verify success
    await expect(page.getByTestId("success-message")).toBeVisible();
    await expect(page.getByTestId("success-message")).toContainText("Issue created successfully");
  });

  test("anonymous cannot edit the issue after creation", async ({ page }) => {
    // First create an issue (assuming we have a created issue ID)
    await page.goto(`/machines/${SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1}/report-issue`);
    await page.getByTestId("title-input").fill("Test Issue");
    await page.getByTestId("reporter-email-input").fill("test@example.com");
    await page.getByTestId("submit-button").click();

    // Extract issue ID from success page or URL
    const issueId = SEED_TEST_IDS.ISSUES.KAIJU_FIGURES; // Mock ID for test

    // Try to navigate to issue edit page
    await page.goto(`/issues/${issueId}/edit`);

    // Should be redirected to unauthorized page or show error
    await expect(page.getByTestId("unauthorized-message")).toBeVisible();
    // OR expect to be redirected to login page
    // await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("anonymous cannot attach files post-creation", async ({ page }) => {
    // Navigate to issue detail page after creation
    const issueId = SEED_TEST_IDS.ISSUES.KAIJU_FIGURES; // Mock created issue ID
    await page.goto(`/issues/${issueId}`);

    // Verify attachment upload section is not visible for anonymous users
    await expect(page.getByTestId("attachment-upload")).not.toBeVisible();

    // OR verify upload button shows login requirement
    const uploadSection = page.getByTestId("attachment-section");
    await expect(uploadSection).toContainText("Sign in to attach files");
  });
});
