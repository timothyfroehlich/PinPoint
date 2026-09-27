/**
 * E2E Tests: Member Dashboard
 *
 * Critical journey: Dashboard displays assigned issues, recent issues,
 * newest games, recently fixed games, and quick stats after login.
 */

import { test, expect, type Page } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";

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

test.describe("Member Dashboard", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("dashboard loads with all sections", async ({ page }) => {
    await page.goto("/dashboard");

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

    // Newest Games
    await expect(
      page.getByRole("heading", { name: "Newest Games" })
    ).toBeVisible();
    const newestEmptyState = page.getByText("No machines yet");
    const newestMachinesList = page.getByTestId("newest-machines-list");
    const newestMachinesCount = await newestMachinesList.locator("a").count();
    const newestEmptyStateCount = await newestEmptyState.count();

    ensureCardsOrEmpty(
      newestMachinesCount,
      newestEmptyStateCount,
      "Newest games"
    );

    // Recently Fixed Games
    await expect(
      page.getByRole("heading", { name: "Recently Fixed Games" })
    ).toBeVisible();
    const fixedEmptyState = page.getByText("No recently fixed machines");
    const fixedMachinesList = page.getByTestId("recently-fixed-machines-list");
    const fixedMachinesCount = await fixedMachinesList.locator("a").count();
    const fixedEmptyStateCount = await fixedEmptyState.count();

    ensureCardsOrEmpty(
      fixedMachinesCount,
      fixedEmptyStateCount,
      "Recently fixed games"
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

  test("stat cards navigate to filtered lists", async ({ page }) => {
    await page.goto("/dashboard");

    const quickStats = page.getByTestId("quick-stats");

    // Verify all stat card links point to the correct filtered URLs via href
    // (avoids costly navigate-back-navigate cycles for each card)

    // Open Issues — href check only
    const openIssuesCard = quickStats
      .getByRole("link")
      .filter({ hasText: "Open Issues" });
    await expect(openIssuesCard).toHaveAttribute(
      "href",
      /\/issues\?status=new,confirmed,in_progress,need_parts,need_help,wait_owner/
    );

    // Machines Needing Service — href check only
    const machinesCard = quickStats
      .getByRole("link")
      .filter({ hasText: "Machines Needing Service" });
    await expect(machinesCard).toHaveAttribute(
      "href",
      /\/m\?status=unplayable,needs_service/
    );

    // Assigned to Me — actually click to verify end-to-end navigation
    const assignedCard = quickStats
      .getByRole("link")
      .filter({ hasText: "Assigned to Me" });
    // Verify href contains assignee UUID and status filter
    await expect(assignedCard).toHaveAttribute(
      "href",
      /\/issues\?assignee=[a-f0-9-]+&status=new,confirmed,in_progress,need_parts,need_help,wait_owner/
    );
    await assignedCard.click();
    await expect(page).toHaveURL(
      /\/issues\?assignee=[a-f0-9-]+&status=new,confirmed,in_progress,need_parts,need_help,wait_owner/
    );
  });
});
