import { expect, type Page, type TestInfo } from "@playwright/test";
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
  testInfo: TestInfo,
  {
    email = TEST_USERS.member.email,
    password = TEST_USERS.member.password,
  }: LoginOptions = {}
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

  // Use project name to determine mobile vs desktop layout
  const isMobile = testInfo.project.name.includes("Mobile");

  if (isMobile) {
    await expect(page.getByTestId("mobile-menu-trigger")).toBeVisible();
  } else {
    await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
  }

  // Wait for user menu to hydrate before continuing
  // This prevents race conditions when tests immediately call logout()
  await expect(page.getByTestId("user-menu-button")).toBeVisible();

  // Ensure server-side auth cookie is present before continuing.
  // Without this, an immediate navigation can render as unauthenticated
  // even when client state appears logged in.
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.some(
        (cookie) =>
          cookie.name.endsWith("-auth-token") && cookie.value.trim().length > 0
      );
    })
    .toBe(true);
}

/**
 * Ensures a test page is authenticated. If not, logs in automatically.
 * Useful for scenarios where previous tests logged out the session.
 */
export async function ensureLoggedIn(
  page: Page,
  testInfo: TestInfo,
  options?: LoginOptions
): Promise<void> {
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");

  // Check for authenticated indicator (User Menu)
  const userMenu = page.getByTestId("user-menu-button");
  if (!(await userMenu.isVisible())) {
    await loginAs(page, testInfo, options);
  }

  // Use project name to determine mobile vs desktop layout
  const isMobile = testInfo.project.name.includes("Mobile");

  // Assert we are truly logged in
  if (isMobile) {
    await expect(page.getByTestId("mobile-menu-trigger")).toBeVisible();
  } else {
    await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
  }
  // Double check user menu
  await expect(page.getByTestId("user-menu-button")).toBeVisible();
}

/**
 * Logs out the current user via the User Menu.
 */
export async function logout(page: Page): Promise<void> {
  const userMenu = page.getByTestId("user-menu-button");
  await expect(userMenu).toBeVisible({ timeout: 10000 });
  await userMenu.click();

  const signOutItem = page.getByRole("menuitem", { name: "Sign Out" });
  await expect(signOutItem).toBeVisible({ timeout: 5000 });
  await signOutItem.click();

  // Wait for redirect to public dashboard
  // Increased timeout to account for potential Supabase delays
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
  await expect(page.getByTestId("nav-signin")).toBeVisible({ timeout: 15000 });
}

/**
 * Opens the mobile sidebar menu if running on a mobile viewport.
 * No-op on desktop viewports where sidebar is always visible.
 */
export async function openSidebarIfMobile(
  page: Page,
  testInfo: TestInfo
): Promise<void> {
  const isMobile = testInfo.project.name.includes("Mobile");
  if (isMobile) {
    await page.getByTestId("mobile-menu-trigger").click();
  }
}

/**
 * Selects an option from a shadcn/ui Select component.
 * Clicks the trigger, waits for the dropdown, then clicks the option.
 */
export async function selectOption(
  page: Page,
  triggerTestId: string,
  optionValue: string
): Promise<void> {
  // Mapping of trigger test IDs to option test ID patterns
  const triggerToOptionTestIdMap: Record<string, (value: string) => string> = {
    "issue-status-select": (value) => `status-option-${value}`,
    "issue-severity-select": (value) => `severity-option-${value}`,
    "issue-priority-select": (value) => `priority-option-${value}`,
    "issue-frequency-select": (value) => `frequency-option-${value}`,
    "severity-select": (value) => `severity-option-${value}`,
    "priority-select": (value) => `priority-option-${value}`,
    "frequency-select": (value) => `frequency-option-${value}`,
  };

  // Get the test ID generator function, or create a default one
  const getOptionTestId =
    triggerToOptionTestIdMap[triggerTestId] ??
    ((value: string) =>
      `${triggerTestId.replace("issue-", "").replace("-select", "")}-option-${value}`);

  // Wait for and click the Select trigger
  // Scroll trigger into view first to help position the dropdown on mobile viewports
  const trigger = page.getByTestId(triggerTestId);
  await expect(trigger).toBeVisible({ timeout: 10000 });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  // Wait for the dropdown to appear and find the option
  const optionTestId = getOptionTestId(optionValue);
  const option = page.getByTestId(optionTestId);
  await expect(option).toBeVisible({ timeout: 5000 });
  // Use force:true for Mobile Chrome where Radix Select dropdown options
  // can be positioned outside the viewport despite being visible in the DOM
  await option.click({ force: true });

  // Wait for dropdown to close
  await expect(option).toBeHidden({ timeout: 5000 });
}
