/**
 * E2E Tests for Issues CRUD Flows
 *
 * Tests complete user workflows for creating and managing issues.
 * Requires Supabase to be running.
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAs, selectOption } from "../support/actions.js";
import { cleanupTestEntities, extractIdFromUrl } from "../support/cleanup.js";
import { seededMachines } from "../support/constants.js";

const createdIssueIds = new Set<string>();

const rememberIssueId = (page: Page): void => {
  const issueId = extractIdFromUrl(page.url());
  if (issueId) {
    createdIssueIds.add(issueId);
  }
};

test.describe("Issues System", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Increase timeout for local execution where compilation can be slow
    test.setTimeout(60000);
    // Login as member before each test
    await loginAs(page, testInfo);
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
    test("should create an issue for a specific machine", async ({ page }) => {
      const machineInitials = seededMachines.addamsFamily.initials;

      // Navigate to report page for The Addams Family
      await page.goto(`/report?machine=${machineInitials}`);

      // Fill out form
      await page.getByLabel("Issue Title *").fill("Test flipper not working");
      await page
        .getByLabel("Description")
        .fill("The right flipper does not respond when button is pressed");
      await selectOption(page, "severity-select", "minor");
      await selectOption(page, "priority-select", "medium");
      await selectOption(page, "consistency-select", "intermittent");

      // Submit form
      await page.getByRole("button", { name: "Submit Issue Report" }).click();

      // Should redirect to issue detail page in new format
      await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);

      // Check H1 contains title using robust locator
      await expect(
        page
          .getByRole("main")
          .getByRole("heading", { level: 1, name: /Test flipper not working/ })
      ).toBeVisible();

      rememberIssueId(page);
    });

    test("should create an issue from machine page with pre-filled machine", async ({
      page,
    }) => {
      // Navigate to machines list page
      await page.goto("/m");
      await expect(
        page.getByRole("heading", { name: "Machines" })
      ).toBeVisible();

      // Click on a machine (e.g., The Addams Family)
      const addamsFamilyCard = page
        .getByTestId("machine-card")
        .filter({ hasText: seededMachines.addamsFamily.name });
      await addamsFamilyCard.click();
      await expect(page).toHaveURL(/\/m\/TAF/); // Expect TAF machine detail page

      // Click "Submit Issue Report" button on machine page (scope to main content to avoid global header button)
      await page.getByTestId("machine-report-issue").click();

      // Should be on new issue page for TAF
      await page.waitForURL(/\/report\?machine=TAF/);

      // Verify machine name is displayed
      await expect(
        page
          .locator("div")
          .filter({ hasText: seededMachines.addamsFamily.name })
          .first()
      ).toBeVisible();

      // Fill out remaining fields
      await page.getByLabel("Issue Title *").fill("Display flickering");
      await selectOption(page, "severity-select", "minor");
      await selectOption(page, "priority-select", "low");
      await selectOption(page, "consistency-select", "intermittent");

      // Submit
      await page.getByRole("button", { name: "Submit Issue Report" }).click();

      // Verify creation
      await expect(page).toHaveURL(/\/m\/TAF\/i\/[0-9]+/);
      // Check H1 contains title
      await expect(
        page
          .getByRole("main")
          .getByRole("heading", { level: 1, name: /Display flickering/ })
      ).toBeVisible();

      rememberIssueId(page);
    });
  });

  test.describe("Issue Detail and Updates", () => {
    let issueUrl: string;
    let issueTitle: string;
    let machineInitials: string;
    let issueNumber: number;

    test.beforeEach(async ({ page }) => {
      // Create an issue first to navigate to via UI interaction
      machineInitials = seededMachines.addamsFamily.initials;
      issueTitle = `Test Issue for Details ${Date.now()}`;
      await page.goto(`/report?machine=${machineInitials}`);
      await page.getByLabel("Issue Title *").fill(issueTitle);
      await selectOption(page, "severity-select", "minor");
      await selectOption(page, "priority-select", "medium");
      await selectOption(page, "consistency-select", "intermittent");
      await page.getByRole("button", { name: "Submit Issue Report" }).click();

      await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);
      issueUrl = page.url();
      issueNumber = Number(issueUrl.split("/").pop()); // Extract issue number from URL
      rememberIssueId(page);
    });

    test("should display issue details", async ({ page }) => {
      // Navigate to the created issue's detail page
      await page.goto(issueUrl);

      // Should be on detail page
      // Check H1 contains title
      await expect(
        page
          .getByRole("main")
          .getByRole("heading", { level: 1, name: issueTitle })
      ).toBeVisible();

      // Check H1 contains ID
      const idText = `${machineInitials}-${String(issueNumber).padStart(2, "0")}`;
      await expect(
        page.getByRole("main").getByRole("heading", { level: 1, name: idText })
      ).toBeVisible();

      // Should show metadata
      await expect(
        page.getByText(seededMachines.addamsFamily.name)
      ).toBeVisible();

      const sidebar = page.getByTestId("issue-sidebar");
      await expect(
        sidebar.getByText("Reporter", { exact: true })
      ).toBeVisible();
      await expect(sidebar.getByText("Created", { exact: true })).toBeVisible();

      // Should show status and severity badges
      await expect(page.getByTestId("issue-status-badge")).toHaveText(/New/i);
      await expect(page.getByTestId("issue-severity-badge")).toHaveText(
        /Minor/i
      );

      // Should show timeline
      await expect(
        page.getByRole("heading", { name: "Activity" })
      ).toBeVisible();
    });

    // Update tests moved to integration/full suite
  });
});
