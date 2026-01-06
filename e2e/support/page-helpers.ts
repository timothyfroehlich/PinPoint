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
    /** Maximum time to wait for redirect (default: 60000ms for Safari) */
    timeout?: number;
  }
): Promise<void> {
  const currentUrl = page.url();
  const awayFrom = options?.awayFrom ?? new URL(currentUrl).pathname;
  const timeout = options?.timeout ?? 60000; // Increased from 30s to 60s for WebKit

  await submitButton.click();

  // Wait for URL to change away from current page
  // This is more reliable than waitForLoadState for Safari Server Actions
  await page.waitForURL((url) => !url.pathname.startsWith(awayFrom), {
    timeout,
  });
}
