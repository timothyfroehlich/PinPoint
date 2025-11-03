/**
 * Smoke Tests Suite
 * - Uses pre-cached authentication state
 * - Tests core authenticated user flows
 */
import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test.beforeEach(({}, testInfo) => {
    if (!testInfo.project.name.includes("auth")) {
      testInfo.skip("Smoke tests require authenticated storage state project");
    }
  });

  test("dashboard access", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText(
      /Dashboard|Issues|Machines/i,
    );
  });

  test("view issues list", async ({ page }) => {
    await page.goto("/issues");
    const issuesList = page.locator("[data-testid='issues-list']").first();
    await expect(issuesList).toBeVisible({ timeout: 10000 });
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

  test("create issue (authenticated)", async ({ page }) => {
    // Navigate via issues page link to ensure link works
    await page.goto("/issues");
    const createLink = page.locator("a[href='/issues/create']").first();
    await expect(createLink).toBeVisible();
    await createLink.click();
    await expect(page.locator("[data-testid='create-issue-form']")).toBeVisible(
      { timeout: 10000 },
    );

    const uniqueTitle = `Smoke Issue ${Date.now()}`;
    await page.locator("[data-testid='issue-title-input']").fill(uniqueTitle);
    await page
      .locator("[data-testid='issue-description-input']")
      .fill("Automated smoke test issue description.");

    // Select first machine
    const machineTrigger = page.locator(
      "[data-testid='machine-select-trigger']",
    );
    await machineTrigger.click();
    const firstMachine = page.locator("[data-testid='machine-option']").first();
    await expect(firstMachine).toBeVisible({ timeout: 5000 });
    await firstMachine.click();

    // Wait for machine selection to populate hidden input
    const hiddenMachineId = page
      .locator("[data-testid='machineId-hidden']")
      .first();
    await expect(hiddenMachineId).toHaveAttribute("value", /.+/, {
      timeout: 5000,
    });

    await page.locator("[data-testid='create-issue-submit']").click();

    // Wait for redirect to issue detail page using Playwright's built-in waiter
    await page.waitForURL(/\/issues\/issue_/, { timeout: 10000 });

    await expect(page.locator("[data-testid='issue-title']")).toContainText(
      uniqueTitle,
      { timeout: 10000 },
    );
  });
});
