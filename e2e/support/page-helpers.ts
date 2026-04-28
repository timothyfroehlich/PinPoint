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

/**
 * Submit a form and wait for Server Action redirect to complete
 *
 * For authenticated users, the /report Server Action returns
 * `{ success: true, redirectTo: "/m/TAF/i/42" }` in the RSC wire format.
 * The client form then calls `window.location.assign(redirectTo)`.
 *
 * Strategy: Race between two branches:
 *
 * Branch A: waitForURL — browser navigates on its own (Chromium/Firefox/fast WebKit)
 * Branch B: waitForResponse() captures the POST response body and extracts redirectTo
 *   from the RSC wire format, then calls page.goto() directly. This bypasses
 *   window.location.assign() for Mobile Safari where WebKit stalls navigation.
 *
 * IMPORTANT: waitForResponse() must be set up BEFORE submitButton.click() so that
 * Playwright is already buffering the response when it arrives. Using page.on('response')
 * with async response.text() fails in WebKit because the response body stream may be
 * closed before the async callback can read it.
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

  // Branch B: set up waitForResponse BEFORE clicking so Playwright buffers the body.
  // page.on('response') with async .text() fails in WebKit because the response stream
  // may be closed before the callback fires. waitForResponse() buffers the full body.
  //
  // Filter to the POST that goes to the form's own URL (awayFrom path), not third-party
  // POSTs (e.g. Cloudflare Turnstile). This ensures we capture the Server Action response.
  //
  // This promise only resolves when it successfully navigates (found redirectTo + goto done).
  // If no redirectTo is found (e.g. anonymous form with server-side redirect), this promise
  // never resolves, so Branch A (waitForURL) wins the race instead.
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
        if (match?.[1]) {
          // Found redirectTo in RSC wire format — navigate directly via Playwright.
          // This bypasses window.location.assign() which stalls in Mobile Safari.
          await page.goto(match[1], { waitUntil: "domcontentloaded" });
          resolve();
        }
        // If no redirectTo found (e.g. anonymous form redirect), Branch A handles it.
        // Do NOT resolve here — let Branch A win the race.
      })
      .catch(() => {
        // If waitForResponse times out or fails, Branch A is already racing.
        // Do NOT resolve — let Branch A handle navigation detection.
      });
  });

  await submitButton.click();

  // Branch A: wait for the browser to navigate away from awayFrom naturally.
  // Branch B runs concurrently via the response promise established above.
  // Use "commit" so waitForURL resolves as soon as the URL commits,
  // without waiting for page resources (prevents stalling in Mobile Safari).
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith(awayFrom), {
      timeout,
      waitUntil: "commit",
    }),
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
