/**
 * Smoke Test: Cookie Consent Banner
 *
 * Verifies the cookie consent banner appears on first visit,
 * can be dismissed, and stays dismissed on subsequent visits.
 *
 * Uses /m (public machines list) instead of / (landing page) for faster,
 * more reliable hydration on mobile viewports in CI.
 */

import { test, expect } from "@playwright/test";

// Override the default storageState (which pre-sets the consent cookie)
// so the banner actually appears during these tests.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Cookie Consent Banner", () => {
  test("appears on first visit and dismisses on click", async ({ page }) => {
    await page.goto("/m", { waitUntil: "networkidle" });

    // Banner should be visible after client hydration
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

    // Click "Got it" to dismiss — use the button locator and ensure it's ready
    const gotItButton = banner.getByRole("button", { name: /got it/i });
    await gotItButton.scrollIntoViewIfNeeded();
    await gotItButton.click();

    // Banner should disappear
    await expect(banner).not.toBeVisible();

    // Reload — banner should stay dismissed (cookie persists)
    await page.reload({ waitUntil: "networkidle" });
    await expect(banner).not.toBeVisible();
  });
});
