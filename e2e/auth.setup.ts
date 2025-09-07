import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

setup("authenticate as Tim dev user", async ({ page }) => {
  console.log("Setting up authentication for Tim dev user...");

  // Calculate BASE_URL using same logic as playwright.config.ts
  const PORT = process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? "3000";
  const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

  // Go directly to sign-in page on the correct subdomain
  await page.goto(`${BASE_URL}/auth/sign-in`);
  await expect(page.locator("h1")).toContainText(/Welcome back|Sign In/i);

  // Handle organization selection
  const orgTrigger = page.locator("[data-testid='org-select-trigger']");
  await expect(orgTrigger).toBeVisible({ timeout: 15000 });

  // Ensure an organization is selected
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

  // Click dev login button
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

  // Wait for successful login and dashboard redirect
  await page.waitForURL("**/dashboard", { timeout: 20000 });

  // Navigate back to localhost (without subdomain) to ensure tests run on correct domain
  await page.goto(`${BASE_URL}/dashboard`);

  // Verify we're logged in successfully
  await expect(page.locator("h1")).toContainText(/Dashboard|Issues|Machines/i);

  console.log("Authentication successful, saving state...");

  // Save signed-in state to 'e2e/.auth/user.json'
  await page.context().storageState({ path: authFile });

  console.log("Authentication state saved to", authFile);
});
