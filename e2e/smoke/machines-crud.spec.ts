/**
 * E2E Tests: Machine CRUD Operations
 *
 * Tests machine list, creation, and detail page functionality.
 */

import { test, expect } from "@playwright/test";
import { ensureLoggedIn, logout, loginAs } from "../support/actions";
import { cleanupTestEntities } from "../support/cleanup";
import { seededMachines, TEST_USERS } from "../support/constants";

const createdMachineIds = new Set<string>();

test.describe("Machines CRUD", () => {
  test.describe.configure({ mode: "serial" });

  // Login before each test (required for protected routes)
  test.beforeEach(async ({ page }, testInfo) => {
    await ensureLoggedIn(page, testInfo);
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

  test("should display machine list page", async ({ page }, testInfo) => {
    // Logout and login as admin since "Add Machine" button is admin-only
    await logout(page);
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    // Navigate to machines page (new URL: /m)
    await page.goto("/m");

    // Verify we're on the machines page
    await expect(page).toHaveURL("/m");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();

    // Should have an "Add Machine" button (visible to admins only)
    await expect(
      page.getByRole("link", { name: /Add Machine/i })
    ).toBeVisible();

    // Restore default user for subsequent tests to maintain isolation
    await logout(page);
    await loginAs(page, testInfo, {
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
    });
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

  // Machine creation moved to integration/full suite

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

  test("should display machine owner to all logged-in users", async ({
    page,
  }) => {
    // Navigate to a machine detail page
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Machine Information card should be visible
    await expect(
      page.getByRole("heading", { name: "Machine Information" })
    ).toBeVisible();

    // As a member (default login), owner should be displayed but read-only
    const ownerDisplay = page.getByTestId("owner-display");
    await expect(ownerDisplay).toBeVisible();

    // Verify owner label is present
    await expect(page.getByText("Machine Owner")).toBeVisible();

    // Verify owner name is shown (Admin User owns all seeded machines)
    await expect(page.getByText("Admin User")).toBeVisible();

    // Verify the help text is shown
    await expect(
      page.getByText(
        "The owner receives notifications for new issues on this machine."
      )
    ).toBeVisible();
  });

  // Empty state test (requires creation) moved to integration/full suite
});
