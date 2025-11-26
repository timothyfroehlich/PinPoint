/**
 * Smoke Test: Landing Page
 *
 * Single comprehensive smoke test to verify the landing page loads and functions.
 * This is the most basic E2E test to ensure the application is running.
 */

import { test, expect } from "@playwright/test";

test("landing page loads with all key elements", async ({ page }) => {
  // Navigate to the home page
  await page.goto("/");

  // Verify page title
  await expect(page).toHaveTitle(/PinPoint/);

  // Verify main heading
  await expect(page.getByRole("heading", { name: "PinPoint" })).toBeVisible();

  // Verify key navigation elements
  await expect(page.getByTestId("nav-signup")).toBeVisible();
  await expect(page.getByTestId("nav-signin")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Report an Issue" })
  ).toBeVisible();
});
