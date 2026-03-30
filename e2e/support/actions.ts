import { expect, type Page, type TestInfo } from "@playwright/test";

import { TEST_USERS } from "./constants.js";

/**
 * Returns the user-menu trigger.
 *
 * AppHeader is now unified — the same user-menu-button is rendered at all viewports.
 * The isMobile parameter is retained for API compatibility but no longer changes behaviour.
 */
function visibleUserMenu(page: Page, _isMobile?: boolean) {
  return page.getByTestId("user-menu-button");
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
  const isMobile = testInfo.project.name.includes("Mobile");

  // Navigate to login page
  await page.goto("/login");

  // Define possible settled states for the login page
  const emailInput = page.getByLabel("Email");
  const menu = visibleUserMenu(page, isMobile);

  // Wait for the UI to settle into either "ready to login" or "already logged in"
  await expect(emailInput.or(menu)).toBeVisible();

  // If already logged in, we must log out first to ensure we are the correct user
  if (await menu.isVisible()) {
    await logout(page, testInfo);
    await page.goto("/login");
    await expect(emailInput).toBeVisible();
  }

  // Fill and submit login form
  await emailInput.fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);

  // Submit form
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for initial dashboard load
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

  // AppHeader is always rendered (mobile and desktop) — just verify it's visible
  await expect(page.getByTestId("app-header")).toBeVisible();

  // Wait for user menu to hydrate before continuing
  await expect(visibleUserMenu(page, isMobile)).toBeVisible();

  // Force a full server round-trip to ensure auth cookies are settled.
  // Under concurrent load (3+ Playwright workers), Supabase cookie rotation
  // (refresh token exchange) may not be fully committed by the time the NEXT
  // navigation fires. Reloading the dashboard forces the browser to send the
  // auth cookie back to the server, completing the rotation cycle.
  await page.reload({ waitUntil: "networkidle" });

  // Confirm the reload kept us on /dashboard (not redirected to /login by middleware).
  await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  await expect(visibleUserMenu(page, isMobile)).toBeVisible();
}

/**
 * Asserts the dashboard layout (app header + user menu) is ready.
 */
async function assertLayoutReady(page: Page): Promise<void> {
  // AppHeader is unified — same check on all viewports
  await expect(page.getByTestId("app-header")).toBeVisible();
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

  // Define semantic locators for both states (logged-in vs logged-out)
  // AppHeader is unified — same testids on all viewports
  const menu = visibleUserMenu(page);
  const signIn = page.getByTestId("nav-signin");

  // Use a semantic wait: wait for the UI to settle into either state.
  // This avoids false-negatives from hydration races where visibleUserMenu
  // might not be present yet but the user IS logged in.
  await expect(menu.or(signIn)).toBeVisible();

  // If the sign-in button is the one that's visible, we must log in.
  if (await signIn.isVisible()) {
    await loginAs(page, testInfo, options);
    return;
  }

  // Final assertion: verify we are truly logged in and layout is stable
  await assertLayoutReady(page);
}

/**
 * Logs out the current user via the User Menu.
 */
export async function logout(page: Page, testInfo: TestInfo): Promise<void> {
  const userMenu = visibleUserMenu(page);
  await expect(userMenu).toBeVisible();
  await userMenu.click();

  const signOutItem = page.getByTestId("user-menu-signout");
  await expect(signOutItem).toBeVisible();
  await signOutItem.click();

  // Wait for redirect to public dashboard
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

  // Wait for the UI to settle into logged-out state (Sign In button visible)
  // AppHeader is unified — same testid on all viewports
  await expect(page.getByTestId("nav-signin")).toBeVisible({ timeout: 15000 });
}

/**
 * No-op: Navigation uses AppHeader (desktop nav links) + BottomTabBar (mobile).
 * There is no sidebar to open.
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
    "issue-status-trigger": (val) => `status-option-${val}`,
    "issue-severity-select": (val) => `severity-option-${val}`,
    "issue-severity-trigger": (val) => `severity-option-${val}`,
    "issue-priority-select": (val) => `priority-option-${val}`,
    "issue-priority-trigger": (val) => `priority-option-${val}`,
    "issue-frequency-select": (val) => `frequency-option-${val}`,
    "issue-frequency-trigger": (val) => `frequency-option-${val}`,
    "issue-assignee-select": (val) => `assignee-option-${val}`,
    "machine-select": (val) => `machine-option-${val}`,
    "filter-status": (val) => `status-option-${val}`,
    "filter-machine": (val) => `machine-option-${val}`,
    "filter-owner": (val) => `owner-option-${val}`,
    "filter-sort": (val) => `sort-option-${val}`,
    "severity-select": (val) => `severity-option-${val}`,
    "priority-select": (val) => `priority-option-${val}`,
    "frequency-select": (val) => `frequency-option-${val}`,
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
  if (triggerTestId.endsWith("-trigger")) {
    // Drawer items use dispatchEvent — they respond to synthetic clicks.
    // Wait for visibility first so the drawer open animation has completed.
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.dispatchEvent("click");
  } else {
    // Use force: true because shadcn/ui Select uses a portal where Radix Select dropdown options
    // can be positioned outside the viewport despite being visible in the DOM
    await option.click({ force: true });
  }

  // Wait for dropdown to close
  await expect(option).toBeHidden({ timeout: 5000 });
}

type IssueFieldName = "status" | "severity" | "priority" | "frequency";

export function visibleIssueFieldControl(page: Page, field: IssueFieldName) {
  return page
    .locator(
      `[data-testid="issue-${field}-select"],[data-testid="issue-${field}-trigger"]`
    )
    .filter({ visible: true })
    .first();
}

export async function expectIssueFieldEnabled(
  page: Page,
  field: IssueFieldName
): Promise<void> {
  await expect(visibleIssueFieldControl(page, field)).toBeEnabled();
}

export async function expectIssueFieldDisabled(
  page: Page,
  field: IssueFieldName
): Promise<void> {
  await expect(visibleIssueFieldControl(page, field)).toBeDisabled();
}

export async function updateIssueField(
  page: Page,
  field: IssueFieldName,
  value: string
): Promise<void> {
  const control = visibleIssueFieldControl(page, field);
  const testId = await control.getAttribute("data-testid");

  if (!testId) {
    throw new Error(`Missing data-testid for issue ${field} control`);
  }

  await selectOption(page, testId, value);
}

/**
 * Asserts no horizontal overflow on the current page.
 *
 * Compares document.scrollWidth to document.clientWidth. If content is wider
 * than the viewport, the assertion fails with a diagnostic message showing
 * the overflow amount and viewport width.
 */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    result.scrollWidth,
    `Horizontal overflow detected: content is ${result.scrollWidth}px wide ` +
      `but viewport is only ${result.clientWidth}px (${result.scrollWidth - result.clientWidth}px overflow)`
  ).toBeLessThanOrEqual(result.clientWidth);
}
