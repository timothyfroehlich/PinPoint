import { existsSync, promises as fs } from "node:fs";
/**
 * Auth Setup for E2E Tests - Alpha Single-Org Mode
 * Simplified to work without org selection
 */

import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

setup("authenticate as Tim dev user", async ({ page }) => {
  console.log("Setting up authentication for Tim dev user...");

  if (existsSync(authFile)) {
    await fs.unlink(authFile);
  }

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.warn(`[auth.setup] Browser console error: ${msg.text()}`);
    }
  });

  // Calculate BASE_URL using same logic as playwright.config.ts
  const PORT = process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? "3000";
  const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

  // Note: Database health is verified in global-setup.ts
  // This test focuses solely on authentication
  await page.goto(`${BASE_URL}/auth/sign-in`);
  await expect(page.locator("h1")).toContainText(/Welcome back|Sign In/i, {
    timeout: 10000,
  });

  // Alpha: No org selection needed, just click dev login
  const devLoginBtn = page.locator("[data-testid='dev-login-tim']").first();
  await expect(devLoginBtn).toBeVisible({ timeout: 10000 });

  // Click dev login button
  let clicked = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await devLoginBtn.click();
      clicked = true;
      break;
    } catch {
      await page.waitForTimeout(150);
    }
  }
  if (!clicked) {
    await devLoginBtn.click({ force: true });
  }

  // Wait for successful login and dashboard redirect
  await page.waitForURL("**/dashboard", { timeout: 20000 });

  // Verify we're logged in successfully
  await expect(page.locator("h1")).toContainText(/Dashboard|Issues|Machines/i, {
    timeout: 10000,
  });

  console.log("Authentication successful, saving state...");

  const cookies = await page.context().cookies();
  const hasSupabaseAuth = cookies.some(
    (cookie) =>
      cookie.name.startsWith("sb-") && cookie.name.endsWith("auth-token"),
  );
  if (!hasSupabaseAuth) {
    throw new Error(
      "Authentication succeeded but Supabase auth cookie missing.",
    );
  }

  // Save signed-in state to 'e2e/.auth/user.json'
  await page.context().storageState({ path: authFile });

  console.log("Authentication state saved to", authFile);
});
