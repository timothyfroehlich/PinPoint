/**
 * E2E Tests for Issues CRUD Flows
 *
 * Tests complete user workflows for creating and managing issues.
 * Requires Supabase to be running.
 */

import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { ensureLoggedIn, loginAs } from "../support/actions.js";
import { cleanupTestEntities, extractIdFromUrl } from "../support/cleanup.js";
import { seededMachines } from "../support/constants.js";
import { fillReportForm } from "../support/page-helpers.js";

const createdIssueIds = new Set<string>();

const rememberIssueId = (page: Page): void => {
  const issueId = extractIdFromUrl(page.url());
  if (issueId) {
    createdIssueIds.add(issueId);
  }
};

const ensureAuthenticatedOnReportPage = async (
  page: Page,
  testInfo: TestInfo
): Promise<void> => {
  const userMenu = page.getByTestId("user-menu-button");
  if (!(await userMenu.isVisible())) {
    await loginAs(page, testInfo);
  }
  await expect(page.getByTestId("user-menu-button")).toBeVisible();
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
    test("should create an issue for a specific machine", async ({
      page,
    }, testInfo) => {
      const machineInitials = seededMachines.addamsFamily.initials;

      // Navigate to report page for The Addams Family
      await page.goto(`/report?machine=${machineInitials}`);
      await ensureAuthenticatedOnReportPage(page, testInfo);

      // Fill out form
      await fillReportForm(page, {
        title: "Test flipper not working",
        description:
          "The right flipper does not respond when button is pressed",
        priority: "medium",
      });

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
    }, testInfo) => {
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
      await ensureAuthenticatedOnReportPage(page, testInfo);

      // Verify machine name is displayed
      await expect(
        page
          .locator("div")
          .filter({ hasText: seededMachines.addamsFamily.name })
          .first()
      ).toBeVisible();

      // Fill out remaining fields
      await fillReportForm(page, { title: "Display flickering" });

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

    test.beforeEach(async ({ page }, testInfo) => {
      await ensureLoggedIn(page, testInfo);

      // Create an issue first to navigate to via UI interaction
      machineInitials = seededMachines.addamsFamily.initials;
      issueTitle = `Test Issue for Details ${Date.now()}`;
      await page.goto(`/report?machine=${machineInitials}`);
      await ensureAuthenticatedOnReportPage(page, testInfo);
      const issueTitleInput = page.getByLabel("Issue Title *");
      if (!(await issueTitleInput.isVisible())) {
        await loginAs(page, testInfo);
        await page.goto(`/report?machine=${machineInitials}`);
        await ensureAuthenticatedOnReportPage(page, testInfo);
      }
      await expect(page.getByLabel("Issue Title *")).toBeVisible();
      await fillReportForm(page, { title: issueTitle, priority: "medium" });
      await page.getByRole("button", { name: "Submit Issue Report" }).click();

      if (page.url().includes("/report/success")) {
        await loginAs(page, testInfo);
        await page.goto("/issues");
        await page.getByPlaceholder("Search issues...").fill(issueTitle);
        await page.keyboard.press("Enter");
        await page.waitForURL((url) => url.searchParams.has("q"));
        const issueRow = page.getByRole("row", {
          name: new RegExp(issueTitle),
        });
        await expect(issueRow).toBeVisible();
        await issueRow.getByTestId("issue-title").click();
      }

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

      // Check ID is displayed (in layout above title, not in H1)
      const idText = `${machineInitials}-${String(issueNumber).padStart(2, "0")}`;
      await expect(page.getByRole("main").getByText(idText)).toBeVisible();

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
      await expect(page.getByTestId("issue-status-badge").first()).toHaveText(
        /New/i
      );
      await expect(page.getByTestId("issue-severity-badge").first()).toHaveText(
        /Minor/i
      );

      // Should show timeline
      await expect(
        page.getByRole("heading", { name: "Activity" })
      ).toBeVisible();
    });

    // Update tests moved to integration/full suite
  });

  test.describe("Issue Detail Display", () => {
    let issueUrl: string;
    let issueTitle: string;

    test.beforeEach(async ({ page }) => {
      // Create a fresh issue for this worker to avoid parallel test conflicts
      const machineInitials = seededMachines.humptyDumpty.initials;
      issueTitle = `Assignee Test ${Date.now()}`;
      await page.goto(`/report?machine=${machineInitials}`);
      await fillReportForm(page, { title: issueTitle, priority: "medium" });
      await page.getByRole("button", { name: "Submit Issue Report" }).click();

      await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);
      issueUrl = page.url();
      rememberIssueId(page);
    });

    test("should display assignee on issue detail page", async ({ page }) => {
      // Navigate to the freshly created issue
      await page.goto(issueUrl);

      // Verify we're on the issue detail page
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: new RegExp(issueTitle),
        })
      ).toBeVisible();

      // Find the assignee picker - initially shows "Unassigned"
      const assigneePicker = page
        .getByTestId("issue-sidebar")
        .getByTestId("assignee-picker-trigger")
        .first();
      await expect(assigneePicker).toBeVisible();
      await expect(assigneePicker).toContainText("Unassigned");

      // Assign to Member User (self-assign)
      await assigneePicker.click();
      await page.getByRole("option", { name: /Member User/i }).click();

      // Verify the assignee name is now displayed
      await expect(assigneePicker).toContainText("Member User");

      // Reload page to verify persistence
      await page.reload();
      await expect(
        page
          .getByTestId("issue-sidebar")
          .getByTestId("assignee-picker-trigger")
          .first()
      ).toContainText("Member User");
    });
  });
});
