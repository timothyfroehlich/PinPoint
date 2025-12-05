import { expect, type Page } from "@playwright/test";
import { TEST_USERS } from "./constants.js";

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
    email = TEST_USERS.member.email,
    password = TEST_USERS.member.password,
  }: LoginOptions = {}
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByTestId("sidebar")).toBeVisible();
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
  await page.waitForLoadState("domcontentloaded");

  // Check for authenticated indicator (User Menu)
  const userMenu = page.getByTestId("user-menu-button");
  if (!(await userMenu.isVisible())) {
    await loginAs(page, options);
  }

  // Now assert we are truly logged in
  await expect(page.getByTestId("sidebar")).toBeVisible();
  // Double check user menu
  await expect(page.getByTestId("user-menu-button")).toBeVisible();
  await expect(page.getByTestId("sidebar")).toBeVisible();
}

/**
 * Logs out the current user via the User Menu.
 */
export async function logout(page: Page): Promise<void> {
  console.log("Logging out...");
  const userMenu = page.getByTestId("user-menu-button");
  await expect(userMenu).toBeVisible({ timeout: 5000 });
  await userMenu.click();

  const signOutItem = page.getByRole("menuitem", { name: "Sign Out" });
  await expect(signOutItem).toBeVisible({ timeout: 5000 });
  await signOutItem.click();

  console.log("Waiting for public dashboard...");
  // Wait for redirect to public dashboard
  // Increased timeout to account for potential Supabase delays
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
  await expect(page.getByTestId("nav-signin")).toBeVisible({ timeout: 15000 });
  console.log("Logout complete.");
}
