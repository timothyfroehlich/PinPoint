import { expect, type Page } from "@playwright/test";

import { seededMember } from "./constants";

interface LoginOptions {
  email?: string;
  password?: string;
}

/**
 * Logs in through the UI using the default seeded member (or provided creds).
 */
export async function loginAs(
  page: Page,
  {
    email = seededMember.email,
    password = seededMember.password,
  }: LoginOptions = {}
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

/**
 * Ensures a test page is authenticated. If not, logs in automatically.
 * Useful for scenarios where previous tests logged out the session.
 */
export async function ensureLoggedIn(
  page: Page,
  options?: LoginOptions
): Promise<void> {
  await page.goto("/dashboard");
  // Wait for any redirects or page loads to settle
  await page.waitForLoadState("domcontentloaded");

  if (page.url().includes("/login")) {
    await loginAs(page, options);
    // After login, ensure we land on dashboard and wait for it
    await page.waitForURL("/dashboard");
    await page.waitForLoadState("domcontentloaded");
  }
  // Now assert we are on dashboard
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}
