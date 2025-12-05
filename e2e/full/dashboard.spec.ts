/**
 * E2E Tests: Member Dashboard
 *
 * Critical journey: Dashboard displays assigned issues, recent issues,
 * unplayable machines, and quick stats after login.
 */

import { test, expect, type Page } from "@playwright/test";
import { ensureLoggedIn } from "../support/actions";

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
  test("dashboard loads with all sections", async ({ page }) => {
    await ensureLoggedIn(page);

    // Quick Stats
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

    // Assigned Issues
    await expect(
      page.getByRole("heading", { name: "Issues Assigned to Me" })
    ).toBeVisible();
    const assignedEmptyState = page.getByText("No issues assigned to you");
    const assignedCards = page.getByTestId("assigned-issue-card");
    const assignedCardsCount = await assignedCards.count();
    const assignedEmptyStateCount = await assignedEmptyState.count();

    ensureCardsOrEmpty(
      assignedCardsCount,
      assignedEmptyStateCount,
      "Assigned issues"
    );

    // Unplayable Machines
    await expect(
      page.getByRole("heading", { name: "Unplayable Machines" })
    ).toBeVisible();
    const unplayableEmptyState = page.getByText("All machines are playable");
    const unplayableCards = page.getByTestId("unplayable-machine-card");
    const unplayableCardsCount = await unplayableCards.count();
    const unplayableEmptyStateCount = await unplayableEmptyState.count();

    ensureCardsOrEmpty(
      unplayableCardsCount,
      unplayableEmptyStateCount,
      "Unplayable machines"
    );

    // Recent Issues
    await expect(
      page.getByRole("heading", { name: "Recently Reported Issues" })
    ).toBeVisible();
    const recentEmptyState = page.getByText("No issues reported yet");
    const recentCards = page.getByTestId("recent-issue-card");
    const recentCardsCount = await recentCards.count();
    const recentEmptyStateCount = await recentEmptyState.count();

    ensureCardsOrEmpty(
      recentCardsCount,
      recentEmptyStateCount,
      "Recent issues"
    );
  });

  test("dashboard issue cards link to issue detail pages", async ({ page }) => {
    await ensureLoggedIn(page);

    // Check if there are any issue cards
    const issueCards = page.getByTestId("recent-issue-card");
    const count = await issueCards.count();

    if (count > 0) {
      // Click the first issue card
      const firstIssue = issueCards.first();
      // Get the title from the card to verify on detail page
      const issueTitle = await firstIssue.getByRole("heading").innerText();
      await firstIssue.click();

      // Should navigate to issue detail page
      await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);

      // Use filter to find the specific h1 containing the title, avoiding strict mode violation
      // with the Dashboard h1
      await expect(
        page
          .getByRole("main")
          .getByRole("heading", { level: 1, name: issueTitle })
      ).toBeVisible();
    }
  });
});
