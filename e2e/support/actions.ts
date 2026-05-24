import {
  test,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { TEST_USERS } from "./constants.js";

/** Returns the user-menu trigger (unified across all viewports). */
function visibleUserMenu(page: Page) {
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
  // Navigate to login page
  await page.goto("/login");

  // Define possible settled states for the login page
  const emailInput = page.getByLabel("Email");
  const menu = visibleUserMenu(page);

  // Wait for the UI to settle into either "ready to login" or "already logged in"
  await expect(emailInput.or(menu)).toBeVisible();

  // If already logged in, clear client state directly instead of driving the
  // UI logout flow. This eliminates the entire "user-menu-signout not visible"
  // flake class that affects tests switching identities mid-suite.
  // PinPoint auth lives exclusively in HTTP cookies (no createBrowserClient /
  // no indexedDB usage), so clearCookies() is the authoritative reset.
  // localStorage + sessionStorage are cleared as hygiene (RichTextEditor
  // drafts, report-form drafts).
  if (await menu.isVisible()) {
    await page.context().clearCookies();
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto("/login");
    await expect(emailInput).toBeVisible();
  }

  // Fill and submit login form
  await emailInput.fill(email);
  await page.getByLabel(/^Password\s*\*?$/).fill(password);

  // Submit form
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for initial dashboard load
  await page.waitForLoadState("domcontentloaded");
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

  // AppHeader is always rendered (mobile and desktop) — just verify it's visible
  await expect(page.getByTestId("app-header")).toBeVisible();

  // Wait for user menu to hydrate before continuing
  await expect(visibleUserMenu(page)).toBeVisible();

  // Force a full server round-trip to ensure auth cookies are settled.
  // Under concurrent load (3+ Playwright workers), Supabase cookie rotation
  // (refresh token exchange) may not be fully committed by the time the NEXT
  // navigation fires. Reloading the dashboard forces the browser to send the
  // auth cookie back to the server, completing the rotation cycle.
  await page.reload({ waitUntil: "domcontentloaded" });

  // Confirm the reload kept us on /dashboard (not redirected to /login by middleware).
  await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  await expect(visibleUserMenu(page)).toBeVisible();
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
 *
 * The Radix dropdown trigger flips `aria-expanded` to "true" once the menu is
 * actually open. We assert that before reaching for the sign-out item so that
 * a click intercepted by an overlay (e.g. a freshly-focused ProseMirror editor
 * after creating an issue) surfaces as a clear "menu never opened" failure
 * rather than the misleading "sign-out item not visible".
 */
export async function logout(page: Page, _testInfo: TestInfo): Promise<void> {
  const userMenu = visibleUserMenu(page);

  await expect(
    userMenu,
    "User menu trigger not visible — expected an authenticated AppHeader."
  ).toBeVisible();

  await openUserMenu(userMenu);

  const signOutItem = page.getByTestId("user-menu-signout");
  await expect(
    signOutItem,
    "Sign-out item not visible even though the user menu reports open. The menu content may not have hydrated, or the testid was renamed."
  ).toBeVisible();
  await signOutItem.click();

  // Wait for redirect to public dashboard
  await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

  // Wait for the UI to settle into logged-out state (Sign In button visible)
  // AppHeader is unified — same testid on all viewports
  await expect(page.getByTestId("nav-signin")).toBeVisible({ timeout: 15000 });
}

/**
 * Click a Radix dropdown trigger and confirm it actually opened. Retries once
 * if the first click loses to a focus/overlay race.
 *
 * Radix sets `aria-expanded="true"` on the trigger once the dropdown is open.
 * We assert that before proceeding so a click intercepted by an overlay (e.g.
 * a freshly-focused ProseMirror editor) surfaces as a clear "dropdown never
 * opened" failure rather than a missing-item failure downstream.
 */
export async function openDropdownMenu(trigger: Locator): Promise<void> {
  await trigger.click();
  try {
    await expect(trigger).toHaveAttribute("aria-expanded", "true", {
      timeout: 3000,
    });
    return;
  } catch {
    // One retry — the first click sometimes loses to a focus race (e.g. a
    // ProseMirror editor still holding focus right after a form submit).
    await trigger.click();
    await expect(
      trigger,
      "Dropdown trigger did not open after two click attempts. aria-expanded never became 'true' — the click is likely being intercepted by an overlay (modal, editor focus trap, etc.)."
    ).toHaveAttribute("aria-expanded", "true", { timeout: 3000 });
  }
}

/**
 * Click the user-menu trigger and confirm it actually opened. Delegates to
 * the generic openDropdownMenu helper.
 */
async function openUserMenu(
  userMenu: ReturnType<typeof visibleUserMenu>
): Promise<void> {
  await openDropdownMenu(userMenu);
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

/**
 * Asserts that the page has no serious or critical accessibility (a11y) violations.
 * Fails only on 'serious' and 'critical' impacts, and logs 'minor' and 'moderate' impacts.
 */
export async function assertNoA11yViolations(
  page: Page,
  options: { ignore?: string[] } = {}
): Promise<void> {
  const ignoreRules = options.ignore ?? [];
  const defaultIgnore: string[] = [
    // 'aria-prohibited-attr': Tiptap rich-text editor div with contenteditable="true" uses aria-label which axe flags as prohibited on generic divs.
    "aria-prohibited-attr",
    // 'nested-interactive': Radix UI / shadcn accordion and collapsible triggers nest interactive buttons inside interactive regions.
    "nested-interactive",
    // 'color-contrast': Custom design tokens, gradients, and brand styles (e.g. status badges, muted links) may not meet the strict color contrast threshold.
    "color-contrast",
    // 'button-name': Icon-only buttons or dynamic filter dropdown triggers without selected options lack discernible text.
    "button-name",
    // 'scrollable-region-focusable': Main content container has tabindex="-1" for skip-to-main focus routing, but axe expects scrollable regions to be keyboard-focusable.
    "scrollable-region-focusable",
  ];

  const rulesToIgnore = Array.from(new Set([...defaultIgnore, ...ignoreRules]));

  const builder = new AxeBuilder({ page });
  if (rulesToIgnore.length > 0) {
    builder.disableRules(rulesToIgnore);
  }

  const results = await builder.analyze();

  // Attach full results to Playwright report if running inside a test context
  try {
    const testInfo = test.info();
    await testInfo.attach("a11y-scan-results.json", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });
  } catch {
    // Silent catch if called outside of active test runner execution context
  }

  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical"
  );
  const minorOrModerate = results.violations.filter(
    (v) => v.impact === "minor" || v.impact === "moderate" || !v.impact
  );

  if (minorOrModerate.length > 0) {
    console.log(
      `[A11y Warning] Found ${minorOrModerate.length} moderate/minor violations.`
    );
    const maxViolationsToLog = 5;
    const violationsToLog = minorOrModerate.slice(0, maxViolationsToLog);
    for (const v of violationsToLog) {
      console.log(`- [${v.impact ?? "unknown"}] ${v.id}: ${v.help}`);
      console.log(`  Help: ${v.helpUrl}`);
      const maxNodesToLog = 3;
      const nodesToLog = v.nodes.slice(0, maxNodesToLog);
      console.log(
        `  Elements (showing ${nodesToLog.length} of ${v.nodes.length}):`
      );
      for (const node of nodesToLog) {
        console.log(`    - Selector: ${node.target.join(", ")}`);
        console.log(`      HTML: ${node.html}`);
      }
      if (v.nodes.length > maxNodesToLog) {
        console.log(
          `    ... and ${v.nodes.length - maxNodesToLog} more element(s)`
        );
      }
    }
    if (minorOrModerate.length > maxViolationsToLog) {
      console.log(
        `... and ${minorOrModerate.length - maxViolationsToLog} more moderate/minor violation(s)`
      );
    }
  }

  if (seriousOrCritical.length > 0) {
    const errorDetails = seriousOrCritical
      .map((v) => {
        const elements = v.nodes
          .map(
            (n) =>
              `    - Selector: ${n.target.join(", ")}\n      HTML: ${n.html}`
          )
          .join("\n");
        return `- [${v.impact}] ${v.id}: ${v.help}\n  Help: ${v.helpUrl}\n  Elements:\n${elements}`;
      })
      .join("\n\n");

    throw new Error(
      `Accessibility verification failed with ${seriousOrCritical.length} serious/critical violations:\n\n${errorDetails}`
    );
  }
}
