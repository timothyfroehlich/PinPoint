/**
 * Project-local `test` — identical to Playwright's, except that a navigation
 * does not return until React has hydrated.
 *
 * ## Why this exists
 *
 * Playwright's actionability checks are visible, stable, enabled, and receives-
 * events. None of them know whether React has attached a handler yet, so
 * "clickable" and "does something" are different facts and only the first is
 * checked. A click in that window lands on a live-looking control and is
 * silently discarded — no error, nothing pending afterwards.
 *
 * The spec then fails wherever it next asserts the consequence, which is why
 * the symptom looked like unrelated bugs: a Radix Select portal that never
 * opened (`status-overhaul:25`), a comment Sheet that never appeared
 * (`form-resets:190`, `rich-text:105`), a tab-strip navigation that never
 * happened (`technician-role:89`). It is also why raising timeouts did nothing:
 * a slow mount is rescued by a longer wait, a dropped click is not.
 *
 * Evidence it is one mechanism and not four bugs, from the Mobile Chrome full
 * suite on the Bazzite runner: serial `--workers=1` passes 92/92,
 * `--workers=3` fails about one spec per run, every victim passes in isolation,
 * and the victim rotates. Mobile Chrome is the only project affected because
 * the E2E `webServer` runs `pnpm run dev` — routes compile on first request —
 * and mobile renders component trees chromium never compiles
 * (`MetadataDrawer`, `StickyCommentComposer`, `RowEditSheet`), so it pays extra
 * compiles while two other workers keep the server busy. (PP-jxhy.)
 *
 * ## Why a fixture rather than per-site retries
 *
 * The victims span three unrelated surfaces and rotate by scheduling luck, so
 * guarding call sites means guarding every click in the suite — including ones
 * nobody has written yet. Waiting once per navigation covers the specs that
 * navigate through the `page` fixture.
 *
 * ## What it does not cover
 *
 * Four real gaps, all narrower than "it's handled":
 *
 * 1. **Pages this fixture never sees.** A page from
 *    `browser.newContext().newPage()` is constructed by the spec, not by the
 *    fixture, so it gets the stock `goto`/`reload`. Eleven such pages exist
 *    (`email-and-notifications`, `collection-edit-sharing`, `collections`) and
 *    several of them drive the very helpers this fixture was written for. Call
 *    {@link attachHydrationWait} on them — see those specs for the pattern.
 *
 * 2. **Route handlers.** `/api/*` renders outside the root layout and has no
 *    React root, so it is excluded rather than waited for — see `isAppPage`.
 *
 * 3. **Navigations that are not `goto`/`reload`.** A form submit that redirects
 *    is a real document navigation this fixture never sees, and
 *    `submitFormAndWaitForRedirect` resolves at `waitUntil: "commit"` —
 *    earlier still. That helper therefore calls {@link waitForHydration}
 *    itself. Any future helper that resolves on a navigation must do the same;
 *    a link click followed by `waitForURL` has the identical hole.
 *
 * 4. **Subtrees that hydrate after the root.** The beacon fires from an effect
 *    in the root layout, so it reports that the root commit landed — not that
 *    every interactive descendant has handlers. Anything inside a Suspense
 *    boundary (any segment with a `loading.tsx`, plus streamed segments) is
 *    still dehydrated at that moment, as is a `ssr: false` dynamic import such
 *    as `RichTextEditor`. For those, keep waiting on something the subtree
 *    itself produces — specs already wait for `.ProseMirror` to be visible,
 *    which is the right shape of check.
 *
 * So this narrows the window; it does not close it. A dropped click on a
 * Suspense-boundary child is still possible and is not evidence the fixture
 * regressed.
 */
import { test as base, expect, type Page } from "@playwright/test";

export { expect };

// Re-exported so a spec needs exactly one import line from here, rather than
// splitting values and types across two modules.
export type {
  APIRequestContext,
  BrowserContext,
  Locator,
  Page,
  TestInfo,
} from "@playwright/test";

/** Matches the attribute `HydrationBeacon` sets in `ClientProviders`. */
const HYDRATED_SELECTOR = "html[data-hydrated]";

/**
 * Generous on purpose: this replaces a race, so it should only ever fail when
 * hydration genuinely never happened — a broken page, not a slow one.
 */
const HYDRATION_TIMEOUT = process.env["CI"] ? 30_000 : 15_000;

/**
 * Route handlers render their own HTML without the root layout, so they have
 * no React root and never set the beacon.
 *
 * Checked against the URL the browser actually landed on rather than the one
 * passed in, so a redirect into or out of `/api` is classified by where it
 * ended up. `/api/unsubscribe` is the live example: it returns
 * `text/html; charset=utf-8` from a hand-rendered template, which is why
 * content-type cannot be the discriminator here.
 */
function isAppPage(page: Page): boolean {
  try {
    return !new URL(page.url()).pathname.startsWith("/api/");
  } catch {
    return true;
  }
}

/**
 * Thrown when the beacon never appears. Named so that callers which catch
 * broadly — `submitFormAndWaitForRedirect`'s branch races treat a `goto` throw
 * as "a sibling branch got there first" — can re-throw this one instead of
 * swallowing it into a bare test timeout.
 */
export class HydrationTimeoutError extends Error {
  override readonly name = "HydrationTimeoutError";
}

/**
 * Wait until React has hydrated the current document.
 *
 * Exported because navigation does not only happen through `goto`:
 * `submitFormAndWaitForRedirect` resolves on a URL commit, which this fixture
 * cannot see, so that helper calls this itself.
 */
export async function waitForHydration(
  page: Page,
  target: string
): Promise<void> {
  if (!isAppPage(page)) return;

  try {
    await page
      .locator(HYDRATED_SELECTOR)
      .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  } catch {
    // Deliberately NOT swallowed. Every page rendered through the root layout
    // carries the beacon, and the one surface that does not is excluded above.
    // So a miss here is a real hydration break — a client component throwing
    // during mount, say. Swallowing it would spend HYDRATION_TIMEOUT on every
    // navigation and then fail later at whatever got clicked next, pointing at
    // the wrong thing.
    throw new HydrationTimeoutError(
      `React never hydrated within ${String(HYDRATION_TIMEOUT)}ms after navigating to ${target}. ` +
        `Expected \`${HYDRATED_SELECTOR}\` (set by HydrationBeacon in ClientProviders). ` +
        `A client component most likely threw during mount — check the browser console in the trace.`
    );
  }
}

/**
 * Pages already wrapped. Wrapping twice nests the wrappers, so a single `goto`
 * would wait for hydration twice — and on a genuinely broken page would burn
 * `2 × HYDRATION_TIMEOUT` (60s in CI) against a 60s test timeout, replacing the
 * authored diagnostic with a bare "Test timeout exceeded".
 */
const wrapped = new WeakSet<Page>();

/**
 * Make `goto` and `reload` on this page wait for hydration before returning.
 *
 * The `page` fixture below applies this for you. Call it directly on pages you
 * construct yourself — `browser.newContext()` then `newPage()` — which the
 * fixture never sees. Idempotent, so passing an already-wrapped page is safe.
 */
export function attachHydrationWait(page: Page): Page {
  if (wrapped.has(page)) return page;
  wrapped.add(page);

  const originalGoto = page.goto.bind(page);
  const originalReload = page.reload.bind(page);

  page.goto = async (url, options) => {
    const response = await originalGoto(url, options);
    await waitForHydration(page, url);
    return response;
  };

  // A reload discards the document and with it `data-hydrated`, so the new
  // page races hydration exactly as a fresh `goto` would. Eleven specs reload
  // and then immediately interact.
  page.reload = async (options) => {
    const response = await originalReload(options);
    await waitForHydration(page, `${page.url()} (reload)`);
    return response;
  };

  return page;
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(attachHydrationWait(page));
  },
});
