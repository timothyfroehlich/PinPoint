/**
 * E2E Tests for Issues CRUD Flows
 *
 * Tests complete user workflows for creating and managing issues.
 * Requires Supabase to be running.
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "../support/actions";
import { cleanupTestEntities, extractIdFromUrl } from "../support/cleanup";

async function selectFirstMachine(page: Page): Promise<void> {
  const option = page.locator("#machineId option").nth(1);
  await option.waitFor({ state: "attached" });
  const value = await option.evaluate((node) => {
    const opt = node as HTMLOptionElement;
    return opt.value;
  });
  await page.locator("#machineId").selectOption(value);
}

const createdIssueIds = new Set<string>();

const rememberIssueId = (page: Page): void => {
  const issueId = extractIdFromUrl(page.url());
  if (issueId) {
    createdIssueIds.add(issueId);
  }
};

test.describe("Issues System", () => {
  test.beforeEach(async ({ page }) => {
    // Login as member before each test
    await loginAs(page);
  });

  test.afterEach(async ({ request }) => {
    if (!createdIssueIds.size) {
      return;
    }
    await cleanupTestEntities(request, {
      issueIds: Array.from(createdIssueIds),
    });
    createdIssueIds.clear();
  });

  test.describe("Issue Creation Flow", () => {
    test("should create an issue from issues page", async ({ page }) => {
      // Navigate to issues page
      await page.goto("/issues");
      await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();

      // Click "Report Issue" button
      await page
        .getByRole("main")
        .getByRole("link", { name: "Report Issue" })
        .click();
      await expect(page).toHaveURL("/issues/new");

      // Fill out form
      await selectFirstMachine(page);

      await page.getByLabel("Issue Title *").fill("Test flipper not working");
      await page
        .getByLabel("Description")
        .fill("The right flipper does not respond when button is pressed");

      await page.getByLabel("Severity *").selectOption("playable");

      // Submit form
      await page.getByRole("button", { name: "Report Issue" }).click();

      // Should redirect to issue detail page
      await expect(page).toHaveURL(/\/issues\/[a-f0-9-]+/);
      await expect(
        page.getByRole("heading", { name: "Test flipper not working" })
      ).toBeVisible();

      // Check timeline shows "Issue created" event
      await expect(page.getByText("Issue created")).toBeVisible();

      rememberIssueId(page);
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
      await page.getByTestId("machine-card").first().click();
      await expect(page).toHaveURL(/\/machines\/[a-f0-9-]+/);

      // Click "Report Issue" button on machine page
      await page
        .getByRole("main")
        .getByRole("link", { name: "Report Issue" })
        .click();

      // Should be on new issue page with machine pre-filled
      await expect(page).toHaveURL(/\/issues\/new\?machineId=[a-f0-9-]+/);

      // Machine dropdown should have a value selected
      const machineSelect = page.locator("#machineId");
      await expect(machineSelect).toBeVisible();
      // Note: We can't easily test the selected value, but the form should work

      // Fill out remaining fields
      await page.getByLabel("Issue Title *").fill("Display flickering");
      await page.getByLabel("Severity *").selectOption("minor");

      // Submit
      await page.getByRole("button", { name: "Report Issue" }).click();

      // Verify creation
      await expect(page).toHaveURL(/\/issues\/[a-f0-9-]+/);
      await expect(
        page.getByRole("heading", { name: "Display flickering" })
      ).toBeVisible();

      rememberIssueId(page);
    });

    test("should show validation error for missing title", async ({ page }) => {
      await page.goto("/issues/new");

      // Select machine but don't fill title
      await page.getByLabel("Machine *").selectOption({ index: 1 });

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
      await selectFirstMachine(page);
      await page.getByLabel("Issue Title *").fill("Test Issue for Details");
      await page.locator("#severity").selectOption("playable");
      await page.getByRole("button", { name: "Report Issue" }).click();

      // Should be on detail page
      await expect(
        page.getByRole("heading", { name: "Test Issue for Details" })
      ).toBeVisible();

      rememberIssueId(page);

      // Should show metadata
      await expect(page.getByText(/Machine:/)).toBeVisible();
      await expect(page.getByText(/Reported by:/)).toBeVisible();
      await expect(page.getByText(/Reported:/)).toBeVisible();

      // Should show status and severity badges
      await expect(page.getByTestId("issue-status-badge")).toHaveText(/New/i);
      await expect(page.getByTestId("issue-severity-badge")).toHaveText(
        /Playable/i
      );

      // Should show timeline
      await expect(
        page.getByRole("heading", { name: "Timeline" })
      ).toBeVisible();
      await expect(page.getByText("Issue created")).toBeVisible();
    });

    test("should support timeline comments, status, and assignee updates", async ({
      page,
    }) => {
      await page.goto("/issues/new");
      await selectFirstMachine(page);
      const issueTitle = `Timeline Issue ${Date.now()}`;
      await page.getByLabel("Issue Title *").fill(issueTitle);
      await page.getByRole("button", { name: "Report Issue" }).click();

      await expect(
        page.getByRole("heading", { name: issueTitle })
      ).toBeVisible();
      rememberIssueId(page);

      const commentText = `Operator note ${Date.now()}`;
      await page.getByPlaceholder("Leave a comment...").fill(commentText);
      await page.getByRole("button", { name: "Add comment" }).click();
      await expect(page.getByText("Comment added")).toBeVisible();
      await expect(page.getByText(commentText)).toBeVisible();

      await page.getByTestId("issue-status-select").click();
      await page.getByTestId("status-option-in_progress").click();
      await expect(page.getByTestId("issue-status-badge")).toHaveText(
        /In Progress/i
      );
      await expect(
        page.getByText(/Status changed from new to in_progress/)
      ).toBeVisible();

      await page.getByTestId("issue-severity-select").click();
      await page.getByTestId("severity-option-unplayable").click();
      await expect(page.getByTestId("issue-severity-badge")).toHaveText(
        /Unplayable/i
      );
      await expect(
        page.getByText(/Severity changed from playable to unplayable/)
      ).toBeVisible();

      await page.getByTestId("assignee-picker-trigger").click();
      await page.getByTestId("assignee-search-input").fill("member");
      await page
        .locator('[aria-label="Assignee options"]')
        .getByRole("button", { name: /Member User/ })
        .first()
        .click();
      await expect(page.getByTestId("assignee-picker-trigger")).toContainText(
        "Member User"
      );
      await expect(
        page.locator("div").filter({ hasText: /^Assigned to Member User$/ })
      ).toBeVisible();

      await page.getByTestId("assignee-picker-trigger").click();
      await page.getByTestId("assignee-option-unassigned").click();
      await expect(page.getByTestId("assignee-picker-trigger")).toContainText(
        "Unassigned"
      );
      await expect(
        page.locator("div").filter({ hasText: /^Unassigned$/ })
      ).toBeVisible();
    });
  });

  test.describe("Navigation Integration", () => {
    test("should navigate from machine page to filtered issues", async ({
      page,
    }) => {
      // Go to machines page
      await page.goto("/machines");

      // Click on a machine
      await page.getByTestId("machine-card").first().click();
      await expect(page).toHaveURL(/\/machines\/[a-f0-9-]+/);
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
      const issueLinks = page
        .getByRole("link")
        .filter({ has: page.getByTestId(/issue-card-/) });
      const issueCount = await issueLinks.count();

      if (issueCount > 0) {
        await issueLinks.first().click();

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
