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
 * nobody has written yet. Waiting once per navigation covers all of them.
 *
 * ## What it does not cover
 *
 * The beacon reports that the *page* hydrated, not that a lazily-imported
 * island mounted. `RichTextEditor` is a `ssr: false` dynamic import and is
 * genuinely outside this guarantee — specs already wait for `.ProseMirror` to
 * be visible, which is the right check for it.
 */
import { test as base, expect } from "@playwright/test";

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

export const test = base.extend({
  page: async ({ page }, use) => {
    const originalGoto = page.goto.bind(page);

    page.goto = async (url, options) => {
      const response = await originalGoto(url, options);
      // A `goto` that lands somewhere without our layout — an API route, a
      // redirect to an external page — has no beacon to wait for and must not
      // be turned into a failure. Only the app's own pages are guaranteed one.
      await page
        .locator(HYDRATED_SELECTOR)
        .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT })
        .catch(() => undefined);
      return response;
    };

    await use(page);
  },
});
