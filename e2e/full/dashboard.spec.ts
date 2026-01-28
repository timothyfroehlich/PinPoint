/**
 * E2E Tests: Member Dashboard
 *
 * Critical journey: Dashboard displays assigned issues, recent issues,
 * newest games, recently fixed games, and quick stats after login.
 */

import { test, expect, type Page } from "@playwright/test";
import { ensureLoggedIn } from "../support/actions.js";
import { getTestPrefix } from "../support/test-isolation.js";

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
  test("dashboard loads with all sections", async ({ page }, testInfo) => {
    await ensureLoggedIn(page, testInfo);

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

  test("dashboard issue cards link to issue detail pages", async ({
    page,
  }, testInfo) => {
    await ensureLoggedIn(page, testInfo);

    // Check if there are any issue cards belonging to this worker
    // Other workers might be creating issues simultaneously
    const testPrefix = getTestPrefix();
    const issueCards = page
      .getByTestId("recent-issue-card")
      .filter({ hasText: `[${testPrefix}]` });
    const count = await issueCards.count();

    if (count > 0) {
      // Click the first issue card
      const firstIssue = issueCards.first();
      // Get the title from the card to verify on detail page
      const issueTitle = await firstIssue.getByRole("heading").innerText();
      await firstIssue.click();

      // Should navigate to issue detail page OR login page with next param
      await expect(page).toHaveURL(
        /(\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+)|(login\?next=%2Fm%2F.+)/
      );

      // Add a small delay to allow the page to stabilize
      await page.waitForTimeout(500);

      // Use filter to find the specific h1 containing the title, avoiding strict mode violation
      // with the Dashboard h1 or the Austin Pinball Collective logo
      // Verify title matches
      // Replace all spaces with \s+ in the regex for flexibility
      const titlePattern = issueTitle
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s+");
      const heading = page.getByRole("main").getByRole("heading", {
        level: 1,
        name: new RegExp(titlePattern),
      });

      await expect(heading).toBeVisible();
      // Allow for some whitespace variation
      const headingText = await heading.innerText();
      expect(headingText.replace(/\s+/g, " ").trim()).toBe(
        issueTitle.replace(/\s+/g, " ").trim()
      );
    }
  });
});
