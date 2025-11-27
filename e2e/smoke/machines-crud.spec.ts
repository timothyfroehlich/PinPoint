/**
 * E2E Tests: Machine CRUD Operations
 *
 * Tests machine list, creation, and detail page functionality.
 */

import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "../support/actions";
import { cleanupTestEntities, extractIdFromUrl } from "../support/cleanup";

const createdMachineIds = new Set<string>();

const rememberMachineId = (url: string): void => {
  const machineId = extractIdFromUrl(url);
  if (machineId) {
    createdMachineIds.add(machineId);
  }
};

test.describe("Machines CRUD", () => {
  test.describe.configure({ mode: "serial" });

  // Login before each test (required for protected routes)
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test.afterEach(async ({ request }) => {
    if (!createdMachineIds.size) {
      return;
    }
    await cleanupTestEntities(request, {
      machineIds: Array.from(createdMachineIds),
    });
    createdMachineIds.clear();
  });

  test("should display machine list page", async ({ page }) => {
    // Navigate to machines page
    await page.goto("/machines");

    // Verify we're on the machines page
    await expect(page).toHaveURL("/machines");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();

    // Should have an "Add Machine" button
    await expect(
      page.getByRole("link", { name: /Add Machine/i })
    ).toBeVisible();
  });

  test("should display seeded test machines with correct statuses", async ({
    page,
  }) => {
    // Navigate to machines page
    await page.goto("/machines");

    const machineCards = page.getByTestId("machine-card");
    const cardCount = await machineCards.count();

    // We seed 3 machines; other tests may add more but we should always have at least the seeds
    expect(cardCount).toBeGreaterThanOrEqual(3);

    // Every card should surface a status badge and an open-issue count
    for (let i = 0; i < cardCount; i += 1) {
      const card = machineCards.nth(i);
      await expect(
        card.getByText(/Operational|Needs Service|Unplayable/)
      ).toBeVisible();
      const countText = await card
        .locator('[data-testid^="machine-open-issues-count"]')
        .innerText();
      expect(Number.isNaN(Number.parseInt(countText, 10))).toBe(false);
    }

    // Sanity: the seeded unplayable machine should surface as unplayable
    const addamsCard = page.locator('a:has-text("The Addams Family")');
    await expect(addamsCard.getByText("Unplayable")).toBeVisible();
  });

  test("should create a new machine", async ({ page }) => {
    // Navigate to machines page
    await page.goto("/machines");

    // Click "Add Machine" button
    await page.getByRole("link", { name: /Add Machine/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL("/machines/new");
    await expect(
      page.getByRole("heading", { name: "Add New Machine" })
    ).toBeVisible();

    // Fill out the form
    const timestamp = Date.now();
    const machineName = `Test Machine ${timestamp}`;
    await page.locator("#name").fill(machineName);

    // Submit form
    await page.getByRole("button", { name: "Create Machine" }).click();

    // Should redirect to machine detail page
    await expect(page).toHaveURL(/\/machines\/[a-f0-9-]+$/, {
      timeout: 10000,
    });

    rememberMachineId(page.url());

    // Verify machine name is displayed
    await expect(
      page.getByRole("heading", { name: machineName })
    ).toBeVisible();

    // Verify status is "Operational" (no issues yet)
    await expect(page.getByTestId("machine-status-badge")).toHaveText(
      "Operational"
    );
  });

  test("should display machine issues on detail page", async ({ page }) => {
    // Navigate to The Addams Family (has unplayable issue)
    await page.goto("/machines");
    await page.getByRole("link", { name: "The Addams Family" }).first().click();

    // Should show machine details
    await expect(
      page.getByRole("heading", { name: "The Addams Family" })
    ).toBeVisible();

    // Verify status badge matches severity
    const firstIssueCard = page.getByTestId("issue-card").first();
    await expect(firstIssueCard).toBeVisible();

    // Verify open issues count section is visible
    await expect(page.getByTestId("detail-open-issues")).toBeVisible();
    await expect(page.getByTestId("detail-open-issues-count")).toBeVisible();

    // Dynamic count verification: count visible issue cards and verify matches displayed count
    const issueCards = page.getByTestId("issue-card");
    const displayedCountText = await page
      .getByTestId("detail-open-issues-count")
      .textContent();
    const displayedCount = Number(displayedCountText);
    const actualCardCount = await issueCards.count();

    expect(actualCardCount).toBe(displayedCount);
    expect(actualCardCount).toBeGreaterThan(0); // Ensure we have issues to display

    // Verify specific seed issues are listed
    await expect(page.getByText("Ball stuck in Thing's box")).toBeVisible();
    await expect(page.getByText("Bear Kick opto not working")).toBeVisible();
  });

  test("should show empty state for machine with no issues", async ({
    page,
  }) => {
    // Create a new machine
    await page.goto("/machines/new");
    const machineName = `Empty Machine ${Date.now()}`;
    await page.locator("#name").fill(machineName);
    await page.getByRole("button", { name: "Create Machine" }).click();

    // Should be on detail page
    await expect(page).toHaveURL(/\/machines\/[a-f0-9-]+$/);

    // Should show empty state for issues
    await expect(page.getByText("No issues reported yet")).toBeVisible();
    await expect(page.getByTestId("detail-open-issues-count")).toContainText(
      "0"
    );

    rememberMachineId(page.url());
  });
});
