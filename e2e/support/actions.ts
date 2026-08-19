import {
  test,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

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
  _testInfo: TestInfo,
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
 * Budget for a portal, drawer, or dropdown to mount once its trigger is clicked.
 *
 * These helpers hard-coded 5s (3s in the retrying dropdown loop), which silently
 * opted out of the config's CI-aware `expect.timeout` — an explicit `{ timeout }`
 * always beats `expect: { timeout }`, so the 30s CI budget never applied here.
 * A shared helper quietly capping every caller below the environment's own
 * setting is a defect on its own terms, whatever it happens to be masking.
 *
 * 5s is also thin for this suite specifically: the E2E `webServer` runs
 * `pnpm run dev`, so a route pays an on-demand Next compile on its first
 * request, and mobile viewports render component trees a chromium run never
 * compiles (`MetadataDrawer`, `StickyCommentComposer`, `RowEditSheet`).
 *
 * **This is a latent-defect fix, not the cause of anything observed.** The
 * Mobile Chrome full-suite failures were dropped clicks, fixed by the hydration
 * wait in `support/fixtures.ts`.
 *
 * A caveat on how that was established, because it is easy to repeat the
 * mistake: the crabbox runner does **not** set `CI`, so on it these constants
 * evaluate to the local 5s/3s and `playwright.config.ts` uses `actionTimeout`
 * 5s and an `expect` timeout of 10s rather than CI's 30s. Any conclusion of the
 * form "widening the timeout did not help" drawn from a runner session is
 * therefore worthless — the widening never applied. Check `echo $CI` on the
 * host before reading anything into a timeout experiment. (PP-jxhy.)
 *
 * Local keeps the short budget: that dev server is usually warm, and a
 * genuinely missing selector should still fail fast.
 */
const PORTAL_MOUNT_TIMEOUT = process.env["CI"] ? 20_000 : 5_000;

/**
 * Same idea, halved, for `openDropdownMenu` — it clicks twice, so this budget
 * is spent twice before the test gives up, and the CI test timeout is 60s.
 */
const DROPDOWN_OPEN_TIMEOUT = process.env["CI"] ? 10_000 : 3_000;

/**
 * The clicks inside `openDropdownMenu` are bounded explicitly rather than
 * inheriting `use.actionTimeout` (30s in CI, `playwright.config.ts`).
 *
 * Without this the worst case is click(30) + assert(10) + click(30) +
 * assert(10) = 80s against a 60s CI test timeout, so a genuinely stuck trigger
 * would die as a bare "Test timeout of 60000ms exceeded" and the authored
 * "dropdown never opened" message below — the whole point of the helper —
 * would never print.
 *
 * The two clicks get different budgets because they are doing different jobs.
 * The FIRST has to absorb a trigger that is still becoming actionable — under
 * `--workers=3` the Mobile Chrome sticky-composer trigger genuinely needs more
 * than 10s while the dev server compiles for other spec files, and bounding it
 * at 10s turned `form-resets:190` and `rich-text:105` red. The RETRY only has
 * to re-hit a control already proven actionable, so it can be tight.
 *
 * Worst case 20 + 10 + 10 + 10 = 50s, inside the 60s CI test timeout.
 */
const DROPDOWN_FIRST_CLICK_TIMEOUT = process.env["CI"] ? 20_000 : 5_000;
const DROPDOWN_RETRY_CLICK_TIMEOUT = process.env["CI"] ? 10_000 : 3_000;

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
  try {
    // The click sits inside the try so a trigger that never becomes actionable
    // in time gets the retry too, instead of throwing straight past it.
    await trigger.click({ timeout: DROPDOWN_FIRST_CLICK_TIMEOUT });
    await expect(trigger).toHaveAttribute("aria-expanded", "true", {
      timeout: DROPDOWN_OPEN_TIMEOUT,
    });
    return;
  } catch {
    // One retry — the first click sometimes loses to a focus race (e.g. a
    // ProseMirror editor still holding focus right after a form submit).
    await trigger.click({ timeout: DROPDOWN_RETRY_CLICK_TIMEOUT });
    await expect(
      trigger,
      "Dropdown trigger did not open after two click attempts. aria-expanded never became 'true' — the click is likely being intercepted by an overlay (modal, editor focus trap, etc.)."
    ).toHaveAttribute("aria-expanded", "true", {
      timeout: DROPDOWN_OPEN_TIMEOUT,
    });
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

interface RetryNavClickOptions {
  /** Outer `toPass` timeout. Default 15 000 ms. */
  timeout?: number;
  /** Inner assertion timeout (URL match or visibility). Default 5 000 ms. */
  innerTimeout?: number;
}

/**
 * Retry a client-side navigation click until the expected outcome holds.
 *
 * Under `next dev`, Fast Refresh rebuilds can remount the React tree
 * mid-navigation. The soft navigation is discarded and the click is lost —
 * only re-issuing it recovers (PP-2b3r). This helper wraps the click in an
 * `expect().toPass()` retry loop with two safeguards:
 *
 * 1. Each attempt presses Escape first to dismiss any Radix dropdown or modal
 *    that a prior failed attempt may have left open. Without this, retrying a
 *    dropdown-menu sequence toggles the menu shut instead of re-opening it.
 * 2. The outer timeout defaults to 15 s so that three sequential calls fit
 *    comfortably inside the 60 s CI per-test budget.
 *
 * @param page     Playwright page
 * @param click    Callback that performs the click(s)
 * @param expected RegExp → asserts page URL; Locator → asserts visibility
 */
export async function retryNavClick(
  page: Page,
  click: () => Promise<void>,
  expected: RegExp | Locator,
  options?: RetryNavClickOptions
): Promise<void> {
  const timeout = options?.timeout ?? 15_000;
  const innerTimeout = options?.innerTimeout ?? 5_000;
  await expect(async () => {
    // Dismiss any popup/dropdown left open by a previous attempt so the next
    // click lands on the right target, not a toggle-closed menu (PP-2b3r).
    await page.keyboard.press("Escape");
    await click();
    if (expected instanceof RegExp) {
      await expect(page).toHaveURL(expected, { timeout: innerTimeout });
    } else {
      await expect(expected).toBeVisible({ timeout: innerTimeout });
    }
  }).toPass({ timeout });
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

  // Open via openDropdownMenu, which confirms the trigger actually opened and
  // clicks a second time if it didn't.
  //
  // A bare `trigger.click()` here is what made the Mobile Chrome full suite fail
  // about once per run. The button paints before React attaches Radix's
  // handlers, and under `--workers=3` the dev server is compiling routes for two
  // other spec files, so hydration lags behind paint by enough that a click
  // lands on an inert button and is simply dropped. Nothing is pending
  // afterwards, which is why raising the option-visible timeout to 20s did not
  // help — the wait was never the problem, the lost click was. Serial runs pass
  // (92/92) because hydration wins the race every time when the dev server has
  // nothing else to compile.
  //
  // PP-168u killed the same class in `machine-timeline` by routing through this
  // helper; `selectOption` had simply never been given it. (PP-jxhy.)
  const trigger = page.getByTestId(triggerTestId);
  await expect(trigger).toBeVisible();
  await openDropdownMenu(trigger);

  // Wait for the option to be visible in the popover
  const optionTestId = getOptionTestId(optionValue);
  const option = page.getByTestId(optionTestId);
  if (triggerTestId.endsWith("-trigger")) {
    // Drawer items use dispatchEvent — they respond to synthetic clicks.
    // Wait for visibility first so the drawer open animation has completed.
    await expect(option).toBeVisible({ timeout: PORTAL_MOUNT_TIMEOUT });
    await option.dispatchEvent("click");
  } else {
    // Wait for the Radix Select portal to mount — options aren't in the DOM until the portal
    // opens (async portal render), so clicking without waiting causes a 30s timeout race.
    // force:true is still needed because shadcn/ui Select options can be positioned outside
    // the visible viewport but are still technically "visible" per Playwright's CSS check.
    await expect(option).toBeVisible({ timeout: PORTAL_MOUNT_TIMEOUT });
    await option.click({ force: true });
  }

  // Wait for dropdown to close
  await expect(option).toBeHidden({ timeout: PORTAL_MOUNT_TIMEOUT });
}

/**
 * Selects a machine from the report-form MachineCombobox (Popover + cmdk).
 *
 * The old machine picker was a native `<select>` driven by Playwright's
 * `.selectOption()`; the combobox needs an open-then-click sequence. Pass a
 * machine id to pick a specific machine, or omit `machineId` to pick the first
 * one in the list (the equivalent of the old `.selectOption({ index: 1 })`,
 * which just needed *a* machine selected).
 */
export async function selectMachine(
  page: Page,
  machineId?: string
): Promise<void> {
  const trigger = page.getByTestId("machine-select");
  await expect(trigger).toBeVisible();
  // Same lost-click exposure as selectOption above — the Popover trigger also
  // flips aria-expanded, so the same confirm-and-retry applies. (PP-jxhy.)
  await openDropdownMenu(trigger);

  const option = machineId
    ? page.getByTestId(`machine-option-${machineId}`)
    : page.locator('[data-testid^="machine-option-"]').first();
  await expect(option).toBeVisible({ timeout: PORTAL_MOUNT_TIMEOUT });
  await option.click();

  // Selecting closes the popover, so the option unmounts.
  await expect(option).toBeHidden({ timeout: PORTAL_MOUNT_TIMEOUT });
}

/** The hidden input carrying the report form's selected machine id. */
export function machineSelectValue(page: Page): Locator {
  return page.getByTestId("machine-select-input");
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
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const viewportWidth = doc.clientWidth;

    // How far past a viewport edge an element must extend before we treat it as
    // a layout break rather than acceptable graceful clipping. Components that
    // deliberately clip a few px of trailing content (e.g. a right-pinned
    // timestamp in a density-managed row that already truncates its main text)
    // are working as designed; a chip row or card spilling tens/hundreds of px
    // off-screen is not. 32px ≈ more than a stray sub-pixel or a clipped
    // character — a whole word/control has been pushed out of view.
    const OVERFLOW_LIMIT = 32;

    const overflowsViewport = (rect: DOMRect): boolean =>
      rect.left < -OVERFLOW_LIMIT ||
      rect.right > viewportWidth + OVERFLOW_LIMIT;

    // Classify how an ancestor constrains horizontal overflow:
    //   "scroll" — user can scroll to reveal it (not a visual break)
    //   "clip"   — content is clipped and unreachable (a real break)
    //   "visible" — no constraint
    const clipKindX = (el: Element): "scroll" | "clip" | "visible" => {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") return "scroll";
      if (ox === "hidden" || ox === "clip") return "clip";
      return "visible";
    };

    // Nearest ancestor that constrains this element horizontally. Why this
    // matters: PinPoint's app shell sets `overflow-x: hidden` on <html>/<body>
    // (globals.css) plus an `overflow-hidden` content wrapper (layout.tsx), so
    // any horizontal overrun is silently CLIPPED rather than widening the
    // document. That defeats a plain `document.scrollWidth <= clientWidth`
    // check — it can never fail. Here we instead detect content that a
    // NON-scrollable ancestor clips off-screen (hidden from the user), while
    // treating real scroll containers (carousels, tab strips) as fine.
    const nearestClipperX = (el: Element): "scroll" | "clip" | "none" => {
      let node = el.parentElement;
      while (node) {
        const k = clipKindX(node);
        if (k !== "visible") return k;
        node = node.parentElement;
      }
      return "none";
    };

    const describe = (el: Element, rect: DOMRect): string => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const testid = el.getAttribute("data-testid");
      const tid = testid ? `[data-testid="${testid}"]` : "";
      const cls =
        typeof el.className === "string" && el.className.trim()
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
      const side =
        rect.left < 0
          ? `left edge (left=${Math.round(rect.left)}px)`
          : `right edge (right=${Math.round(rect.right)}px > ${viewportWidth}px)`;
      return `${tag}${id}${tid}${cls} — clipped past the ${side}`;
    };

    const offenders: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (
        typeof el.checkVisibility === "function" &&
        !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      ) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (!overflowsViewport(rect)) continue;

      // Report only the boundary element — the one whose parent stays within
      // the viewport — so we surface the source of the overrun instead of every
      // descendant dragged off-screen with it.
      const parent = el.parentElement;
      if (parent && overflowsViewport(parent.getBoundingClientRect())) continue;

      // Reachable by scrolling => not a visual break.
      if (nearestClipperX(el) === "scroll") continue;

      offenders.push(describe(el, rect));
      if (offenders.length >= 10) break;
    }

    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: viewportWidth,
      offenders,
    };
  });

  // Kept as a cheap belt-and-suspenders for any surface rendered outside the
  // overflow-hidden app shell. Note: under the shell this can never fail (the
  // shell clips the document), which is exactly why the element walk below
  // exists.
  expect(
    result.scrollWidth,
    `Horizontal overflow detected: content is ${result.scrollWidth}px wide ` +
      `but viewport is only ${result.clientWidth}px (${result.scrollWidth - result.clientWidth}px overflow)`
  ).toBeLessThanOrEqual(result.clientWidth);

  expect(
    result.offenders,
    `Visible element(s) are clipped off-screen by a non-scrollable ancestor — ` +
      `content the user cannot see or reach. This is the mobile-overflow class ` +
      `that document.scrollWidth misses because the app shell clips overflow at ` +
      `<body>. Offenders (boundary element of each overrun):\n` +
      result.offenders.map((o) => `  • ${o}`).join("\n")
  ).toEqual([]);
}

/**
 * Asserts that a shadcn Select dropdown trigger is displaying its placeholder text.
 */
export async function assertSelectAtPlaceholder(
  trigger: Locator,
  placeholderText: string | RegExp
): Promise<void> {
  await expect(trigger).toHaveAttribute("data-placeholder");
  await expect(trigger.locator('[data-slot="select-value"]')).toHaveText(
    placeholderText
  );
}

/**
 * Asserts that a shadcn Select dropdown trigger is displaying the expected option label.
 */
export async function assertSelectValue(
  trigger: Locator,
  expectedLabel: string | RegExp
): Promise<void> {
  await expect(trigger).not.toHaveAttribute("data-placeholder");
  await expect(trigger.locator('[data-slot="select-value"]')).toHaveText(
    expectedLabel
  );
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
