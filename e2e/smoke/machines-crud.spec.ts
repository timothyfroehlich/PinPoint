/**
 * E2E Tests: Machine CRUD Operations
 *
 * Tests machine list, creation, and detail page functionality.
 */

import { test, expect } from "@playwright/test";
import { ensureLoggedIn, logout, loginAs } from "../support/actions";
import { cleanupTestEntities } from "../support/cleanup";
import {
  seededMachines,
  TEST_USERS,
  machineStatuses,
  seededIssues,
} from "../support/constants";

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

  test("non-admin cannot access /m/new page", async ({ page }) => {
    // Default login is member (non-admin) from beforeEach

    // Verify "Add Machine" button is NOT visible to non-admin on /m page
    await page.goto("/m");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Add Machine/i })
    ).not.toBeVisible();

    // Attempt direct navigation to /m/new - should see 403 Forbidden
    await page.goto("/m/new");
    await expect(page.getByText("403")).toBeVisible();
    await expect(page.getByText("Access Denied")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Add New Machine" })
    ).not.toBeVisible();
  });

  test("should display seeded test machines with correct statuses", async ({
    page,
  }) => {
    // Navigate to machines page (new URL: /m)
    await page.goto("/m");

    const machineCards = page.getByTestId("machine-card");
    const cardCount = await machineCards.count();

    // We seed 10 machines; other tests may add more but we should always have at least the seeds
    expect(cardCount).toBeGreaterThanOrEqual(10);

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

    // Sanity: verify The Addams Family shows correct status (Needs Service from major severity issues)
    const addamsCard = page.locator(
      `a:has-text("${seededMachines.addamsFamily.name}")`
    );
    await expect(
      addamsCard.getByText(machineStatuses.addamsFamily)
    ).toBeVisible();
  });

  // Machine creation moved to integration/full suite

  test("should display machine issues on detail page", async ({ page }) => {
    // Navigate to The Addams Family (has unplayable issue)
    await page.goto(`/m/${seededMachines.addamsFamily.initials}`);

    // Should show machine details
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 })
    ).toContainText(seededMachines.addamsFamily.name);

    // Issues section should be visible with cards rendered by default
    await expect(page.getByTestId("issues-section")).toBeVisible();

    // Issue cards should be visible
    const issueCards = page.getByTestId("issue-card");
    const actualCardCount = await issueCards.count();

    expect(actualCardCount).toBeGreaterThan(0); // Ensure we have issues to display

    // Verify specific seed issues are listed (using actual TAF seeded issues)
    await expect(page.getByText(seededIssues.TAF[0].title)).toBeVisible(); // "Thing flips the bird"
    await expect(page.getByText(seededIssues.TAF[1].title)).toBeVisible(); // "Bookcase not registering"
  });

  test("should display machine owner to all logged-in users", async ({
    page,
  }) => {
    // Navigate to a machine detail page
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Machine details card should be visible
    await expect(
      page.getByRole("heading", { name: "Machine Details" })
    ).toBeVisible();

    // As a member (default login), owner details should be visible
    await expect(page.getByTestId("owner-badge")).toBeVisible();
    await expect(page.getByText("Admin User")).toBeVisible();

    // Active edit button should NOT be visible (member is not the owner/admin/technician)
    await expect(page.getByTitle("Edit Machine")).not.toBeVisible();
  });

  // Empty state test (requires creation) moved to integration/full suite
});
