/**
 * Auth Setup — Playwright Setup Project
 *
 * Logs in once per role and saves storageState to disk. Browser projects
 * declare `dependencies: ["auth-setup"]` so this runs before any test.
 *
 * Usage in tests (opt-in):
 *   import { STORAGE_STATE } from "./support/auth-state";
 *   test.use({ storageState: STORAGE_STATE.member });
 *
 * Exclude criteria (do NOT use storageState):
 *   - Auth flow tests (login, signup, password reset)
 *   - Public route tests (no login required)
 *   - Multi-role tests (use loginAs for mid-test role switches)
 *   - Dynamic user tests (user created at runtime via createTestUser)
 */

import { mkdirSync } from "fs";
import { dirname } from "path";
import { expect, type Page, test as setup } from "@playwright/test";

import { TEST_USERS } from "./support/constants";
import { STORAGE_STATE } from "./support/auth-state";

/**
 * Logs in via UI and saves storageState to disk.
 *
 * Replicates the cookie-settling reload from loginAs() in actions.ts.
 * Must be kept in sync if the login flow changes.
 */
async function loginAndSave(
  page: Page,
  email: string,
  password: string,
  path: string
): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });

  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
  await expect(page.getByTestId("app-header")).toBeVisible();
  await expect(page.getByTestId("user-menu-button")).toBeVisible();

  // Force a full server round-trip to settle Supabase cookie rotation.
  // See the comment in loginAs() in actions.ts for the full explanation.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

  await page.context().storageState({ path });
}

setup("authenticate as admin", async ({ page }) => {
  await loginAndSave(
    page,
    TEST_USERS.admin.email,
    TEST_USERS.admin.password,
    STORAGE_STATE.admin
  );
});

setup("authenticate as member", async ({ page }) => {
  await loginAndSave(
    page,
    TEST_USERS.member.email,
    TEST_USERS.member.password,
    STORAGE_STATE.member
  );
});

setup("authenticate as technician", async ({ page }) => {
  await loginAndSave(
    page,
    TEST_USERS.technician.email,
    TEST_USERS.technician.password,
    STORAGE_STATE.technician
  );
});
