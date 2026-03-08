import { expect, type Page, type TestInfo } from "@playwright/test";

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
 *
 * When storageState is active (the default for most tests), the browser starts
 * pre-authenticated. This function detects that case:
 * - If already authenticated as the requested role → fast path (~0.5s)
 * - If already authenticated as a DIFFERENT role → clears cookies, re-logs in
 * - If not authenticated → standard UI login flow
 */
export async function loginAs(
  page: Page,
  testInfo: TestInfo,
  {
    email = TEST_USERS.member.email,
    password = TEST_USERS.member.password,
  }: LoginOptions = {}
): Promise<void> {
  const isMemberRequest =
    email === TEST_USERS.member.email &&
    password === TEST_USERS.member.password;

  // Navigate to /login. If storageState has valid cookies, middleware will
  // redirect to /dashboard instead of showing the login form.
  await page.goto("/login");
  await page.waitForLoadState("load");

  const onLoginPage = page.url().includes("/login");

  if (!onLoginPage) {
    // Already authenticated via storageState
    if (isMemberRequest) {
      // FAST PATH: storageState already has the right role (member).
      // The setup project already did the cookie-settling reload, so we
      // can skip it here. Just verify the dashboard is ready.
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
      await assertLayoutReady(page, testInfo);
      return;
    }

    // Wrong role: storageState has member cookies but we need a different user.
    // Clear cookies and re-navigate to /login for a fresh UI login.
    await page.context().clearCookies();
    await page.goto("/login");
    await page.waitForLoadState("load");
  }

  // Standard UI login flow
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForLoadState("load");
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

  await assertLayoutReady(page, testInfo);

  // Force a full server round-trip to ensure auth cookies are settled.
  // Under concurrent load (3+ Playwright workers), Supabase cookie rotation
  // (refresh token exchange) may not be fully committed by the time the NEXT
  // navigation fires. Reloading the dashboard forces the browser to send the
  // auth cookie back to the server, completing the rotation cycle. Without
  // this, Server Actions on subsequent pages can see a stale/missing cookie
  // and treat the user as anonymous.
  await page.reload({ waitUntil: "load" });
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
 *
 * With storageState, the browser starts pre-authenticated as member. This
 * means the "is user menu visible?" check always passes — even when
 * non-member credentials were requested. To avoid this silent wrong-identity
 * bug, non-member requests always delegate to loginAs() which handles
 * cookie clearing.
 */
export async function ensureLoggedIn(
  page: Page,
  testInfo: TestInfo,
  options?: LoginOptions
): Promise<void> {
  const isMemberRequest =
    !options?.email ||
    (options.email === TEST_USERS.member.email &&
      (!options.password || options.password === TEST_USERS.member.password));

  // Non-member requests must always go through loginAs() to clear
  // the member storageState cookies and log in as the correct user.
  if (!isMemberRequest) {
    await loginAs(page, testInfo, options);
    return;
  }

  await page.goto("/dashboard");
  // Use load (not networkidle) for speed and to avoid hanging background requests.
  // We'll still wait for the user menu to confirm hydration.
  await page.waitForLoadState("load");

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
