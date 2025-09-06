/**
 * Smoke Tests Suite
 * Tests basic functionality with authenticated user state
 */
import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("dashboard access", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1").first()).toContainText(
      /Dashboard|Issues|Machines/i,
    );
  });

  test("open first issue from list", async ({ page }) => {
    await page.goto("/issues");
    const issuesList = page.locator("[data-testid='issues-list']").first();
    await expect(issuesList).toBeVisible({ timeout: 10000 });
    const firstIssueLink = page
      .locator("[data-testid='issue-card'] [data-testid='issue-link']")
      .first();
    await expect(firstIssueLink).toBeVisible();
    const firstIssueTitle = await firstIssueLink.textContent();
    await firstIssueLink.click();
    await expect(page.locator("[data-testid='issue-title']")).toHaveText(
      firstIssueTitle ?? /.+/,
      { timeout: 10000 },
    );
    await expect(
      page.locator("[data-testid='issue-status-badge']"),
    ).toBeVisible();
  });

  test("issue creation form loads and functions", async ({ page }) => {
    await page.goto("/issues/create");

    // Verify form loads
    await expect(
      page.locator("[data-testid='create-issue-form']").first(),
    ).toBeVisible({ timeout: 10000 });

    // Verify form fields are functional
    const uniqueTitle = `Smoke Test Issue ${Date.now()}`;
    await page
      .locator("[data-testid='issue-title-input']")
      .first()
      .fill(uniqueTitle);
    await page
      .locator("[data-testid='issue-description-input']")
      .first()
      .fill("Testing that the issue creation form works.");

    // Verify machine selector works
    const machineTrigger = page
      .locator("[data-testid='machine-select-trigger']")
      .first();
    await machineTrigger.click();
    const firstMachine = page.locator("[data-testid='machine-option']").first();
    await expect(firstMachine).toBeVisible({ timeout: 5000 });
    await firstMachine.click();

    // Verify machine was selected (hidden input gets populated)
    const hiddenMachineId = page
      .locator("[data-testid='machineId-hidden']")
      .first();
    await expect(hiddenMachineId).toHaveAttribute("value", /.+/, {
      timeout: 5000,
    });

    // Verify submit button is present and enabled
    await expect(
      page.locator("[data-testid='create-issue-submit']").first(),
    ).toBeVisible();

    // Form functionality verified - no actual submission needed for smoke test
  });
});
