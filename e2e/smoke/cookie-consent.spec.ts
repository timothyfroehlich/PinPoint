/**
 * Smoke Test: Cookie Consent Banner
 *
 * Verifies the cookie consent banner appears on first visit,
 * can be dismissed, and stays dismissed on subsequent visits.
 */

import { test, expect } from "@playwright/test";

// Override the default storageState (which pre-sets the consent cookie)
// so the banner actually appears during these tests.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Cookie Consent Banner", () => {
  test("appears on first visit and dismisses on click", async ({ page }) => {
    await page.goto("/");

    // Banner should be visible
    const banner = page.getByRole("region", {
      name: /cookie consent/i,
    });
    await expect(banner).toBeVisible();

    // Verify text content
    await expect(banner).toContainText(
      "PinPoint uses cookies for authentication"
    );

    // Verify "Learn more" links to privacy policy
    const learnMore = banner.getByRole("link", { name: /learn more/i });
    await expect(learnMore).toHaveAttribute("href", "/privacy");

    // Click "Got it" to dismiss
    await banner.getByRole("button", { name: /got it/i }).click();

    // Banner should disappear
    await expect(banner).not.toBeVisible();

    // Reload — banner should stay dismissed (cookie persists)
    await page.reload();
    await expect(banner).not.toBeVisible();
  });
});
