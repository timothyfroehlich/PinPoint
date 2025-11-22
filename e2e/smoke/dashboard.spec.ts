/**
 * E2E Tests: Member Dashboard
 *
 * Critical journey: Dashboard displays assigned issues, recent issues,
 * unplayable machines, and quick stats after login.
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "../support/actions";

async function getStatNumber(page: Page, testId: string): Promise<number> {
  const rawText = await page.getByTestId(testId).innerText();
  const value = Number.parseInt(rawText.replace(/[^0-9]/g, ""), 10);
  expect(Number.isNaN(value)).toBe(false);
  return value;
}

function ensureCardsOrEmpty(
  cardsCount: number,
  emptyStateCount: number,
  label: string
): void {
  expect(cardsCount + emptyStateCount).toBeGreaterThan(0);
  if (cardsCount === 0 && emptyStateCount === 0) {
    throw new Error(`${label}: neither cards nor empty state rendered`);
  }
}

test.describe.serial("Member Dashboard", () => {
  test("login redirects to dashboard", async ({ page }) => {
    await loginAs(page);

    // Should be on dashboard after login
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("dashboard displays quick stats section", async ({ page }) => {
    await loginAs(page);

    await expect(
      page.getByRole("heading", { name: "Quick Stats" })
    ).toBeVisible();
    const quickStats = page.getByTestId("quick-stats");
    await expect(quickStats).toBeVisible();

    const openIssues = await getStatNumber(page, "stat-open-issues-value");
    const machinesNeedingService = await getStatNumber(
      page,
      "stat-machines-needing-service-value"
    );
    const assignedToMe = await getStatNumber(page, "stat-assigned-to-me-value");

    expect(openIssues).toBeGreaterThanOrEqual(0);
    expect(machinesNeedingService).toBeGreaterThanOrEqual(0);
    expect(assignedToMe).toBeGreaterThanOrEqual(0);
  });

  test("dashboard displays assigned issues section", async ({ page }) => {
    await loginAs(page);

    // Verify section heading
    await expect(
      page.getByRole("heading", { name: "Issues Assigned to Me" })
    ).toBeVisible();

    // Section should either show issues or empty state
    const emptyState = page.getByText("No issues assigned to you");
    const cards = page.getByTestId("assigned-issue-card");
    const cardsCount = await cards.count();
    const emptyStateCount = await emptyState.count();

    ensureCardsOrEmpty(cardsCount, emptyStateCount, "Assigned issues");

    const assignedCount = await getStatNumber(
      page,
      "stat-assigned-to-me-value"
    );
    if (assignedCount === 0) {
      await expect(emptyState).toBeVisible();
      expect(cardsCount).toBe(0);
    } else {
      expect(cardsCount).toBe(assignedCount);
      await expect(cards.first()).toBeVisible();
    }
  });

  test("dashboard displays unplayable machines section", async ({ page }) => {
    await loginAs(page);

    // Verify section heading
    await expect(
      page.getByRole("heading", { name: "Unplayable Machines" })
    ).toBeVisible();

    // Section should either show machines or empty state
    const emptyState = page.getByText("All machines are playable");
    const machineCards = page.getByTestId("unplayable-machine-card");
    const cardsCount = await machineCards.count();
    const emptyStateCount = await emptyState.count();

    ensureCardsOrEmpty(cardsCount, emptyStateCount, "Unplayable machines");

    if (cardsCount > 0) {
      await expect(machineCards.first()).toBeVisible();
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
    const emptyState = page.getByText("No issues reported yet");
    const cards = page.getByTestId("recent-issue-card");
    const cardsCount = await cards.count();
    const emptyStateCount = await emptyState.count();

    ensureCardsOrEmpty(cardsCount, emptyStateCount, "Recent issues");

    if (cardsCount > 0) {
      await expect(cards.first()).toBeVisible();
    }
  });

  test("dashboard issue cards link to issue detail pages", async ({ page }) => {
    await loginAs(page);

    // Check if there are any issue cards
    const issueCards = page.getByTestId("recent-issue-card");
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
    const machineCards = page.getByTestId("unplayable-machine-card");
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
