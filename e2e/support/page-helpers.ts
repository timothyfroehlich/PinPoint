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
import { selectOption } from "./actions";

declare global {
  interface Window {
    __E2E_REDIRECT_TARGET?: string;
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
  // their page.goto() call, preventing duplicate / racing navigations.
  let claimed = false;
  const claimNavigation = (): boolean => {
    if (claimed) return false;
    claimed = true;
    return true;
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- claimed is mutated from sibling async branches; TS narrows it to false in this scope
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
          await page.goto(target, { waitUntil: "domcontentloaded" });
        }
        return;
      }
      await new Promise<void>((r) => {
        setTimeout(r, 100);
      });
    }
    // Timeout: never resolve. Let other branches win the race.
    await new Promise<void>(() => undefined);
  })();

  // Branch C: response body fallback. Filter to the POST that goes to the
  // form's own URL (awayFrom path), not third-party POSTs. waitForResponse()
  // buffers the full body before resolving, which is essential in WebKit
  // (page.on('response') with async .text() loses the body to a closed stream).
  const responseNavPromise: Promise<void> = new Promise<void>((resolve) => {
    void page
      .waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          new URL(r.url()).pathname.startsWith(awayFrom),
        { timeout }
      )
      .then(async (response) => {
        const body = await response.text();
        const match =
          /"redirectTo":"(\/m\/[^/"\\]+\/i\/\d+)"/.exec(body) ??
          /\\"redirectTo\\":\\"(\/m\/[^/"\\]+\/i\/\d+)\\"/.exec(body);
        if (match?.[1] && claimNavigation()) {
          await page.goto(match[1], { waitUntil: "domcontentloaded" });
          resolve();
        }
        // No match (or already claimed): stay quiet, let other branches handle it.
      })
      .catch(() => {
        // waitForResponse timed out: stay quiet.
      });
  });

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
    const prioritySelect = page.getByTestId("issue-priority-select");
    if (await prioritySelect.isVisible()) {
      await selectOption(page, "issue-priority-select", priority);
    }
  }

  await selectOption(page, "issue-frequency-select", frequency);

  const watchToggle = page.getByLabel("Watch this issue");
  if ((await watchToggle.count()) > 0) {
    await watchToggle.setChecked(watchIssue);
  }
}
