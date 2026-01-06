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

/**
 * Submit a form and wait for Server Action redirect to complete
 *
 * Safari-specific issues:
 * - Server Action redirects may not trigger immediately
 * - Safari may stay on the current page longer than other browsers
 * - Need explicit wait for URL change, not just network idle
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
    /** Maximum time to wait for redirect (default: 30000ms) */
    timeout?: number;
  }
): Promise<void> {
  const currentUrl = page.url();
  const awayFrom = options?.awayFrom ?? new URL(currentUrl).pathname;
  const timeout = options?.timeout ?? 30000;

  await submitButton.click();

  // Wait for URL to change away from current page
  // This is more reliable than waitForLoadState for Safari Server Actions
  await page.waitForURL((url) => !url.pathname.startsWith(awayFrom), {
    timeout,
  });
}

/**
 * Wait for a Server Action redirect to complete and page content to be ready
 *
 * Combines URL change detection with content verification for maximum reliability.
 * Use when you need to ensure both navigation and hydration have completed.
 *
 * @param page - Playwright Page object
 * @param submitButton - The submit button locator
 * @param options - Configuration including expected content
 */
export async function submitFormAndWaitForContent(
  page: Page,
  submitButton: Locator,
  options: {
    /** Path to wait for navigation away from */
    awayFrom: string;
    /** Expected URL pattern or predicate */
    expectedUrl: string | RegExp | ((url: URL) => boolean);
    /** Locator for content that proves page is ready (optional) */
    expectedContent?: Locator;
    /** Timeout in milliseconds */
    timeout?: number;
  }
): Promise<void> {
  const timeout = options.timeout ?? 30000;

  await submitButton.click();

  // First, wait for URL to change away from current page
  await page.waitForURL((url) => !url.pathname.startsWith(options.awayFrom), {
    timeout,
  });

  // Then verify we're on the expected URL
  if (typeof options.expectedUrl === "function") {
    await page.waitForURL(options.expectedUrl, { timeout });
  } else {
    await page.waitForURL(options.expectedUrl, { timeout });
  }

  // Finally, if expected content is specified, wait for it
  if (options.expectedContent) {
    await options.expectedContent.waitFor({ state: "visible", timeout });
  }
}

/**
 * Wait for authenticated page to be fully ready
 *
 * Safari may be slower to:
 * - Resolve auth session
 * - Hydrate React components
 * - Attach event handlers
 *
 * @param page - Playwright Page object
 */
export async function waitForAuthenticatedPage(page: Page): Promise<void> {
  // Wait for network to settle
  await page.waitForLoadState("networkidle");

  // Also wait for a known authenticated element to ensure session is resolved
  await page.waitForSelector(
    '[data-testid="user-menu-button"], [data-testid="mobile-menu-trigger"]',
    { timeout: 10000 }
  );
}
