/**
 * Smoke Tests Suite
 * - Auth login via dev button
 * - Navigate to issues list and open first issue
 */
import { test, expect } from "@playwright/test";

async function devLoginAsTim(page: import("@playwright/test").Page) {
  await page.goto("/");
  const loginLink = page.locator("a[href*='/auth/sign-in']").first();
  if (await loginLink.isVisible().catch(() => false)) {
    await loginLink.click();
  } else {
    await page.locator("text=/Sign in/i").first().click();
  }
  await expect(page.locator("h1")).toContainText(/Welcome back/i);
  const orgTrigger = page.locator("[data-testid='org-select-trigger']");
  await expect(orgTrigger).toBeVisible({ timeout: 10000 });
  // Ensure Austin Pinball Collective selected (open select if needed)
  const triggerText = (await orgTrigger.textContent()) || "";
  if (!/Austin Pinball Collective/i.test(triggerText)) {
    await orgTrigger.click();
    await page
      .locator("[data-testid='org-option-apc']")
      .or(page.locator("[role='option']:has-text('Austin Pinball Collective')"))
      .click();
  }
  await expect(orgTrigger).toContainText(/Austin Pinball Collective/i);
  await page.locator("[data-testid='dev-login-tim']").click();
  // Wait for dashboard
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const url = page.url();
    if (/apc\.localhost:3000\/dashboard|\/dashboard$/.test(url)) break;
  }
  if (!/apc\.localhost:3000\/dashboard|\/dashboard$/.test(page.url())) {
    // Fallback navigate
    await page.goto("/dashboard");
  }
  await expect(page.locator("h1")).toContainText(/Dashboard|Issues|Machines/i);
}

test.describe("Smoke Tests", () => {
  test("login flow (Tim dev user)", async ({ page }) => {
    await devLoginAsTim(page);
  });

  test("open first issue from list", async ({ page }) => {
    await devLoginAsTim(page);
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

  test("issue creation (authenticated)", async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on("console", (msg) =>
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`),
    );
    await devLoginAsTim(page);
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

    // Ensure machineId hidden input populated before submit
    // (Already validated above - keep placeholder for readability)

    await page.locator("[data-testid='create-issue-submit']").click();

    // Wait for redirect to issue detail page
    let redirected = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      if (/\/issues\/issue_/.test(page.url())) {
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
