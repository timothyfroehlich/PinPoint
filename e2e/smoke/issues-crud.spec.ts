/**
 * E2E Tests for Issues CRUD Flows
 *
 * Tests complete user workflows for creating and managing issues.
 * Requires Supabase to be running.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";
import { TEST_USERS } from "../support/constants";

test.describe("Issues System", () => {
  test.beforeEach(async ({ page }) => {
    // Login as member before each test
    await loginAs(page, TEST_USERS.member.email, TEST_USERS.member.password);
  });

  test.describe("Issue Creation Flow", () => {
    test("should create an issue from issues page", async ({ page }) => {
      // Navigate to issues page
      await page.goto("/issues");
      await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();

      // Click "Report Issue" button
      await page.getByRole("link", { name: "Report Issue" }).click();
      await expect(page).toHaveURL("/issues/new");

      // Fill out form
      await page.getByLabel("Machine *").click();
      await page.getByRole("option").first().click(); // Select first machine

      await page.getByLabel("Issue Title *").fill("Test flipper not working");
      await page
        .getByLabel("Description")
        .fill("The right flipper does not respond when button is pressed");

      await page.getByLabel("Severity *").click();
      await page.getByRole("option", { name: /playable/i }).click();

      // Submit form
      await page.getByRole("button", { name: "Report Issue" }).click();

      // Should redirect to issue detail page
      await expect(page).toHaveURL(/\/issues\/[a-f0-9-]+/);
      await expect(
        page.getByRole("heading", { name: "Test flipper not working" })
      ).toBeVisible();

      // Check timeline shows "Issue created" event
      await expect(page.getByText("Issue created")).toBeVisible();
    });

    test("should create an issue from machine page with pre-filled machine", async ({
      page,
    }) => {
      // Navigate to machines page
      await page.goto("/machines");
      await expect(
        page.getByRole("heading", { name: "Machines" })
      ).toBeVisible();

      // Click on a machine
      await page.getByRole("link").first().click();
      await expect(page).toHaveURL(/\/machines\/[a-f0-9-]+/);

      // Click "Report Issue" button on machine page
      await page.getByRole("link", { name: "Report Issue" }).first().click();

      // Should be on new issue page with machine pre-filled
      await expect(page).toHaveURL(/\/issues\/new\?machineId=[a-f0-9-]+/);

      // Machine dropdown should have a value selected
      const machineSelect = page.getByLabel("Machine *");
      await expect(machineSelect).toBeVisible();
      // Note: We can't easily test the selected value, but the form should work

      // Fill out remaining fields
      await page.getByLabel("Issue Title *").fill("Display flickering");
      await page.getByLabel("Severity *").click();
      await page.getByRole("option", { name: /minor/i }).click();

      // Submit
      await page.getByRole("button", { name: "Report Issue" }).click();

      // Verify creation
      await expect(page).toHaveURL(/\/issues\/[a-f0-9-]+/);
      await expect(
        page.getByRole("heading", { name: "Display flickering" })
      ).toBeVisible();
    });

    test("should show validation error for missing title", async ({ page }) => {
      await page.goto("/issues/new");

      // Select machine but don't fill title
      await page.getByLabel("Machine *").click();
      await page.getByRole("option").first().click();

      // Try to submit
      await page.getByRole("button", { name: "Report Issue" }).click();

      // Should not navigate away (stays on /issues/new)
      await expect(page).toHaveURL("/issues/new");
    });
  });

  test.describe("Issue List and Filtering", () => {
    test("should display all issues", async ({ page }) => {
      await page.goto("/issues");

      // Page should load
      await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();

      // Should have issue cards or empty state
      const emptyState = page.getByText("No issues reported yet");
      const issueCards = page
        .getByRole("link")
        .filter({ has: page.getByTestId(/issue-/) });

      // Either empty state or issue cards should be visible
      const hasContent =
        (await emptyState.isVisible()) || (await issueCards.count()) > 0;
      expect(hasContent).toBe(true);
    });

    test("should filter issues by status", async ({ page }) => {
      await page.goto("/issues");

      // Change status filter to "New"
      const statusFilter = page.getByLabel("Status:");
      await statusFilter.selectOption("new");

      // URL should update with filter
      await expect(page).toHaveURL(/\?.*status=new/);

      // Page should still show issues heading
      await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();
    });

    test("should filter issues by severity", async ({ page }) => {
      await page.goto("/issues");

      // Change severity filter to "Unplayable"
      const severityFilter = page.getByLabel("Severity:");
      await severityFilter.selectOption("unplayable");

      // URL should update
      await expect(page).toHaveURL(/\?.*severity=unplayable/);
    });

    test("should filter issues by machine", async ({ page }) => {
      await page.goto("/issues");

      // Change machine filter
      const machineFilter = page.getByLabel("Machine:");
      const options = await machineFilter.locator("option").allTextContents();

      if (options.length > 1) {
        // Select second option (first is "All Machines")
        await machineFilter.selectOption({ index: 1 });

        // URL should update
        await expect(page).toHaveURL(/\?.*machineId=[a-f0-9-]+/);
      }
    });

    test("should clear all filters", async ({ page }) => {
      // Start with filters applied
      await page.goto("/issues?status=new&severity=unplayable");

      // Click "Clear Filters" button
      await page.getByRole("link", { name: "Clear Filters" }).click();

      // Should navigate to /issues without params
      await expect(page).toHaveURL("/issues");
    });
  });

  test.describe("Issue Detail and Updates", () => {
    test("should display issue details", async ({ page }) => {
      // Create an issue first (or navigate to existing one)
      await page.goto("/issues/new");
      await page.getByLabel("Machine *").click();
      await page.getByRole("option").first().click();
      await page.getByLabel("Issue Title *").fill("Test Issue for Details");
      await page.getByLabel("Severity *").click();
      await page.getByRole("option", { name: /playable/i }).click();
      await page.getByRole("button", { name: "Report Issue" }).click();

      // Should be on detail page
      await expect(
        page.getByRole("heading", { name: "Test Issue for Details" })
      ).toBeVisible();

      // Should show metadata
      await expect(page.getByText(/Machine:/)).toBeVisible();
      await expect(page.getByText(/Reported by:/)).toBeVisible();
      await expect(page.getByText(/Reported:/)).toBeVisible();

      // Should show status and severity badges
      await expect(page.getByText("New")).toBeVisible();
      await expect(page.getByText("Playable")).toBeVisible();

      // Should show timeline
      await expect(
        page.getByRole("heading", { name: "Timeline" })
      ).toBeVisible();
      await expect(page.getByText("Issue created")).toBeVisible();
    });

    test("should update issue status", async ({ page }) => {
      // Create an issue
      await page.goto("/issues/new");
      await page.getByLabel("Machine *").click();
      await page.getByRole("option").first().click();
      await page.getByLabel("Issue Title *").fill("Issue for Status Update");
      await page.getByRole("button", { name: "Report Issue" }).click();

      // On detail page, find status update form
      const statusSection = page.locator('text="Update Status"').locator("..");
      await statusSection.getByLabel("Update Status").click();
      await statusSection.getByRole("option", { name: "In Progress" }).click();
      await statusSection.getByRole("button", { name: "Update" }).click();

      // Page should refresh/redirect
      await expect(page.getByText("In Progress")).toBeVisible();

      // Timeline should show status change event
      await expect(
        page.getByText(/Status changed from new to in_progress/)
      ).toBeVisible();
    });

    test("should update issue severity", async ({ page }) => {
      // Create an issue
      await page.goto("/issues/new");
      await page.getByLabel("Machine *").click();
      await page.getByRole("option").first().click();
      await page.getByLabel("Issue Title *").fill("Issue for Severity Update");
      await page.getByRole("button", { name: "Report Issue" }).click();

      // Find severity update form
      const severitySection = page
        .locator('text="Update Severity"')
        .locator("..");
      await severitySection.getByLabel("Update Severity").click();
      await severitySection.getByRole("option", { name: "Unplayable" }).click();
      await severitySection.getByRole("button", { name: "Update" }).click();

      // Verify update
      await expect(page.getByText("Unplayable")).toBeVisible();
      await expect(
        page.getByText(/Severity changed from playable to unplayable/)
      ).toBeVisible();
    });

    test("should assign issue to user", async ({ page }) => {
      // Create an issue
      await page.goto("/issues/new");
      await page.getByLabel("Machine *").click();
      await page.getByRole("option").first().click();
      await page.getByLabel("Issue Title *").fill("Issue for Assignment");
      await page.getByRole("button", { name: "Report Issue" }).click();

      // Find assignment form
      const assignSection = page.locator('text="Assign Issue"').locator("..");
      await assignSection.getByLabel("Assign Issue").click();

      // Select a user (first non-empty option)
      const options = await assignSection.locator("option").allTextContents();
      if (options.length > 1) {
        await assignSection.getByRole("option").nth(1).click();
        await assignSection.getByRole("button", { name: "Update" }).click();

        // Verify assignment
        await expect(page.getByText(/Assigned to:/)).toBeVisible();
        await expect(page.getByText(/Assigned to .+/)).toBeVisible();
      }
    });
  });

  test.describe("Navigation Integration", () => {
    test("should navigate from machine page to filtered issues", async ({
      page,
    }) => {
      // Go to machines page
      await page.goto("/machines");

      // Click on a machine
      await page.getByRole("link").first().click();
      const machineUrl = page.url();
      const machineId = machineUrl.split("/").pop();

      // Should see machine detail page with issues section
      await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();

      // If there are issues, click "View All Issues" button
      const viewAllButton = page.getByRole("link", {
        name: /View All Issues for/,
      });

      if (await viewAllButton.isVisible()) {
        await viewAllButton.click();

        // Should navigate to issues page with machineId filter
        await expect(page).toHaveURL(`/issues?machineId=${machineId}`);
      }
    });

    test("should navigate back from issue detail to issues list", async ({
      page,
    }) => {
      await page.goto("/issues");

      // If there are issues, click on one
      const firstIssueLink = page.getByRole("link").first();
      const issueCount = await page.getByRole("link").count();

      if (issueCount > 0) {
        await firstIssueLink.click();

        // Should be on detail page
        await expect(page).toHaveURL(/\/issues\/[a-f0-9-]+/);

        // Click "Back to Issues" link
        await page.getByRole("link", { name: "Back to Issues" }).click();

        // Should return to issues list
        await expect(page).toHaveURL("/issues");
      }
    });
  });
});
