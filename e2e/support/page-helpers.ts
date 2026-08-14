/**
 * E2E Test Helpers - Safari/WebKit Defensive Patterns
 *
 * Safari/WebKit has known issues with Server Action redirects and form submissions.
 * These helpers provide defensive waiting patterns to handle Safari-specific timing.
 *
 * References:
 * - Next.js Issue #48309: Safari redirect() to page with dynamic data fails
 * - WebKit tests can be 2x slower than Chromium
 * - Safari may not follow Server Action redirects immediately
 */

import type { Page, Locator } from "@playwright/test";
import { selectOption } from "./actions.js";
import { HydrationTimeoutError, waitForHydration } from "./fixtures.js";

declare global {
  interface Window {
    __E2E_REDIRECT_TARGET?: string | undefined;
  }
}

/**
 * Install a monkey-patch on Location.prototype.assign that captures the
 * redirect target into window.__E2E_REDIRECT_TARGET instead of triggering
 * navigation. The unified report form's useEffect calls
 * `window.location.assign(state.redirectTo)` after a successful Server Action,
 * but Mobile Safari/WebKit stalls navigation triggered by location.assign
 * during/after a Server Action POST. By intercepting it, we sidestep the
 * navigation stall entirely and use Playwright's page.goto() instead.
 *
 * Why patch the prototype instead of the instance: in WebKit,
 * `window.location.assign` is non-configurable (`Object.defineProperty`
 * throws "Attempting to change configurable attribute of unconfigurable
 * property"). The Location.prototype, however, IS patchable, and
 * `instance.assign(url)` resolves through prototype lookup if the instance
 * property is not its own. We override `Location.prototype.assign` directly.
 *
 * Idempotent: safe to call multiple times in the same context. Always clears
 * any previously captured target so each form submission starts fresh.
 */
async function installRedirectInterceptor(page: Page): Promise<void> {
  await page.evaluate(() => {
    interface PatchedWindow extends Window {
      __E2E_REDIRECT_PATCHED?: boolean;
    }
    const w = window as PatchedWindow;
    // Always reset the captured target so each click starts with a clean slate.
    w.__E2E_REDIRECT_TARGET = undefined;
    if (w.__E2E_REDIRECT_PATCHED) return;
    w.__E2E_REDIRECT_PATCHED = true;
    // Patch Location.prototype.assign — works in WebKit even though
    // window.location.assign as an own property is non-configurable.
    const proto = Object.getPrototypeOf(window.location) as Location;
    const original = proto.assign;
    Object.defineProperty(proto, "assign", {
      value: function patchedAssign(this: Location, url: string | URL): void {
        const href = typeof url === "string" ? url : url.toString();
        w.__E2E_REDIRECT_TARGET = href;
        // Still invoke the original. In Chromium this triggers natural
        // navigation (Branch A wins). In WebKit it stalls, so Branch B's
        // poll picks up __E2E_REDIRECT_TARGET and navigates via page.goto().
        // A try/catch shields the form's useEffect from any sync throw.
        try {
          original.call(this, href);
        } catch {
          // ignore — Branch B will pick up the captured target
        }
      },
      writable: true,
      configurable: true,
    });
  });
}

/**
 * Submit a form and wait for Server Action redirect to complete
 *
 * For authenticated users, the /report Server Action returns
 * `{ success: true, redirectTo: "/m/TAF/i/42" }` in the RSC wire format.
 * The client form's useEffect then calls `window.location.assign(redirectTo)`.
 *
 * Strategy: Three concurrent branches racing in Promise.race:
 *
 * Branch A (waitForURL): browser navigates on its own (Chromium / Firefox /
 *   fast WebKit). Fast path for non-WebKit browsers and anonymous forms (which
 *   use server-side `redirect()` rather than client-side location.assign).
 *
 * Branch B (interceptor poll): we monkey-patch window.location.assign before
 *   clicking. When the form's useEffect calls it, we capture the URL into
 *   window.__E2E_REDIRECT_TARGET instead of triggering navigation. We then
 *   poll for that global and call page.goto() directly. This bypasses Mobile
 *   Safari's location.assign stall entirely.
 *
 * Branch C (waitForResponse): fallback that captures the POST response body
 *   and looks for redirectTo in the RSC wire format. waitForResponse() buffers
 *   the full body before resolving, which is essential in WebKit (the
 *   page.on('response') event with async .text() loses the body to a closed
 *   stream).
 *
 * @param page - Playwright Page object
 * @param submitButton - The submit button locator
 * @param options - Optional configuration
 */
export async function submitFormAndWaitForRedirect(
  page: Page,
  submitButton: Locator,
  options?: {
    /** Path to wait for navigation away from (default: current pathname) */
    awayFrom?: string;
    /** Maximum time to wait for redirect (default: 60000ms for Safari) */
    timeout?: number;
    // expectedIssueTitle is kept for call-site compatibility but no longer used.
    /** @deprecated No longer used; kept for API compatibility */
    expectedIssueTitle?: string;
  }
): Promise<void> {
  const currentUrl = page.url();
  const awayFrom = options?.awayFrom ?? new URL(currentUrl).pathname;
  const timeout = options?.timeout ?? 60000; // 60s for WebKit

  // Predicate for "we have left awayFrom". Use exact-pathname comparison so
  // nested paths like /report/success (the anonymous form's destination) ARE
  // treated as having navigated away from /report. A startsWith() check would
  // incorrectly keep waiting in that case.
  const isAway = (urlObj: URL): boolean => urlObj.pathname !== awayFrom;

  // Install the location.assign interceptor BEFORE clicking. The form is
  // already rendered (we're on the same page as the form), so this is safe
  // to apply via page.evaluate().
  await installRedirectInterceptor(page);

  // Coordination flag: only one branch should perform navigation. The first
  // branch to claim it wins; later branches see claimed === true and skip
  // their page.goto() call, preventing duplicate / racing navigations. If a
  // branch's page.goto() throws (e.g., navigation already in progress), it
  // releases the claim so other branches can still succeed.
  let claimed = false;
  const claimNavigation = (): boolean => {
    if (claimed) return false;
    claimed = true;
    return true;
  };
  const releaseClaim = (): void => {
    claimed = false;
  };

  // Branch B: poll for the captured redirect target every 100ms. When the
  // form's useEffect calls window.location.assign(redirectTo), our patch sets
  // window.__E2E_REDIRECT_TARGET. We then call page.goto() to perform the
  // actual navigation, bypassing Mobile Safari's location.assign stall.
  // We use a setTimeout-based delay rather than page.waitForTimeout because
  // ESLint forbids waitForTimeout (Playwright auto-wait is preferred for app
  // assertions, but here we genuinely need a fixed poll interval).
  const interceptorNavPromise: Promise<void> = (async () => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (claimed) {
        // Another branch already navigated. Stop polling.
        await new Promise<void>(() => undefined);
        return;
      }
      const target = await page
        .evaluate(() => window.__E2E_REDIRECT_TARGET ?? null)
        .catch(() => null);
      if (target) {
        if (claimNavigation()) {
          try {
            await page.goto(target, { waitUntil: "domcontentloaded" });
            return;
          } catch (error: unknown) {
            // A page from the `test` fixture has a `goto` that also waits for
            // hydration, and that failure is a real broken page, not a race.
            // Swallowing it here would strand the branch on the never-resolving
            // promise below and surface as a bare test timeout.
            if (error instanceof HydrationTimeoutError) throw error;
            // page.goto can race with sibling branches and throw (frame
            // detached, navigation already in progress). Release the claim
            // so Branch A's natural-nav or Branch C can still succeed.
            releaseClaim();
          }
        }
        // Either claim failed (another branch won) or page.goto threw.
        // Either way, stop polling and let other branches resolve the race.
        await new Promise<void>(() => undefined);
        return;
      }
      await new Promise<void>((r) => {
        setTimeout(r, 100);
      });
    }
    // Timeout: never resolve. Let other branches win the race.
    await new Promise<void>(() => undefined);
  })();

  // Branch C: response body fallback. Match the form's exact pathname so we
  // capture only the Server Action POST, not unrelated POSTs that share a
  // prefix (e.g., /m vs /m/whatever). waitForResponse() buffers the full body
  // before resolving, which is essential in WebKit (page.on('response') with
  // async .text() loses the body to a closed stream).
  const responseNavPromise: Promise<void> = new Promise<void>(
    (resolve, reject) => {
      void page
        .waitForResponse(
          (r) =>
            r.request().method() === "POST" &&
            new URL(r.url()).pathname === awayFrom,
          { timeout }
        )
        .then(async (response) => {
          const body = await response.text();
          const match =
            /"redirectTo":"(\/m\/[^/"\\]+\/i\/\d+)"/.exec(body) ??
            /\\"redirectTo\\":\\"(\/m\/[^/"\\]+\/i\/\d+)\\"/.exec(body);
          if (match?.[1] && claimNavigation()) {
            try {
              await page.goto(match[1], { waitUntil: "domcontentloaded" });
              resolve();
            } catch (error: unknown) {
              // Same reasoning as Branch B: a hydration failure is a broken
              // page, not a lost race, and this branch is the only one that can
              // report it.
              if (error instanceof HydrationTimeoutError) {
                reject(error);
                return;
              }
              // Same race-with-sibling-branch handling as Branch B.
              releaseClaim();
            }
          }
          // No match (or already claimed, or page.goto threw): stay quiet.
        })
        .catch(() => {
          // waitForResponse timed out: stay quiet.
        });
    }
  );

  await submitButton.click();

  // Branch A: natural navigation. Use "commit" so we resolve as soon as the
  // URL commits, without waiting for page load. We claim the navigation slot
  // when it fires so Branches B/C don't double-navigate.
  //
  // The catch handles the case where Branch B/C navigates via page.goto()
  // while Branch A's waitForURL is in flight — the navigation context detaches
  // and waitForURL throws "ERR_ABORTED; maybe frame was detached?". By that
  // point another branch has already navigated, so we treat it as a no-op.
  const naturalNavPromise = page
    .waitForURL((url) => isAway(url), {
      timeout,
      waitUntil: "commit",
    })
    .then(() => {
      claimNavigation();
    })
    .catch((error: unknown) => {
      if (claimed) {
        // Another branch won the race and detached the frame — that's fine.
        return;
      }
      throw error;
    });

  await Promise.race([
    naturalNavPromise,
    interceptorNavPromise,
    responseNavPromise,
  ]);

  // The `page` fixture only wraps `goto`/`reload`, and the branch that usually
  // wins here is A — a natural navigation the fixture cannot observe, resolved
  // at `waitUntil: "commit"`, which is earlier than `domcontentloaded`, let
  // alone hydration. So callers of this helper would otherwise land on a fresh
  // document and start clicking in exactly the window the fixture exists to
  // close. Wait here instead, once, for whichever branch won.
  await waitForHydration(page, `${page.url()} (after form submit)`);
}

/**
 * Fill out the issue report form with sensible defaults
 *
 * Provides required fields by default to reduce E2E test brittleness.
 * Override any field as needed for specific test scenarios.
 *
 * @param page - Playwright Page object
 * @param options - Form field values
 */
export async function fillReportForm(
  page: Page,
  options: {
    title: string;
    description?: string;
    severity?: "minor" | "playable" | "unplayable";
    priority?: "low" | "medium" | "high";
    frequency?: "intermittent" | "frequent" | "constant";
    /** Set to false for anonymous/public forms that don't have priority */
    includePriority?: boolean;
    watchIssue?: boolean;
  }
): Promise<void> {
  const {
    title,
    description,
    severity = "minor",
    priority = "low",
    frequency = "intermittent",
    includePriority = true,
    watchIssue = true,
  } = options;

  // Wait for the page to settle (hydration + dynamic chunk loads). In Mobile
  // Safari/WebKit, clicking the submit button before the form is fully
  // hydrated silently no-ops the submission — no POST is sent. Waiting for
  // networkidle lets React 19's `<form action={serverAction}>` finish hooking
  // up the action handler before tests interact with it.
  //
  // Best-effort: in Chromium with HMR connections, networkidle can never
  // settle. We wrap in try/catch so other browsers proceed after the timeout
  // instead of failing the test. WebKit, where this matters, reaches
  // networkidle within a few seconds.
  await page
    .waitForLoadState("networkidle", { timeout: 5000 })
    .catch(() => undefined);

  await page.getByLabel("Issue Title *").fill(title);

  if (description) {
    // Wait for the RichTextEditor (ProseMirror) to load — dynamic import with ssr: false.
    // Use .ProseMirror selector + keyboard.type() since that's reliable for contenteditable.
    const descriptionEditor = page.locator(".ProseMirror").first();
    await descriptionEditor.waitFor({ timeout: 15000 });
    await descriptionEditor.click();
    await page.keyboard.type(description);
  }

  await selectOption(page, "issue-severity-select", severity);

  if (includePriority) {
    // `isVisible()` samples; it never retries. Waiting first makes this an
    // actual wait, so a priority select that is merely slow to render is set
    // rather than silently skipped — which would leave the caller asserting
    // against a default it believes it chose. The `catch` keeps the field
    // genuinely optional (some report forms omit it).
    const prioritySelect = page.getByTestId("issue-priority-select");
    const priorityRendered = await prioritySelect
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (priorityRendered) {
      await selectOption(page, "issue-priority-select", priority);
    }
  }

  await selectOption(page, "issue-frequency-select", frequency);

  const watchToggle = page.getByLabel("Watch this issue");
  if ((await watchToggle.count()) > 0) {
    await watchToggle.setChecked(watchIssue);
  }
}

/** The Tailwind `md` breakpoint, which is what decides the layout below. */
const MD_BREAKPOINT_PX = 768;

// Budgets for the comment Sheet, bounded rather than inheriting the 30s CI
// `actionTimeout`, so the worst path (click + wait + click + wait) stays inside
// the 60s CI test timeout. The first click absorbs a trigger still becoming
// actionable while the dev server compiles for other workers; the retry only
// has to re-hit a control already proven actionable.
const SHEET_FIRST_CLICK_TIMEOUT = process.env["CI"] ? 20_000 : 5_000;
const SHEET_RETRY_CLICK_TIMEOUT = process.env["CI"] ? 10_000 : 3_000;
const SHEET_OPEN_TIMEOUT = process.env["CI"] ? 10_000 : 3_000;

/**
 * Resolves the issue-detail comment form for the current viewport, opening the
 * mobile sheet when that is the branch in play.
 *
 * Both branches are in the DOM at once: the inline `issue-comment-form` carries
 * `hidden md:flex`, and below `md` a StickyCommentComposer button opens the same
 * form inside a Sheet. So a test has to work out which one is live.
 *
 * It has to *know*, not sample. Two specs used to decide with
 * `sheetTrigger.isVisible({ timeout: 3000 })`, which reads like a 3s wait and is
 * not one — `isVisible()` never retries, and its `timeout` option is deprecated
 * and ignored. The check therefore fired at whatever instant the Server Action
 * redirect happened to land on, so a sticky composer that had not hydrated yet
 * would read as "desktop" and send the test at the inline form that is
 * `display: none` on mobile. Deciding on viewport width removes the sampling:
 * it is the same input the CSS uses, and it cannot be raced.
 *
 * **This did not fix the Mobile Chrome full-suite failures.** It was written to,
 * and it didn't: `form-resets:190` still failed after the change. Both specs
 * also pass in isolation, which rules out a per-spec defect and points at
 * cross-spec interference instead. So read this as a latent-defect fix — a wait
 * that never waited — not as the cause of anything observed. (PP-jxhy.)
 */
export async function openIssueCommentForm(
  page: Page
): Promise<{ form: Locator; isSheet: boolean }> {
  const viewportWidth = page.viewportSize()?.width ?? MD_BREAKPOINT_PX;
  const isSheet = viewportWidth < MD_BREAKPOINT_PX;

  if (!isSheet) {
    return { form: page.getByTestId("issue-comment-form"), isSheet: false };
  }

  const sheetTrigger = page.getByRole("button", { name: "Add a comment" });
  await sheetTrigger.waitFor({ state: "visible", timeout: 15000 });

  const dialog = page.getByRole("dialog", { name: "Add a comment" });

  // Same dialog, matched even while it is still ARIA-hidden. `getByRole`
  // defaults to `includeHidden: false`, so the plain `dialog` locator above
  // reports 0 both when the Sheet was never opened AND when it is mounted but
  // not yet in the accessibility tree — which would make the "did the click
  // register?" test below unable to tell those two apart, the one distinction
  // it exists to make. Radix unmounts closed Sheet content outright, so with
  // hidden elements included a non-zero count does mean "the click registered".
  const mountedDialog = page.getByRole("dialog", {
    name: "Add a comment",
    includeHidden: true,
  });

  // The composer paints before React attaches its handler, and under
  // `--workers=3` the dev server is busy compiling for other spec files, so a
  // click can land on an inert button and vanish. Waiting longer cannot
  // recover that, because nothing is pending — it needs another click.
  //
  // But a BLIND second click is actively harmful: if the first one worked and
  // the Sheet is merely slow, Radix has already marked the outside content
  // `aria-hidden` and laid an overlay over it, so re-clicking either toggles
  // the Sheet shut or is intercepted — turning a recoverable slow mount into a
  // hard failure. So the retry is conditional on evidence the click did NOT
  // register: the dialog is absent from the DOM entirely. If it is mounted but
  // not yet visible, the click landed and the right move is to keep waiting.
  //
  // Note this deliberately does NOT go through `openDropdownMenu`. That helper
  // asserts `aria-expanded` on the trigger, and that assertion cannot pass for
  // THIS trigger — not because the attribute is missing (Radix's dialog Trigger
  // does set it, which is why the MetadataDrawer `-trigger` path in
  // `selectOption` works through the same helper) but because opening a Radix
  // dialog calls `hideOthers()`, which marks everything outside the content
  // `aria-hidden`. The trigger is outside the content, so once the Sheet opens
  // the `getByRole("button")` locator stops matching it altogether and the
  // assertion fails as "no elements" — after which the retry click has nothing
  // to click either. Verified on Mobile Chrome: routing through the helper made
  // `form-resets:190` and `rich-text:105` fail exactly that way. The general
  // rule: never assert on a role locator for a control an open modal aria-hides.
  await sheetTrigger.click({ timeout: SHEET_FIRST_CLICK_TIMEOUT });
  const openedFirstTry = await dialog
    .waitFor({ state: "visible", timeout: SHEET_OPEN_TIMEOUT })
    .then(() => true)
    .catch(() => false);

  if (!openedFirstTry) {
    if ((await mountedDialog.count()) > 0) {
      // Mounted but slow — the click registered. Re-clicking here is what
      // would close it, so wait instead.
      await dialog.waitFor({ state: "visible", timeout: SHEET_OPEN_TIMEOUT });
    } else {
      await sheetTrigger.click({ timeout: SHEET_RETRY_CLICK_TIMEOUT });
      await dialog.waitFor({ state: "visible", timeout: SHEET_OPEN_TIMEOUT });
    }
  }
  return { form: dialog, isSheet: true };
}
