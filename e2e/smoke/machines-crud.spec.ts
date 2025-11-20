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

    // Verify success flash message
    await expect(
      page.getByText(`Machine "${machineName}" created successfully`)
    ).toBeVisible();

    // Verify machine name is displayed
    await expect(
      page.getByRole("heading", { name: machineName })
    ).toBeVisible();

    // Verify status is "Operational" (no issues yet)
    await expect(page.getByTestId("machine-status-badge")).toHaveText(
      "Operational"
    );
  });

  test("should validate required machine name", async ({ page }) => {
    // Navigate to create machine page
    await page.goto("/machines/new");

    // If redirected (lost session), log back in and retry
    if (page.url().includes("/login")) {
      await ensureLoggedIn(page);
      await page.goto("/machines/new");
    }

    await expect(page).toHaveURL("/machines/new");
    await expect(
      page.getByRole("heading", { name: "Add New Machine" })
    ).toBeVisible();

    // Try to submit without filling name
    // Note: HTML5 validation will prevent submission
    const nameInput = page.locator("#name");
    await expect(nameInput).toHaveAttribute("required");

    // Fill name with only whitespace
    await nameInput.fill("   ");

    // Submit form
    await page.getByRole("button", { name: "Create Machine" }).click();

    // Should stay on the same page (HTML5 validation or server validation)
    // The form should either show HTML5 validation or stay on the page
    // Wait for the form heading to remain visible, indicating we're still on the page
    await expect(
      page.getByRole("heading", { name: "Add New Machine" })
    ).toBeVisible();
    await expect(page).toHaveURL("/machines/new");
  });

  test("should navigate to machine detail page", async ({ page }) => {
    // Navigate to machines page
    await page.goto("/machines");

    // Click on a machine card
    await page.getByRole("link", { name: "Medieval Madness" }).first().click();

    // Should navigate to machine detail page
    await expect(page).toHaveURL(/\/machines\/[a-f0-9-]+$/);

    // Verify machine details are displayed
    await expect(
      page.getByRole("heading", { name: "Medieval Madness" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Machine Information" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();
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

  test("should navigate back to machines list from detail page", async ({
    page,
  }) => {
    // Navigate to a machine detail page
    await page.goto("/machines");
    await page.getByText("Medieval Madness").click();

    // Click back button
    await page.getByRole("link", { name: /Back/i }).click();

    // Should return to machines list
    await expect(page).toHaveURL("/machines");
  });

  test("should navigate back to machines list from create page", async ({
    page,
  }) => {
    // Navigate to create machine page
    await page.goto("/machines/new");

    // Click back or cancel button
    await page.getByRole("link", { name: /Back/i }).click();

    // Should return to machines list
    await expect(page).toHaveURL("/machines");
  });

  test("should require authentication for machines pages", async ({ page }) => {
    // First, logout if logged in
    await page.goto("/dashboard");
    const userMenuButton = page.getByTestId("user-menu-button");
    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();
      await page.getByRole("menuitem", { name: "Sign Out" }).click();
      await expect(page).toHaveURL("/"); // should land on home
    }

    // Try to access machines page without authentication
    await page.goto("/machines");

    // Should redirect to login
    await expect(page).toHaveURL("/login");
  });
});
