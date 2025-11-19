/**
 * E2E Tests: Member Dashboard
 *
 * Critical journey: Dashboard displays assigned issues, recent issues,
 * unplayable machines, and quick stats after login.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";
import { seededMember } from "../support/constants";

test.describe.serial("Member Dashboard", () => {
  test("login redirects to dashboard", async ({ page }) => {
    await loginAs(page);

    // Should be on dashboard after login
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("dashboard displays welcome message with user name", async ({
    page,
  }) => {
    await loginAs(page);

    // Verify welcome message with user's name
    await expect(
      page.getByText(`Welcome back, ${seededMember.name}`)
    ).toBeVisible();
  });

  test("dashboard displays quick stats section", async ({ page }) => {
    await loginAs(page);

    // Verify Quick Stats heading
    await expect(
      page.getByRole("heading", { name: "Quick Stats" })
    ).toBeVisible();

    // Verify all 3 stat cards exist
    const main = page.getByRole("main");
    await expect(main.getByText("Open Issues")).toBeVisible();
    await expect(main.getByText("Machines Needing Service")).toBeVisible();
    await expect(main.getByText("Assigned to Me")).toBeVisible();
  });

  test("dashboard displays assigned issues section", async ({ page }) => {
    await loginAs(page);

    // Verify section heading
    await expect(
      page.getByRole("heading", { name: "Issues Assigned to Me" })
    ).toBeVisible();

    // Section should either show issues or empty state
    const main = page.getByRole("main");
    const emptyState = main.getByText("No issues assigned to you");
    const hasEmptyState = (await emptyState.count()) > 0;

    if (!hasEmptyState) {
      // If not empty, should have issue cards that are clickable links
      const issueCards = page.locator('a[href^="/issues/"]').first();
      await expect(issueCards).toBeVisible();
    }
  });

  test("dashboard displays unplayable machines section", async ({ page }) => {
    await loginAs(page);

    // Verify section heading
    await expect(
      page.getByRole("heading", { name: "Unplayable Machines" })
    ).toBeVisible();

    // Section should either show machines or empty state
    const main = page.getByRole("main");
    const emptyState = main.getByText("All machines are playable");
    const hasEmptyState = (await emptyState.count()) > 0;

    if (!hasEmptyState) {
      // If not empty, should have machine cards that are clickable links
      const machineCards = page.locator('a[href^="/machines/"]').first();
      await expect(machineCards).toBeVisible();
    }
  });

  test("dashboard displays recently reported issues section", async ({
    page,
  }) => {
    await loginAs(page);

    // Verify section heading
    await expect(
      page.getByRole("heading", { name: "Recently Reported Issues" })
    ).toBeVisible();

    // Section should either show issues or empty state
    const main = page.getByRole("main");
    const emptyState = main.getByText("No issues reported yet");
    const hasEmptyState = (await emptyState.count()) > 0;

    if (!hasEmptyState) {
      // If not empty, should have issue cards that are clickable links
      const issueCards = page.locator('a[href^="/issues/"]');
      await expect(issueCards.first()).toBeVisible();
    }
  });

  test("dashboard issue cards link to issue detail pages", async ({ page }) => {
    await loginAs(page);

    // Check if there are any issue cards
    const issueCards = page.locator('a[href^="/issues/"]');
    const count = await issueCards.count();

    if (count > 0) {
      // Click the first issue card
      const firstIssue = issueCards.first();
      await firstIssue.click();

      // Should navigate to issue detail page
      await expect(page).toHaveURL(/\/issues\/[0-9a-f-]+/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("dashboard machine cards link to machine detail pages", async ({
    page,
  }) => {
    await loginAs(page);

    // Check if there are any machine cards (in unplayable section)
    const machineCards = page.locator('a[href^="/machines/"]');
    const count = await machineCards.count();

    if (count > 0) {
      // Click the first machine card
      const firstMachine = machineCards.first();
      await firstMachine.click();

      // Should navigate to machine detail page
      await expect(page).toHaveURL(/\/machines\/[0-9a-f-]+/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("dashboard is responsive on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await loginAs(page);

    // Dashboard should still be visible and functional
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(
      page.getByText(`Welcome back, ${seededMember.name}`)
    ).toBeVisible();

    // All sections should be visible (stacked vertically on mobile)
    await expect(
      page.getByRole("heading", { name: "Quick Stats" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Issues Assigned to Me" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Unplayable Machines" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recently Reported Issues" })
    ).toBeVisible();
  });

  test("unauthenticated user redirects to login when accessing dashboard", async ({
    page,
  }) => {
    // Try to access dashboard without logging in
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL("/login");
  });
});
