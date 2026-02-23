/**
 * Smoke Test: Landing Page
 *
 * Tests for the public landing page that welcomes visitors to PinPoint.
 * Verifies the page loads with key elements and CTAs function correctly.
 *
 * Note: Navigation tests verify CTAs are clickable and initiate navigation.
 * The middleware task (PinPoint-nm6) will update routing to allow public access.
 */

import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("loads with welcome content and CTAs", async ({ page }) => {
    await page.goto("/");

    // Verify page title
    await expect(page).toHaveTitle(/PinPoint/);

    // Verify welcome heading
    await expect(
      page.getByRole("heading", { name: /Welcome to PinPoint/i })
    ).toBeVisible();

    // Verify APC logo is visible in the hero section (scoped by testid to avoid
    // matching the MobileHeader's APC logo on mobile viewports)
    await expect(page.getByTestId("hero-apc-logo")).toBeVisible();

    // Verify primary CTAs
    await expect(page.getByTestId("cta-browse-machines")).toBeVisible();
    await expect(page.getByTestId("cta-report-issue")).toBeVisible();

    // Verify dashboard link
    await expect(page.getByTestId("cta-dashboard")).toBeVisible();

    // Verify navigation elements in header (mobile or desktop header depending on viewport)
    await expect(
      page
        .locator('[data-testid="nav-signup"],[data-testid="mobile-nav-signup"]')
        .filter({ visible: true })
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid="nav-signin"],[data-testid="mobile-nav-signin"]')
        .filter({ visible: true })
    ).toBeVisible();
  });

  test("Browse Machines CTA is clickable and navigates", async ({ page }) => {
    await page.goto("/");

    // Click the CTA (per E2E Interaction Coverage rule)
    const browseLink = page.getByTestId("cta-browse-machines");
    await expect(browseLink).toHaveAttribute("href", "/m");
    await browseLink.click();

    // /m is a public route, unauthenticated users can access it directly
    await expect(page).toHaveURL("/m");
  });

  test("Report Issue CTA is clickable and navigates to /report", async ({
    page,
  }) => {
    await page.goto("/");

    // Click the CTA (per E2E Interaction Coverage rule)
    const reportLink = page.getByTestId("cta-report-issue");
    await expect(reportLink).toHaveAttribute("href", "/report");
    await reportLink.click();

    // /report is a public route, should navigate directly
    await expect(page).toHaveURL(/\/report/);
  });

  test("Dashboard link navigates to dashboard", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("cta-dashboard").click();

    // Should navigate to dashboard and show quick stats
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("quick-stats")).toBeVisible();
  });
});
