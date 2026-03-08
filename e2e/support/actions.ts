import { expect, type Page, type TestInfo } from "@playwright/test";

import { TEST_USERS } from "./constants.js";

/**
 * Returns the visible user-menu trigger regardless of viewport.
 *
 * On desktop the trigger lives in the sidebar. On mobile it lives
 * in the bottom tab bar (or top header in older designs).
 */
export function visibleUserMenu(page: Page) {
  // Try to find the user menu button in both possible locations
  // data-testid="user-menu-button" (Desktop sidebar)
  // data-testid="mobile-user-menu-button" (Mobile tab bar)
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
 * Shared E2E action to perform a UI login.
 *
 * @param page Playwright page object
 * @param testInfo Playwright test info (used for viewport detection)
 * @param options Login credentials (defaults to member)
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

  // Fill out login form
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);

  // Submit form
  await page.getByRole("button", { name: "Sign In" }).click();

  // Local env has enable_confirmations = false, so we are redirected to dashboard immediately.
  // Wait for networkidle to ensure hydration is complete before any subsequent actions.
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

  await assertLayoutReady(page, testInfo);

  // Force a full server round-trip to ensure auth cookies are settled.
  // Under concurrent load (3+ Playwright workers), Supabase cookie rotation
  // (refresh token exchange) may not be fully committed by the time the NEXT
  // navigation fires. Reloading the dashboard forces the browser to send the
  // auth cookie back to the server, completing the rotation cycle. Without
  // this, Server Actions on subsequent pages can see a stale/missing cookie
  // and treat the user as anonymous.
  await page.reload({ waitUntil: "networkidle" });
  // Confirm the reload kept us on /dashboard (not redirected to /login by middleware).
  // A redirect here means the reload itself raced with cookie rotation — surface it clearly.
  await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  await expect(visibleUserMenu(page)).toBeVisible({ timeout: 10000 });
}

/**
 * Asserts the dashboard layout (sidebar/header + user menu) is ready.
 */
async function assertLayoutReady(
  page: Page,
  testInfo: TestInfo
): Promise<void> {
  const isMobile = testInfo.project.name.includes("Mobile");

  if (isMobile) {
    await expect(page.getByTestId("mobile-header")).toBeVisible();
  } else {
    await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
  }

  await expect(visibleUserMenu(page)).toBeVisible();
}

/**
 * Ensures a test page is authenticated. If not, logs in automatically.
 */
export async function ensureLoggedIn(
  page: Page,
  testInfo: TestInfo,
  options?: LoginOptions
): Promise<void> {
  await page.goto("/dashboard");
  // Use networkidle (not domcontentloaded) so React has finished hydrating before we
  // check for the user menu. Checking too early gives a false-negative and triggers
  // an unnecessary loginAs, which then runs the cookie-settling reload.
  await page.waitForLoadState("networkidle");

  // Check for authenticated indicator (User Menu — works on both mobile and desktop viewports)
  if (!(await visibleUserMenu(page).isVisible())) {
    await loginAs(page, testInfo, options);
    return;
  }

  await assertLayoutReady(page, testInfo);
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
 * Selects an option from a shadcn/ui Select component.
 * Clicks the trigger, waits for the dropdown, then clicks the option.
 */
export async function selectOption(
  page: Page,
  triggerTestId: string,
  optionValue: string
): Promise<void> {
  // Mapping of trigger test IDs to option test ID patterns
  const triggerToOptionTestIdMap: Record<
    string,
    ((value: string) => string) | undefined
  > = {
    "issue-status-select": (val) => `status-option-${val}`,
    "issue-severity-select": (val) => `severity-option-${val}`,
    "issue-priority-select": (val) => `priority-option-${val}`,
    "issue-frequency-select": (val) => `frequency-option-${val}`,
    "issue-assignee-select": (val) => `assignee-option-${val}`,
    "machine-select": (val) => `machine-option-${val}`,
    "filter-status": (val) => `status-option-${val}`,
    "filter-machine": (val) => `machine-option-${val}`,
    "filter-owner": (val) => `owner-option-${val}`,
    "filter-sort": (val) => `sort-option-${val}`,
  };

  const getOptionTestId = triggerToOptionTestIdMap[triggerTestId];
  if (getOptionTestId === undefined) {
    throw new Error(`Unknown select trigger: ${triggerTestId}`);
  }

  // Click the select trigger
  const trigger = page.getByTestId(triggerTestId);
  await expect(trigger).toBeVisible();
  await trigger.click();

  // Wait for the option to be visible in the popover
  const optionTestId = getOptionTestId(optionValue);
  const option = page.getByTestId(optionTestId);

  // Use force: true because shadcn/ui Select uses a portal where Radix Select dropdown options
  // can be positioned outside the viewport despite being visible in the DOM
  await option.click({ force: true });

  // Wait for dropdown to close
  await expect(option).toBeHidden({ timeout: 5000 });
}
