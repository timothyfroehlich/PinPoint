/**
 * Smoke Test: Landing Page
 *
 * Single comprehensive smoke test to verify the landing page loads and functions.
 * This is the most basic E2E test to ensure the application is running.
 */

import { test, expect } from "@playwright/test";

test("public dashboard loads with key elements", async ({ page }) => {
  // Navigate to the home page (should redirect to dashboard)
  await page.goto("/");

  // Verify page title
  await expect(page).toHaveTitle(/PinPoint/);

  // Verify Quick Stats are visible (guest access)
  await expect(page.getByTestId("quick-stats")).toBeVisible();

  // Verify key navigation elements in header
  await expect(page.getByTestId("nav-signup")).toBeVisible();
  await expect(page.getByTestId("nav-signin")).toBeVisible();
  await expect(page.getByTestId("nav-report-issue")).toBeVisible();
});
