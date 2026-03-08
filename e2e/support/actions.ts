import { expect, type Page, type TestInfo } from "@playwright/test";
import { TEST_USERS } from "./constants.js";

/**
 * Returns the user-menu trigger based on viewport.
 *
 * On desktop the trigger lives in the desktop header (data-testid="user-menu-button").
 * On mobile it lives in the compact header (data-testid="mobile-user-menu-button").
 * Providing isMobile ensures we target the exact intended element without relying
 * on Playwright's visibility filter which can be flaky during hydration/layout.
 */
function visibleUserMenu(page: Page, isMobile?: boolean) {
  if (isMobile === true) {
    return page.getByTestId("mobile-user-menu-button");
  }
  if (isMobile === false) {
    return page.getByTestId("user-menu-button");
  }

  // Fallback: Use combined locator if isMobile is not known
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
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for initial dashboard load
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

  if (isMobile) {
    await expect(page.getByTestId("mobile-header")).toBeVisible();
  } else {
    await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
  }

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
 * Ensures a test page is authenticated. If not, logs in automatically.
 * Useful for scenarios where previous tests logged out the session.
 */
export async function ensureLoggedIn(
  page: Page,
  testInfo: TestInfo,
  options?: LoginOptions
): Promise<void> {
  await page.goto("/dashboard");

  // Use project name to determine mobile vs desktop layout
  const isMobile = testInfo.project.name.includes("Mobile");

  // Define semantic locators for both states (logged-in vs logged-out)
  const menu = visibleUserMenu(page, isMobile);
  const signIn = isMobile
    ? page.getByTestId("mobile-nav-signin")
    : page.getByTestId("nav-signin");

  // Use a semantic wait: wait for the UI to settle into either state.
  // This avoids false-negatives from hydration races where visibleUserMenu
  // might not be present yet but the user IS logged in.
  await expect(menu.or(signIn)).toBeVisible();

  // If the sign-in button is the one that's visible, we must log in.
  if (await signIn.isVisible()) {
    await loginAs(page, testInfo, options);
  }

  // Final assertion: verify we are truly logged in and layout is stable
  if (isMobile) {
    await expect(page.getByTestId("mobile-header")).toBeVisible();
  } else {
    await expect(page.locator("aside [data-testid='sidebar']")).toBeVisible();
  }
  await expect(visibleUserMenu(page, isMobile)).toBeVisible();
}

/**
 * Logs out the current user via the User Menu.
 */
export async function logout(page: Page, testInfo?: TestInfo): Promise<void> {
  // Determine if mobile layout is active (prefer testInfo, fallback to viewport width)
  const isMobile =
    testInfo?.project.name.includes("Mobile") ??
    (page.viewportSize()?.width ?? 1024) < 768;

  const userMenu = visibleUserMenu(page, isMobile);
  await expect(userMenu).toBeVisible();
  await userMenu.click();

  const signOutItem = page.getByTestId("user-menu-signout");
  await expect(signOutItem).toBeVisible();
  await signOutItem.click();

  // Wait for redirect to public dashboard
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

  // Wait for the UI to settle into logged-out state (Sign In button visible)
  const signIn = isMobile
    ? page.getByTestId("mobile-nav-signin")
    : page.getByTestId("nav-signin");
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
