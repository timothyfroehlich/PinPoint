/**
 * E2E Tests: Navigation Component
 *
 * Tests navigation bar behavior for authenticated and unauthenticated states.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";

test.describe.serial("Navigation", () => {
  test("unauthenticated navigation - show Sign In and Sign Up buttons", async ({
    page,
  }) => {
    // Navigate to home page
    await page.goto("/");

    // Verify navigation shows PinPoint logo
    await expect(page.getByText("PinPoint").first()).toBeVisible();

    // Verify Sign In and Sign Up buttons are visible (use test ids to avoid strict conflicts)
    await expect(page.getByTestId("nav-signin")).toBeVisible();
    await expect(page.getByTestId("nav-signup")).toBeVisible();

    // Verify Report Issue shortcut is available to guests
    await expect(
      page.getByRole("link", { name: "Report Issue" })
    ).toBeVisible();
  });

  test("authenticated navigation - show quick links and user menu", async ({
    page,
  }) => {
    // Login first
    await loginAs(page);

    // Sidebar (navigation) should be present for authenticated pages
    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).toBeVisible();

    // Verify primary navigation links exist
    await expect(
      sidebar.getByRole("link", { name: "Dashboard" })
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Machines" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Issues" })).toBeVisible();

    // Settings + Sign Out entries should be present
    await expect(sidebar.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(page.getByTestId("sidebar-signout")).toBeVisible();
  });
});
