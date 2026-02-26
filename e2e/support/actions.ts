import {
  expect,
  type Page,
  type TestInfo,
  type Locator,
} from "@playwright/test";
import { TEST_USERS } from "./constants.js";

/**
 * Returns the visible user-menu trigger regardless of viewport.
 *
 * On desktop the trigger lives in the desktop header (data-testid="user-menu-button").
 * On mobile it lives in the compact header (data-testid="mobile-user-menu-button").
 * Both are always in the DOM; the filter ensures we get the visible one.
 */
function visibleUserMenu(page: Page) {
  return page
    .locator(
      '[data-testid="user-menu-button"],[data-testid="mobile-user-menu-button"]'
    )
    .filter({ visible: true });
}

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
    await expect(page.getByTestId("mobile-header")).toBeVisible();
  } else {
    await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
  }

  // Wait for user menu to hydrate before continuing
  // This prevents race conditions when tests immediately call logout()
  await expect(visibleUserMenu(page)).toBeVisible();
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

  // Check for authenticated indicator (User Menu — works on both mobile and desktop viewports)
  if (!(await visibleUserMenu(page).isVisible())) {
    await loginAs(page, testInfo, options);
  }

  // Use project name to determine mobile vs desktop layout
  const isMobile = testInfo.project.name.includes("Mobile");

  // Assert we are truly logged in
  if (isMobile) {
    await expect(page.getByTestId("mobile-header")).toBeVisible();
  } else {
    await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
  }
  // Double check user menu
  await expect(visibleUserMenu(page)).toBeVisible();
}

/**
 * Logs out the current user via the User Menu.
 */
export async function logout(page: Page): Promise<void> {
  const userMenu = visibleUserMenu(page);
  await expect(userMenu).toBeVisible({ timeout: 10000 });
  await userMenu.click();

  const signOutItem = page.getByRole("menuitem", { name: "Sign Out" });
  await expect(signOutItem).toBeVisible({ timeout: 5000 });
  await signOutItem.click();

  // Wait for redirect to public dashboard
  // Increased timeout to account for potential Supabase delays
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
  // Sign-in button appears in either mobile header or desktop header depending on viewport
  const signIn = page
    .locator('[data-testid="nav-signin"],[data-testid="mobile-nav-signin"]')
    .filter({ visible: true });
  await expect(signIn).toBeVisible({ timeout: 15000 });
}

/**
 * No-op: The hamburger sidebar has been replaced by a bottom tab bar
 * on mobile (see design/phase3-bottom-tabs). Navigation links are now
 * accessible directly via the tab bar without opening a drawer.
 */
export async function openSidebarIfMobile(
  _page: Page,
  _testInfo: TestInfo
): Promise<void> {
  // No-op — mobile navigation is handled by the bottom tab bar
}

/**
 * Returns the visible issue search input for the current viewport.
 *
 * The issues list page renders two search inputs — one for desktop
 * (`data-testid="issue-search"`) and one for mobile
 * (`data-testid="mobile-issues-search"`). Both are always in the DOM;
 * CSS hides the inactive one. Playwright strict mode rejects
 * `getByPlaceholder("Search issues...")` because it finds both.
 *
 * Use this helper instead of `getByPlaceholder("Search issues...")`.
 */
export function getIssueSearchInput(page: Page, testInfo: TestInfo): Locator {
  const isMobile = testInfo.project.name.includes("Mobile");
  return isMobile
    ? page.getByTestId("mobile-issues-search")
    : page.getByTestId("issue-search");
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
