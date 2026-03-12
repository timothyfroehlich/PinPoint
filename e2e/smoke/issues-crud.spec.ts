/**
 * E2E Tests for Issues CRUD Flows
 *
 * Tests complete user workflows for creating and managing issues.
 * Requires Supabase to be running.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  updateIssueField,
  visibleIssueFieldControl,
} from "../support/actions.js";
import { cleanupTestEntities, extractIdFromUrl } from "../support/cleanup.js";
import { seededMachines } from "../support/constants.js";
import { fillReportForm } from "../support/page-helpers.js";
import { STORAGE_STATE } from "../support/auth-state.js";

const createdIssueIds = new Set<string>();

const rememberIssueId = (page: Page): void => {
  const issueId = extractIdFromUrl(page.url());
  if (issueId) {
    createdIssueIds.add(issueId);
  }
};

test.describe("Issues System", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test.beforeEach(() => {
    // Increase timeout for local execution where compilation can be slow
    test.setTimeout(60000);
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
    }) => {
      // Navigate to machines list page with filters reset
      await page.goto("/m?availability=all");
      await expect(
        page.getByRole("heading", { name: "Machines" })
      ).toBeVisible();

      await page
        .getByPlaceholder("Search machines by name or initials...")
        .fill(seededMachines.addamsFamily.initials);
      await page.waitForURL(
        (url) =>
          url.searchParams.get("q") === seededMachines.addamsFamily.initials
      );

      // Click the stable machine detail link by initials. The display name can
      // change earlier in the serial suite, but the route remains /m/TAF.
      const addamsFamilyLink = page.locator(
        `a[href="/m/${seededMachines.addamsFamily.initials}"]`
      );
      await expect(addamsFamilyLink).toBeVisible();
      await addamsFamilyLink.click();
      await expect(page).toHaveURL(/\/m\/TAF/); // Expect TAF machine detail page

      // Click "Submit Issue Report" button on machine page (scope to main content to avoid global header button)
      await page.getByTestId("machine-report-issue").click();

      // Should be on new issue page for TAF
      await page.waitForURL(/\/report\?machine=TAF/);

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

    test.beforeEach(async ({ page }) => {
      // Create an issue first to navigate to via UI interaction
      machineInitials = seededMachines.addamsFamily.initials;
      issueTitle = `Test Issue for Details ${Date.now()}`;
      await page.goto(`/report?machine=${machineInitials}`);
      await fillReportForm(page, { title: issueTitle, priority: "medium" });
      await page.getByRole("button", { name: "Submit Issue Report" }).click();

      await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);
      issueUrl = page.url();
      issueNumber = Number(issueUrl.split("/").pop()); // Extract issue number from URL
      rememberIssueId(page);
    });

    test("should display issue details", async ({ page }, testInfo) => {
      // Navigate to the created issue's detail page
      await page.goto(issueUrl);
      const isMobile = testInfo.project.name.includes("Mobile");

      // Should be on detail page
      // Check H1 contains title
      await expect(
        page
          .getByRole("main")
          .getByRole("heading", { level: 1, name: issueTitle })
      ).toBeVisible();

      // Check ID is displayed (in layout above title, not in H1)
      const idText = `${machineInitials}-${String(issueNumber).padStart(2, "0")}`;
      await expect(
        page
          .getByRole("main")
          .getByText(idText)
          .filter({ visible: true })
          .first()
      ).toBeVisible();

      // Should show metadata
      await expect(
        page.getByTestId("machine-link").filter({ visible: true }).first()
      ).toBeVisible();

      await expect(page.getByTestId("issue-timeline")).toBeVisible();
      await expect(page.getByTestId("issue-comment-form")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Activity" })).toHaveCount(
        isMobile ? 0 : 1
      );

      if (isMobile) {
        await expect(page.getByTestId("mobile-nav-row")).toBeVisible();
        await expect(
          page.getByRole("link", { name: /Back to Issues/i })
        ).toHaveCount(0);
        await expect(page.getByTestId("issue-sidebar")).toBeHidden();
        await expect(page.getByTestId("issue-badge-strip")).toBeVisible();
      } else {
        const sidebar = page.getByTestId("issue-sidebar");
        await expect(sidebar).toBeVisible();
        await expect(
          sidebar.getByText("Reporter", { exact: true })
        ).toBeVisible();
        await expect(
          sidebar.getByText("Created", { exact: true })
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: /Back to Issues/i })
        ).toBeVisible();
      }
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
        .getByTestId("assignee-picker-trigger")
        .filter({ visible: true })
        .first();
      await expect(assigneePicker).toBeVisible();
      await expect(assigneePicker).toContainText("Unassigned");

      // Self-assign via the "Me" quick-select (current user is excluded from
      // the alphabetical list and only appears as "Me" at the top of the picker)
      await assigneePicker.click();
      await page.getByTestId("assignee-option-me").click();

      // Verify the assignee name is now displayed
      await expect(assigneePicker).toContainText("Member User");

      // Reload page to verify persistence
      await page.reload();
      await expect(
        page
          .getByTestId("assignee-picker-trigger")
          .filter({ visible: true })
          .first()
      ).toContainText("Member User");
    });

    test("should update issue metadata from the detail page", async ({
      page,
    }, testInfo) => {
      test.skip(
        !testInfo.project.name.includes("Mobile"),
        "Drawer interaction is mobile-specific"
      );

      await page.goto(issueUrl);

      await updateIssueField(page, "status", "confirmed");
      await expect(visibleIssueFieldControl(page, "status")).toContainText(
        "Confirmed"
      );

      await updateIssueField(page, "severity", "major");
      await expect(visibleIssueFieldControl(page, "severity")).toContainText(
        "Major"
      );

      await updateIssueField(page, "priority", "high");
      await expect(visibleIssueFieldControl(page, "priority")).toContainText(
        "High"
      );

      await updateIssueField(page, "frequency", "constant");
      await expect(visibleIssueFieldControl(page, "frequency")).toContainText(
        "Constant"
      );
    });
  });
});
