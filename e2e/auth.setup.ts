import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

setup("authenticate as Tim dev user", async ({ page }) => {
  console.log("Setting up authentication for Tim dev user...");
  
  // Go directly to sign-in page
  await page.goto("/auth/sign-in");
  await expect(page.locator("h1")).toContainText(/Welcome back|Sign In/i);
  
  // Handle organization selection
  const orgTrigger = page.locator("[data-testid='org-select-trigger']");
  await expect(orgTrigger).toBeVisible({ timeout: 15000 });

  // Ensure an organization is selected
  let triggerTextInitial = (await orgTrigger.textContent()) || "";
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
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const url = page.url();
    if (/apc\.localhost:3000\/dashboard|\/dashboard$/.test(url)) break;
  }
  
  // Fallback navigate if needed
  if (!/apc\.localhost:3000\/dashboard|\/dashboard$/.test(page.url())) {
    await page.goto("/dashboard");
  }
  
  // Verify we're logged in successfully
  await expect(page.locator("h1")).toContainText(/Dashboard|Issues|Machines/i);
  
  console.log("Authentication successful, saving state...");
  
  // Save signed-in state to 'e2e/.auth/user.json'
  await page.context().storageState({ path: authFile });
  
  console.log("Authentication state saved to", authFile);
});