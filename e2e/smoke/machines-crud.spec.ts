/**
 * E2E Tests: Machine CRUD Operations
 *
 * Tests machine list, creation, and detail page functionality.
 */

import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "../support/actions";
import { cleanupTestEntities } from "../support/cleanup";
import { seededMachines } from "../support/constants";

const createdMachineIds = new Set<string>();

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
    // Navigate to machines page (new URL: /m)
    await page.goto("/m");

    // Verify we're on the machines page
    await expect(page).toHaveURL("/m");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();

    // Should have an "Add Machine" button
    await expect(
      page.getByRole("link", { name: /Add Machine/i })
    ).toBeVisible();
  });

  test("should display seeded test machines with correct statuses", async ({
    page,
  }) => {
    // Navigate to machines page (new URL: /m)
    await page.goto("/m");

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
    const addamsCard = page.locator(
      `a:has-text("${seededMachines.addamsFamily.name}")`
    );
    await expect(addamsCard.getByText("Unplayable")).toBeVisible();
  });

  test("should create a new machine", async ({ page }) => {
    // Navigate to add new machine page (new URL: /m/new)
    await page.goto("/m/new");
    await expect(page).toHaveURL("/m/new");
    await expect(
      page.getByRole("heading", { name: "Add New Machine" })
    ).toBeVisible();

    // Fill out the form
    const timestamp = Date.now();
    const machineName = `Test Machine ${timestamp}`;
    const initials = `TM${Math.floor(Math.random() * 100)}`; // Random initials for uniqueness
    await page.locator("#name").fill(machineName);
    await page.locator("#initials").fill(initials);

    // Submit form
    await page.getByRole("button", { name: "Create Machine" }).click();

    // Should redirect to machine detail page (new URL format: /m/[initials])
    await expect(page).toHaveURL(new RegExp(`/m/${initials}`));

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
    await page.goto(`/m/${seededMachines.addamsFamily.initials}`);

    // Should show machine details
    await expect(
      page.getByRole("heading", { name: seededMachines.addamsFamily.name })
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
    // Create a new machine via UI to avoid importing server action
    await page.goto("/m/new");
    const machineName = `Empty Machine ${Date.now()}`;
    const initials = `EM${Math.floor(Math.random() * 100)}`;
    await page.locator("#name").fill(machineName);
    await page.locator("#initials").fill(initials);
    await page.getByRole("button", { name: "Create Machine" }).click();

    // Should be on detail page
    await expect(page).toHaveURL(new RegExp(`/m/${initials}`));

    // Should show empty state for issues
    await expect(page.getByText("No issues reported yet")).toBeVisible();
    await expect(page.getByTestId("detail-open-issues-count")).toContainText(
      "0"
    );
  });
});
