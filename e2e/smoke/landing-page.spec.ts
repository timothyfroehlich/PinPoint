/**
 * Smoke Test: Landing Page
 *
 * Minimal smoke test to verify the landing page loads successfully.
 * This is the most basic E2E test to ensure the application is running.
 */

import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should load successfully", async ({ page }) => {
    // Navigate to the home page
    await page.goto("/");

    // Verify page loaded by checking for the title
    await expect(page.getByRole("heading", { name: "PinPoint" })).toBeVisible();
  });

  test("should display navigation buttons", async ({ page }) => {
    await page.goto("/");

    // Verify key navigation elements are present
    await expect(page.getByRole("link", { name: "Sign Up" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Report an Issue" })
    ).toBeVisible();
  });

  test("should have correct page title", async ({ page }) => {
    await page.goto("/");

    // Verify page title is set
    await expect(page).toHaveTitle(/PinPoint/);
  });
});
