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
  // Select "The Addams Family" to avoid contaminating Medieval Madness
  // which should remain "Operational" for the machines status test
  await page.locator("#machineId").selectOption({ label: "The Addams Family" });
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
  });

  test.describe("Issue List", () => {
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
      // Should show metadata
      // Machine name is displayed as a breadcrumb link
      await expect(page.getByText("The Addams Family")).toBeVisible();

      const sidebar = page.getByTestId("issue-sidebar");
      await expect(
        sidebar.getByText("Reporter", { exact: true })
      ).toBeVisible();
      await expect(sidebar.getByText("Created", { exact: true })).toBeVisible();

      // Should show status and severity badges
      await expect(page.getByTestId("issue-status-badge")).toHaveText(/New/i);
      await expect(page.getByTestId("issue-severity-badge")).toHaveText(
        /Playable/i
      );

      // Should show timeline
      await expect(
        page.getByRole("heading", { name: "Activity" })
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
      await expect(page.getByText(commentText)).toBeVisible();

      await page.getByTestId("issue-status-select").selectOption("in_progress");
      await page.getByRole("button", { name: "Update Status" }).click();
      await expect(page.getByTestId("issue-status-badge")).toHaveText(
        /In Progress/i
      );
      await expect(
        page.getByText(/Status changed from new to in_progress/)
      ).toBeVisible();

      await page
        .getByTestId("issue-severity-select")
        .selectOption("unplayable");
      await page.getByRole("button", { name: "Update Severity" }).click();
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
      // Wait for timeline event to appear (use .last() to get most recent event)
      await expect(
        page.getByText(/^Assigned to Member User$/).last()
      ).toBeVisible();

      await page.getByTestId("assignee-picker-trigger").click();
      await page.getByTestId("assignee-option-unassigned").click();
      await expect(page.getByTestId("assignee-picker-trigger")).toContainText(
        "Unassigned"
      );
      // Wait for timeline event to appear (use .last() to get most recent event)
      await expect(page.getByText(/^Unassigned$/).last()).toBeVisible();
    });
  });
});
