/**
 * Authenticated Smoke Tests Suite
 * - Uses pre-cached authentication state
 * - Tests authenticated flows
 */
import { test, expect } from "@playwright/test";

test.describe("Authenticated Smoke Tests", () => {
  test("can access dashboard (already authenticated)", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText(
      /Dashboard|Issues|Machines/i,
    );
  });

  test("can view issues list", async ({ page }) => {
    await page.goto("/issues");
    const issuesList = page.locator("[data-testid='issues-list']").first();
    await expect(issuesList).toBeVisible({ timeout: 10000 });
  });

  test("can open first issue from list", async ({ page }) => {
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

  test("can create issue (authenticated)", async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on("console", (msg) =>
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`),
    );

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

    // Wait for React state flush + hidden input population with a UUID
    const hiddenMachineId = page
      .locator("[data-testid='machineId-hidden']")
      .first();
    await expect(hiddenMachineId).toHaveAttribute("value", /.+/, {
      timeout: 5000,
    });
    const selectedMachineId = await hiddenMachineId.getAttribute("value");
    console.log("Selected machineId:", selectedMachineId);

    // Optionally change priority to High
    try {
      await page.locator("[data-testid='priority-select-trigger']").click();
      const high = page.locator("[data-testid='priority-option-high']");
      if (await high.isVisible({ timeout: 1000 }).catch(() => false)) {
        await high.click();
      }
    } catch {
      // non-fatal
    }

    await page.locator("[data-testid='create-issue-submit']").click();

    // Wait for redirect to issue detail page
    let redirected = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      if (page.url().includes("/issues/issue_")) {
        redirected = true;
        break;
      }
    }
    if (!redirected) {
      // Gather diagnostics
      const errorText = await page
        .locator("[data-testid='create-issue-error']")
        .first()
        .textContent()
        .catch(() => null);
      const fieldErrors = await page
        .locator("[data-testid='create-issue-field-errors']")
        .first()
        .textContent()
        .catch(() => null);
      const formHtml = await page
        .locator("[data-testid='create-issue-form']")
        .evaluate((el) => el.outerHTML)
        .catch(() => "<no form html>");
      console.log("Issue creation did not redirect. Diagnostics:");
      console.log("URL:", page.url());
      console.log("Error Block:", errorText);
      console.log("Field Errors:", fieldErrors);
      console.log("Console Messages:\n" + consoleMessages.join("\n"));
      console.log("Form HTML snippet:", formHtml.slice(0, 1000));
    }
    expect(redirected).toBeTruthy();
    await expect(page.locator("[data-testid='issue-title']")).toContainText(
      uniqueTitle,
      { timeout: 10000 },
    );
  });
});
