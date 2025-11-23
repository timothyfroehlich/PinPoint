/**
 * E2E Tests: Navigation Component
 *
 * Tests navigation bar behavior for authenticated and unauthenticated states.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";
import { seededMember } from "../support/constants";

test.describe.serial("Navigation", () => {
  test("unauthenticated navigation - show Sign In and Sign Up buttons", async ({
    page,
  }) => {
    // Navigate to home page
    await page.goto("/");

    // Verify navigation shows PinPoint logo
    await expect(page.getByText("PinPoint").first()).toBeVisible();

    // Verify Sign In and Sign Up buttons are visible
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Sign In" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Sign Up" })).toBeVisible();

    // Verify Report Issue shortcut is available to guests
    await expect(nav.getByRole("link", { name: "Report Issue" })).toBeVisible();
  });

  test("authenticated navigation - show quick links and user menu", async ({
    page,
  }) => {
    // Login first
    await loginAs(page);

    // Verify navigation shows PinPoint logo
    const nav = page.getByRole("navigation");
    await expect(nav.getByText("PinPoint").first()).toBeVisible();

    // Verify quick links are visible
    await expect(nav.getByRole("link", { name: /Issues/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Report/i })).toBeVisible();

    // Verify user info is visible (name and email)
    await expect(nav.getByText(seededMember.name)).toBeVisible();
    await expect(nav.getByText(seededMember.email)).toBeVisible();

    // Verify Sign In/Sign Up buttons are NOT visible
    await expect(nav.getByRole("link", { name: "Sign In" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Sign Up" })).not.toBeVisible();
  });
});
