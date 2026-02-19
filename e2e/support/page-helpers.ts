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
    await page.getByLabel("Description").fill(description);
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
