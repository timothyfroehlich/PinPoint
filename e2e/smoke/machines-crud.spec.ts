/**
 * E2E Tests: Machine CRUD Operations
 *
 * Tests machine list, creation, and detail page functionality.
 */

import { test, expect } from "@playwright/test";

test.describe("Machines CRUD", () => {
  test.describe.configure({ mode: "serial" });

  // Login before each test (required for protected routes)
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
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

    // Verify seed data machines are displayed
    // Note: Seed data creates 3 machines (Medieval Madness, Attack from Mars, The Addams Family)
    await expect(page.getByText("Medieval Madness")).toBeVisible();
    await expect(page.getByText("Attack from Mars")).toBeVisible();
    await expect(page.getByText("The Addams Family")).toBeVisible();

    // Verify status badges are displayed
    // Medieval Madness should be Operational (no open issues)
    const medievalCard = page.locator('a:has-text("Medieval Madness")');
    await expect(medievalCard.getByText("Operational")).toBeVisible();

    // Attack from Mars should be Needs Service (playable/minor issues)
    const attackCard = page.locator('a:has-text("Attack from Mars")');
    await expect(attackCard.getByText("Needs Service")).toBeVisible();

    // The Addams Family should be Unplayable (broken flipper)
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
    await page.getByLabel(/Machine Name/i).fill(machineName);

    // Submit form
    await page.getByRole("button", { name: "Create Machine" }).click();

    // Should redirect to machine detail page
    await expect(page).toHaveURL(/\/machines\/[a-f0-9-]+$/, {
      timeout: 10000,
    });

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

    // Try to submit without filling name
    // Note: HTML5 validation will prevent submission
    const nameInput = page.getByLabel(/Machine Name/i);
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
    await page.getByText("Medieval Madness").click();

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
    await page.getByText("The Addams Family").click();

    // Should show machine details
    await expect(
      page.getByRole("heading", { name: "The Addams Family" })
    ).toBeVisible();

    // Verify status badge matches severity
    await expect(page.getByText("Unplayable")).toBeVisible();

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
    await page.getByLabel(/Machine Name/i).fill(machineName);
    await page.getByRole("button", { name: "Create Machine" }).click();

    // Should be on detail page
    await expect(page).toHaveURL(/\/machines\/[a-f0-9-]+$/);

    // Should show empty state for issues
    await expect(page.getByText("No issues reported yet")).toBeVisible();
    await expect(page.getByTestId("detail-open-issues-count")).toContainText(
      "0"
    );
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
    const logoutButton = page.getByRole("button", { name: /Sign Out/i });
    if (await logoutButton.isVisible()) {
      await Promise.all([page.waitForURL("/"), logoutButton.click()]);
    }

    // Try to access machines page without authentication
    await page.goto("/machines");

    // Should redirect to login
    await expect(page).toHaveURL("/login");
  });
});
