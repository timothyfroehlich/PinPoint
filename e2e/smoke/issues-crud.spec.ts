/**
 * E2E Tests for Issues CRUD Flows
 *
 * Tests complete user workflows for creating and managing issues.
 * Requires Supabase to be running.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  updateIssueField,
  visibleIssueFieldControl,
} from "../support/actions.js";
import { cleanupTestEntities, extractIdFromUrl } from "../support/cleanup.js";
import { seededMachines } from "../support/constants.js";
import {
  fillReportForm,
  submitFormAndWaitForRedirect,
} from "../support/page-helpers.js";
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
  // eslint-disable-next-line no-empty-pattern -- Playwright requires destructuring pattern for first arg
  test.beforeEach(({}, testInfo) => {
    // Mobile Safari can take longer to settle Server Action redirects.
    test.setTimeout(
      testInfo.project.name.includes("Mobile Safari") ? 120000 : 60000
    );
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
      await submitFormAndWaitForRedirect(
        page,
        page.getByRole("button", { name: "Submit Issue Report" }),
        {
          awayFrom: "/report",
          expectedIssueTitle: "Test flipper not working",
        }
      );

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
      // Wait for hydration so the search input's React onChange handler is
      // bound — without it, fill() triggers a default browser input event but
      // React's debounced URL update never runs (Mobile Safari/WebKit).
      // Best-effort with timeout to handle Chromium HMR keeping the network
      // busy indefinitely in dev.
      await page
        .waitForLoadState("networkidle", { timeout: 5000 })
        .catch(() => undefined);

      const machineSearchInput = page.getByPlaceholder(
        "Search machines by name or initials..."
      );
      await machineSearchInput.fill(seededMachines.addamsFamily.initials);
      await expect(machineSearchInput).toHaveValue(
        seededMachines.addamsFamily.initials
      );

      // Wait for the search to update the URL before clicking results — the
      // fill() triggers a debounced search + re-render, and clicking during the
      // re-render can miss the navigation.
      await expect
        .poll(() => new URL(page.url()).searchParams.get("q"), {
          timeout: 10000,
        })
        .toBe(seededMachines.addamsFamily.initials);

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
      await submitFormAndWaitForRedirect(
        page,
        page.getByRole("button", { name: "Submit Issue Report" }),
        {
          awayFrom: "/report",
          expectedIssueTitle: "Display flickering",
        }
      );

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
      issueTitle = `Details ${Date.now()}`;
      await page.goto(`/report?machine=${machineInitials}`);
      await fillReportForm(page, { title: issueTitle, priority: "medium" });
      await submitFormAndWaitForRedirect(
        page,
        page.getByRole("button", { name: "Submit Issue Report" }),
        {
          awayFrom: "/report",
          expectedIssueTitle: issueTitle,
        }
      );

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
      // Authenticated mobile uses StickyCommentComposer (sticky bar with
      // "Add a comment" button); desktop shows the inline composer at the end
      // of the timeline. Either is the canonical comment composer for its
      // viewport — assert on whichever applies.
      if (isMobile) {
        await expect(
          page.getByRole("button", { name: "Add a comment" })
        ).toBeVisible();
      } else {
        await expect(page.getByTestId("issue-comment-form")).toBeVisible();
      }
      await expect(page.getByRole("heading", { name: "Activity" })).toHaveCount(
        isMobile ? 0 : 1
      );

      // New unified design: metadata grid visible everywhere; Back to Issues
      // link is mobile-only (desktop relies on AppHeader nav).
      await expect(page.getByTestId("issue-metadata-grid")).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Back to Issues/i })
      ).toHaveCount(isMobile ? 1 : 0);

      // Verify no horizontal overflow on issue detail page
      await assertNoHorizontalOverflow(page);
    });

    // Update tests moved to integration/full suite
  });

  test.describe("Issue Detail Display", () => {
    let issueUrl: string;
    let issueTitle: string;

    test.beforeEach(async ({ page }) => {
      // Create a fresh issue for this worker to avoid parallel test conflicts
      const machineInitials = seededMachines.humptyDumpty.initials;
      issueTitle = `Assignee ${Date.now()}`;
      await page.goto(`/report?machine=${machineInitials}`);
      await fillReportForm(page, { title: issueTitle, priority: "medium" });
      await submitFormAndWaitForRedirect(
        page,
        page.getByRole("button", { name: "Submit Issue Report" }),
        {
          awayFrom: "/report",
          expectedIssueTitle: issueTitle,
        }
      );

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

      // Verify assignment timeline event appears
      await expect(page.getByText("Assigned to Member User")).toBeVisible();
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
