/**
 * Smoke Tests Suite
 * - Auth login via dev button
 * - Navigate to issues list and open first issue
 */
import { test, expect } from "@playwright/test";

async function devLoginAsTim(page: import("@playwright/test").Page) {
  // Go directly to sign-in page instead of relying on home navigation.
  await page.goto("/auth/sign-in");
  await expect(page.locator("h1")).toContainText(/Welcome back|Sign In/i);
  const orgTrigger = page.locator("[data-testid='org-select-trigger']");
  await expect(orgTrigger).toBeVisible({ timeout: 15000 });

  // Ensure an organization is selected (generic approach). If empty, open and pick first available option.
  const triggerTextInitial = (await orgTrigger.textContent()) ?? "";
  if (!triggerTextInitial.trim()) {
    await orgTrigger.click();
    for (let i = 0; i < 12; i++) {
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible().catch(() => false)) {
        await firstOption.click();
        break;
      }
      await page.waitForTimeout(250);
    }
  }
  // Close any lingering dropdown overlays
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await expect(orgTrigger).toHaveText(/.+/, { timeout: 5000 });

  const devLoginBtn = page.locator("[data-testid='dev-login-tim']");
  await expect(devLoginBtn).toBeVisible({ timeout: 10000 });
  let clicked = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await devLoginBtn.click();
      clicked = true;
      break;
    } catch {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    }
  }
  if (!clicked) {
    await devLoginBtn.click({ force: true });
  }
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
      if (page.url().includes('/issues/issue_')) {
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
