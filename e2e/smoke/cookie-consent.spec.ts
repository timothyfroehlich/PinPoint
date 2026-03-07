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
import { ENABLE_COOKIE_BANNER_OVERRIDE_KEY } from "~/lib/cookies/constants";

test.describe("Cookie Consent Banner", () => {
  // Override the default storageState to specifically enable the banner for this test.
  // Even though it's disabled by default in E2E/Dev/Preview, the override
  // cookie will trigger its visibility in RootLayout.
  test.use({
    storageState: {
      cookies: [
        {
          name: ENABLE_COOKIE_BANNER_OVERRIDE_KEY,
          value: "true",
          domain: process.env.PLAYWRIGHT_HOST ?? "localhost",
          path: "/",
        },
      ],
      origins: [],
    },
  });

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

    // Remove Next.js dev overlay that intercepts pointer events on mobile
    // viewports. CI runs against `next dev`, so the <nextjs-portal> overlay
    // blocks clicks on fixed-position elements on small screens.
    await page.evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    });

    // Click "Got it" to dismiss
    const gotItButton = banner.getByRole("button", { name: /got it/i });
    await gotItButton.click();

    // Banner should disappear
    await expect(banner).not.toBeVisible();

    // Reload — banner should stay dismissed (cookie persists)
    await page.reload({ waitUntil: "networkidle" });
    await expect(banner).not.toBeVisible();
  });
});
